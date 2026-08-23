/**
 * Durable single-writer runtime state.
 * Transactions are atomic in memory and on the WAL boundary; recovery replays
 * complete records only and all snapshots returned to callers are deep clones.
 */

import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  Command, ExecutionLedger, Lease, LedgerEntry, StateSnapshot, SubsystemHealth,
  TransactionResult, UUID, AgyError, asUUID, ISubsystem, deepClone,
} from '@agy/shared';
import { IEventBus } from '@agy/event-bus';
import { IRuntimeState, RuntimeStateOptions, WalRecord } from './interfaces.js';

const DEFAULT_CHECKPOINT_INTERVAL = 1000;

export class RuntimeState implements IRuntimeState, ISubsystem {
  public readonly id: UUID = asUUID('runtime-state');
  public readonly name = 'runtime-state';

  private _version = 0;
  private _leases = new Map<UUID, Lease>();
  private _ledgers = new Map<UUID, ExecutionLedger>();
  private _activePlans = new Set<UUID>();
  private _transactionQueue: Promise<void> = Promise.resolve();
  private _isReady = false;
  private _bootTime = 0;
  private _eventBus?: IEventBus;
  private _persistenceDir?: string;
  private _walPersister?: (entry: Command) => Promise<void> | void;
  private _fsync: boolean;
  private _checkpointInterval: number;
  private _commandsSinceCheckpoint = 0;
  private _lockPath?: string;
  private _lockHeld = false;

  constructor(options: RuntimeStateOptions = {}) {
    this._eventBus = options.eventBus;
    this._persistenceDir = options.persistenceDir;
    this._walPersister = options.walPersister;
    this._fsync = options.fsync ?? true;
    this._checkpointInterval = validatePositiveInteger(options.checkpointIntervalCommands ?? DEFAULT_CHECKPOINT_INTERVAL, 'checkpointIntervalCommands');
  }

  public async start(): Promise<void> { await this.boot(); }
  public async stop(): Promise<void> { await this.shutdown(); }
  public async getHealth(): Promise<SubsystemHealth> { return Promise.resolve(this.health()); }

  public async boot(): Promise<void> {
    if (this._isReady) return;
    this.resetState();
    if (this._persistenceDir) this.acquireLock();
    this._isReady = true;
    this._bootTime = Date.now();

    if (!this._persistenceDir) return;
    const walDir = path.join(this._persistenceDir, 'wal');
    fs.mkdirSync(walDir, { recursive: true });

    let snapshotVersion = 0;
    const snapshotPath = path.join(walDir, 'snapshot.json');
    if (fs.existsSync(snapshotPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as { version: number; state: StateSnapshot };
        if (!Number.isInteger(raw.version) || raw.version < 0 || !raw.state) throw new Error('invalid snapshot');
        this.restoreSnapshot(raw.state);
        this._version = raw.version;
        snapshotVersion = raw.version;
      } catch {
        // Ignore an invalid snapshot and replay any surviving WAL from zero.
        this.resetState();
      }
    }

    const walFile = path.join(walDir, 'current.wal');
    if (!fs.existsSync(walFile)) return;
    const lines = fs.readFileSync(walFile, 'utf8').split('\n').filter((line) => line.trim().length > 0);
    for (const line of lines) {
      let record: WalRecord;
      try { record = JSON.parse(line) as WalRecord; } catch { break; }
      if (!Number.isInteger(record.seq) || record.seq <= this._version || record.seq <= snapshotVersion) break;
      if (!Array.isArray(record.commands)) break;
      if (record.crc !== undefined && record.crc !== computeCrc(record.commands)) break;

      const backup = this.getSnapshot();
      try {
        for (const command of record.commands) this.applyCommand(command);
        this._version = record.seq;
      } catch {
        // A WAL record is an atomic transaction. Discard every command from a
        // record if any one command is invalid.
        this.restoreSnapshot(backup);
        this._version = backup.version;
        break;
      }
    }
  }

  public async shutdown(): Promise<void> {
    // Close admission before waiting so shutdown cannot race a new commit.
    this._isReady = false;
    try { await this.flush(); }
    finally { this.releaseLock(); }
  }

  public health(): SubsystemHealth {
    return { status: this._isReady ? 'healthy' : 'unhealthy', uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0 };
  }

  public getSnapshot(): StateSnapshot {
    const leases: Record<string, Lease> = {};
    for (const [key, lease] of this._leases) leases[key] = deepClone(lease);
    const ledgers: Record<string, ExecutionLedger> = {};
    for (const [key, ledger] of this._ledgers) ledgers[key] = deepClone(ledger);
    return {
      version: this._version,
      leases,
      ledgers,
      activePlans: [...this._activePlans],
    };
  }

  public getLease(leaseId: UUID): Lease | null {
    const lease = this._leases.get(leaseId);
    return lease ? deepClone(lease) : null;
  }

