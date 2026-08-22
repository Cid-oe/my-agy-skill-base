/**
 * Concrete single-writer Runtime State implementation.
 * Guarantees monotonic versioning, copy-on-write immutable snapshots,
 * transactional atomicity, write-ahead logging (WAL), and event emission.
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  Command,
  ExecutionLedger,
  Lease,
  LedgerEntry,
  StateSnapshot,
  SubsystemHealth,
  TransactionResult,
  UUID,
  AgyError,
  asUUID,
  ISubsystem,
} from '@agy/shared';
import { IEventBus } from '@agy/event-bus';
import { IRuntimeState, RuntimeStateOptions, WalRecord } from './interfaces.js';

export class RuntimeState implements IRuntimeState, ISubsystem {
  public readonly id: UUID = asUUID('runtime-state');
  public readonly name = 'runtime-state';

  public async start(): Promise<void> { await this.boot(); }
  public async stop(): Promise<void> { await this.shutdown(); }
  public async getHealth(): Promise<SubsystemHealth> { return Promise.resolve(this.health()); }

  private _version = 0;
  private _leases = new Map<UUID, Lease>();
  private _ledgers = new Map<UUID, ExecutionLedger>();
  private _activePlans = new Set<UUID>();
  private _walLog: Command[] = [];
  private _transactionQueue = Promise.resolve();
  private _isReady = false;
  private _bootTime = 0;
  private _eventBus?: IEventBus;
  private _persistenceDir?: string;
  private _walPersister?: (entry: Command) => Promise<void> | void;
  private _fsync: boolean;

  constructor(options: RuntimeStateOptions = {}) {
    this._eventBus = options.eventBus;
    this._persistenceDir = options.persistenceDir;
    this._walPersister = options.walPersister;
    this._fsync = options.fsync ?? true;
  }

  public async boot(): Promise<void> {
    this._isReady = true;
    this._bootTime = Date.now();

    // Replay WAL on boot if persistence directory is specified
    if (this._persistenceDir) {
      const walDir = path.join(this._persistenceDir, 'wal');
      if (!fs.existsSync(walDir)) {
        fs.mkdirSync(walDir, { recursive: true });
      }
      const walFile = path.join(walDir, 'current.wal');
      if (fs.existsSync(walFile)) {
        const content = fs.readFileSync(walFile, 'utf-8');
        const lines = content.split('\n').filter((l) => l.trim().length > 0);
        for (const line of lines) {
          try {
            const record = JSON.parse(line) as WalRecord;
            for (const cmd of record.commands) {
              this.applyCommand(cmd);
              this._walLog.push(cmd);
            }
            this._version = record.seq;
          } catch {
            // Ignore malformed trailing records during recovery
          }
        }
      }
    }
  }

  public async shutdown(): Promise<void> {
    await this.flush();
    this._isReady = false;
  }

  public health(): SubsystemHealth {
    return {
      status: this._isReady ? 'healthy' : 'unhealthy',
      uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0,
    };
  }

  public getSnapshot(): StateSnapshot {
    const leases: Record<string, Lease> = {};
    for (const [k, v] of this._leases.entries()) {
      leases[k] = { ...v, capabilities: [...v.capabilities] };
    }

    const ledgers: Record<string, ExecutionLedger> = {};
    for (const [k, v] of this._ledgers.entries()) {
      ledgers[k] = {
        planId: v.planId,
        finalStatus: v.finalStatus,
        entries: v.entries.map((e) => ({ ...e })),
      };
    }

    return {
      version: this._version,
      leases,
      ledgers,
      activePlans: Array.from(this._activePlans),
    };
  }

  public getLease(leaseId: UUID): Lease | null {
    const lease = this._leases.get(leaseId);
    return lease ? { ...lease, capabilities: [...lease.capabilities] } : null;
  }

  public getLedger(planId: UUID): ExecutionLedger | null {
    const ledger = this._ledgers.get(planId);
    if (!ledger) return null;
    return {
      planId: ledger.planId,
      finalStatus: ledger.finalStatus,
      entries: ledger.entries.map((e) => ({ ...e })),
    };
  }

  public async transact(commands: Command[]): Promise<TransactionResult> {
    if (!this._isReady) {
      throw new AgyError('RuntimeState is not ready', {
        code: 'STATE_NOT_READY',
        subsystem: 'runtime-state',
        retryable: false,
      });
    }

    // Single-writer command queue serialization
    const result = new Promise<TransactionResult>((resolve) => {
      this._transactionQueue = this._transactionQueue
        .then(async () => {
          // Backup state for rollback
          const leasesBackup = new Map<UUID, Lease>();
          for (const [k, v] of this._leases.entries()) {
            leasesBackup.set(k, { ...v, capabilities: [...v.capabilities] });
          }

          const ledgersBackup = new Map<UUID, ExecutionLedger>();
          for (const [k, v] of this._ledgers.entries()) {
            ledgersBackup.set(k, {
              planId: v.planId,
              finalStatus: v.finalStatus,
              entries: v.entries.map((e) => ({ ...e })),
            });
          }

          const activePlansBackup = new Set(this._activePlans);

          try {
            for (const cmd of commands) {
              this.applyCommand(cmd);
            }
            
            // All commands succeeded, commit to WAL
            for (const cmd of commands) {
              this._walLog.push(cmd);
              if (this._walPersister) {
                await this._walPersister(cmd);
              }
            }

            this._version++;

            if (this._persistenceDir) {
              const walDir = path.join(this._persistenceDir, 'wal');
              if (!fs.existsSync(walDir)) {
                fs.mkdirSync(walDir, { recursive: true });
              }
              const walFile = path.join(walDir, 'current.wal');
              const record: WalRecord = {
                seq: this._version,
                timestamp: Date.now(),
                commands,
              };
              const fd = fs.openSync(walFile, 'a');
              try {
                fs.writeSync(fd, JSON.stringify(record) + '\n');
                if (this._fsync) {
                  fs.fsyncSync(fd);
                }
              } finally {
                fs.closeSync(fd);
              }
            }

            const txResult: TransactionResult = {
              version: this._version,
              success: true,
            };

            if (this._eventBus) {
              await this._eventBus.publish('state.mutated', {
                id: asUUID(randomUUID()),
                topic: 'state.mutated',
                key: `v:${this._version}`,
                payload: { version: this._version, commandCount: commands.length },
                timestamp: Date.now(),
              });
            }

            resolve(txResult);
          } catch (err: unknown) {
            // Rollback on command application failure
            this._leases = leasesBackup;
            this._ledgers = ledgersBackup;
            this._activePlans = activePlansBackup;

            const msg = err instanceof Error ? err.message : String(err);
            resolve({
              version: this._version,
              success: false,
              error: msg,
            });
          }
        })
        .catch((err) => {
          // Fallback catch to prevent the queue promise from ever remaining rejected
          resolve({
            version: this._version,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
        });
    });

    return result;
  }

  public async grantLease(lease: Lease): Promise<void> {
    await this.transact([{ type: 'GRANT_LEASE', payload: lease }]);
  }

  public async revokeLease(leaseId: UUID): Promise<boolean> {
    const existing = this._leases.get(leaseId);
    if (!existing || existing.revoked) return false;
    await this.transact([{ type: 'REVOKE_LEASE', payload: { leaseId } }]);
    return true;
  }

  public async trackPlan(planId: UUID): Promise<void> {
    await this.transact([{ type: 'TRACK_PLAN', payload: { planId } }]);
  }

  public async untrackPlan(planId: UUID): Promise<void> {
    await this.transact([{ type: 'UNTRACK_PLAN', payload: { planId } }]);
  }

  public async appendLedgerEntry(planId: UUID, entry: LedgerEntry): Promise<void> {
    await this.transact([{ type: 'APPEND_LEDGER', payload: { planId, entry } }]);
  }

  public async flush(): Promise<void> {
    // Settle pending queue
    await this._transactionQueue;
  }

  private applyCommand(cmd: Command): void {
    switch (cmd.type) {
      case 'GRANT_LEASE': {
        const lease = cmd.payload as Lease;
        this._leases.set(lease.leaseId, { ...lease });
        break;
      }
      case 'REVOKE_LEASE': {
        const { leaseId } = cmd.payload as { leaseId: UUID };
        const lease = this._leases.get(leaseId);
        if (lease) {
          lease.revoked = true;
        }
        break;
      }
      case 'TRACK_PLAN': {
        const { planId } = cmd.payload as { planId: UUID };
        this._activePlans.add(planId);
        if (!this._ledgers.has(planId)) {
          this._ledgers.set(planId, { planId, entries: [] });
        }
        break;
      }
      case 'UNTRACK_PLAN': {
        const { planId } = cmd.payload as { planId: UUID };
        this._activePlans.delete(planId);
        break;
      }
      case 'APPEND_LEDGER': {
        const { planId, entry } = cmd.payload as { planId: UUID; entry: LedgerEntry };
        let ledger = this._ledgers.get(planId);
        if (!ledger) {
          ledger = { planId, entries: [] };
          this._ledgers.set(planId, ledger);
        }
        ledger.entries.push({ ...entry });
        break;
      }
      default:
        throw new Error(`Unknown command type: ${cmd.type}`);
    }
  }
}