  public getLedger(planId: UUID): ExecutionLedger | null {
    const ledger = this._ledgers.get(planId);
    return ledger ? deepClone(ledger) : null;
  }

  public async transact(commands: Command[]): Promise<TransactionResult> {
    if (!this._isReady) throw new AgyError('RuntimeState is not ready', {
      code: 'STATE_NOT_READY', subsystem: 'runtime-state', retryable: false,
    });
    if (!Array.isArray(commands)) throw new TypeError('commands must be an array');
    if (commands.length === 0) return { version: this._version, success: true };

    // Snapshot caller input before placing it behind the writer queue.
    const immutableCommands = deepClone(commands);
    const result = new Promise<TransactionResult>((resolve) => {
      this._transactionQueue = this._transactionQueue.then(async () => {
        const backup = this.getSnapshot();
        try {
          for (const command of immutableCommands) this.applyCommand(command);
          const nextVersion = this._version + 1;

          if (this._persistenceDir) {
            this.appendWalRecord({ seq: nextVersion, crc: computeCrc(immutableCommands), timestamp: Date.now(), commands: immutableCommands });
          } else if (this._walPersister) {
            for (const command of immutableCommands) await this._walPersister(deepClone(command));
          }

          this._version = nextVersion;
          this._commandsSinceCheckpoint += immutableCommands.length;
          if (this._persistenceDir && this._commandsSinceCheckpoint >= this._checkpointInterval) {
            // Checkpointing is maintenance after a committed WAL record. A
            // checkpoint failure must not turn a durable commit into a reported
            // failure; the WAL remains the recovery source.
            try { this.writeCheckpoint(); } catch (err) { console.error('[RuntimeState] checkpoint failed:', err); }
          }

          const committed: TransactionResult = { version: this._version, success: true };
          resolve(committed);
          // Notifications are additive and cannot invalidate a committed fact.
          if (this._eventBus) {
            void this._eventBus.publish('state.mutated', {
              id: asUUID(randomUUID()), topic: 'state.mutated', key: `v:${this._version}`,
              payload: { version: this._version, commandCount: immutableCommands.length }, timestamp: Date.now(),
            }).catch((err) => console.error('[RuntimeState] mutation event failed:', err));
          }
        } catch (err) {
          this.restoreSnapshot(backup);
          resolve({
            version: backup.version,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }).catch((err) => {
        // Keep the writer chain usable even if an unexpected implementation
        // error escapes the transaction body.
        resolve({ version: this._version, success: false, error: err instanceof Error ? err.message : String(err) });
      });
    });
    return result;
  }

  public async grantLease(lease: Lease): Promise<void> {
    const result = await this.transact([{ type: 'GRANT_LEASE', payload: deepClone(lease) }]);
    this.assertCommitted(result);
  }

  public async revokeLease(leaseId: UUID): Promise<boolean> {
    const existing = this._leases.get(leaseId);
    if (!existing || existing.revoked) return false;
    const result = await this.transact([{ type: 'REVOKE_LEASE', payload: { leaseId } }]);
    this.assertCommitted(result);
    return true;
  }

  public async trackPlan(planId: UUID): Promise<void> {
    const result = await this.transact([{ type: 'TRACK_PLAN', payload: { planId } }]);
    this.assertCommitted(result);
  }

  public async untrackPlan(planId: UUID): Promise<void> {
    const result = await this.transact([{ type: 'UNTRACK_PLAN', payload: { planId } }]);
    this.assertCommitted(result);
  }

  public async appendLedgerEntry(planId: UUID, entry: LedgerEntry): Promise<void> {
    if (entry.planId !== planId) throw new AgyError('Ledger entry planId does not match ledger', {
      code: 'LEDGER_PLAN_MISMATCH', subsystem: 'runtime-state', retryable: false,
    });
    const result = await this.transact([{ type: 'APPEND_LEDGER', payload: { planId, entry: deepClone(entry) } }]);
    this.assertCommitted(result);
  }

  public async flush(): Promise<void> { await this._transactionQueue; }

  private assertCommitted(result: TransactionResult): void {
    if (!result.success) throw new AgyError(result.error ?? 'Runtime state transaction failed', {
      code: 'STATE_TRANSACTION_FAILED', subsystem: 'runtime-state', retryable: true,
    });
  }

  private resetState(): void {
    this._version = 0;
    this._leases = new Map();
    this._ledgers = new Map();
    this._activePlans = new Set();
    this._transactionQueue = Promise.resolve();
    this._commandsSinceCheckpoint = 0;
  }

  private applyCommand(command: Command): void {
    switch (command.type) {
      case 'GRANT_LEASE': {
        const lease = command.payload as Lease;
        if (!lease || typeof lease.leaseId !== 'string') throw new Error('Invalid lease payload');
        this._leases.set(lease.leaseId, deepClone(lease));
        break;
      }
      case 'REVOKE_LEASE': {
        const { leaseId } = command.payload as { leaseId: UUID };
        const lease = this._leases.get(leaseId);
        if (lease) lease.revoked = true;
        break;
      }
      case 'TRACK_PLAN': {
        const { planId } = command.payload as { planId: UUID };
        if (typeof planId !== 'string') throw new Error('Invalid plan ID');
        this._activePlans.add(planId);
        if (!this._ledgers.has(planId)) this._ledgers.set(planId, { planId, entries: [] });
        break;
      }
      case 'UNTRACK_PLAN': {
        const { planId } = command.payload as { planId: UUID };
        if (typeof planId !== 'string') throw new Error('Invalid plan ID');
        this._activePlans.delete(planId);
        break;
      }
      case 'APPEND_LEDGER': {
        const { planId, entry } = command.payload as { planId: UUID; entry: LedgerEntry };
        if (typeof planId !== 'string' || !entry || entry.planId !== planId) throw new Error('Invalid ledger payload');
        let ledger = this._ledgers.get(planId);
        if (!ledger) { ledger = { planId, entries: [] }; this._ledgers.set(planId, ledger); }
        ledger.entries.push(deepClone(entry));
        break;
      }
      default:
        throw new Error(`Unknown command type: ${command.type}`);
    }
  }

  private restoreSnapshot(snapshot: StateSnapshot): void {
    this._leases = new Map();
    for (const [key, lease] of Object.entries(snapshot.leases ?? {})) this._leases.set(key as UUID, deepClone(lease));
    this._ledgers = new Map();
    for (const [key, ledger] of Object.entries(snapshot.ledgers ?? {})) this._ledgers.set(key as UUID, deepClone(ledger));
    this._activePlans = new Set((snapshot.activePlans ?? []) as UUID[]);
  }

  private acquireLock(): void {
    const lockPath = path.join(this._persistenceDir!, 'state.lock');
    fs.mkdirSync(this._persistenceDir!, { recursive: true });
    try {
      const fd = fs.openSync(lockPath, 'wx');
      try { fs.writeSync(fd, JSON.stringify({ pid: process.pid, acquiredAt: Date.now() })); fs.fsyncSync(fd); }
      finally { fs.closeSync(fd); }
      this._lockPath = lockPath;
      this._lockHeld = true;
    } catch (err) {
      let stale = false;
      try {
        const owner = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as { pid?: number };
        if (!owner.pid) stale = true;
        else { try { process.kill(owner.pid, 0); } catch { stale = true; } }
      } catch { stale = true; }
      if (stale) {
        fs.rmSync(lockPath, { force: true });
        return this.acquireLock();
      }
      throw new AgyError('Another RuntimeState instance owns this persistence directory', {
        code: 'STATE_LOCKED', subsystem: 'runtime-state', retryable: true, cause: err,
      });
    }
  }

  private releaseLock(): void {
    if (this._lockHeld && this._lockPath) fs.rmSync(this._lockPath, { force: true });
    this._lockHeld = false;
    this._lockPath = undefined;
  }

  private walDir(): string { return path.join(this._persistenceDir!, 'wal'); }

  private appendWalRecord(record: WalRecord): void {
    const walFile = path.join(this.walDir(), 'current.wal');
    fs.mkdirSync(this.walDir(), { recursive: true });
    const fd = fs.openSync(walFile, 'a');
    try {
      const line = JSON.stringify(record) + '\n';
      fs.writeSync(fd, line);
      if (this._fsync) fs.fsyncSync(fd);
    } finally { fs.closeSync(fd); }
  }

  private fsyncDirectory(directory: string): void {
    try {
      const fd = fs.openSync(directory, 'r');
      try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    } catch {
      // Directory fsync is not available on every supported filesystem.
    }
  }

  private writeCheckpoint(): void {
    const snapshotPath = path.join(this.walDir(), 'snapshot.json');
    const tmp = `${snapshotPath}.tmp-${randomUUID()}`;
    const payload = JSON.stringify({ version: this._version, timestamp: Date.now(), state: this.getSnapshot() });
    fs.writeFileSync(tmp, payload);
    if (this._fsync) {
      const fd = fs.openSync(tmp, 'r+');
      try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    }
    fs.renameSync(tmp, snapshotPath);
    this.fsyncDirectory(this.walDir());
    const walFile = path.join(this.walDir(), 'current.wal');
    const fd = fs.openSync(walFile, 'w');
    try { if (this._fsync) fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    this._commandsSinceCheckpoint = 0;
  }
}

export function computeCrc(commands: Command[]): number {
  return parseInt(createHash('sha256').update(JSON.stringify(commands)).digest('hex').slice(0, 8), 16) >>> 0;
}

function validatePositiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) throw new RangeError(`${name} must be a positive integer`);
  return value;
}
