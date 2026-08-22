"use strict";
/**
 * Concrete single-writer Runtime State implementation.
 * Guarantees monotonic versioning, copy-on-write immutable snapshots,
 * transactional atomicity, write-ahead logging (WAL), and event emission.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeState = void 0;
const node_crypto_1 = require("node:crypto");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const shared_1 = require("@agy/shared");
class RuntimeState {
    id = (0, shared_1.asUUID)('runtime-state');
    name = 'runtime-state';
    async start() { await this.boot(); }
    async stop() { await this.shutdown(); }
    async getHealth() { return Promise.resolve(this.health()); }
    _version = 0;
    _leases = new Map();
    _ledgers = new Map();
    _activePlans = new Set();
    _walLog = [];
    _transactionQueue = Promise.resolve();
    _isReady = false;
    _bootTime = 0;
    _eventBus;
    _persistenceDir;
    _walPersister;
    _fsync;
    constructor(options = {}) {
        this._eventBus = options.eventBus;
        this._persistenceDir = options.persistenceDir;
        this._walPersister = options.walPersister;
        this._fsync = options.fsync ?? true;
    }
    async boot() {
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
                        const record = JSON.parse(line);
                        for (const cmd of record.commands) {
                            this.applyCommand(cmd);
                            this._walLog.push(cmd);
                        }
                        this._version = record.seq;
                    }
                    catch {
                        // Ignore malformed trailing records during recovery
                    }
                }
            }
        }
    }
    async shutdown() {
        await this.flush();
        this._isReady = false;
    }
    health() {
        return {
            status: this._isReady ? 'healthy' : 'unhealthy',
            uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0,
        };
    }
    getSnapshot() {
        const leases = {};
        for (const [k, v] of this._leases.entries()) {
            leases[k] = { ...v, capabilities: [...v.capabilities] };
        }
        const ledgers = {};
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
    getLease(leaseId) {
        const lease = this._leases.get(leaseId);
        return lease ? { ...lease, capabilities: [...lease.capabilities] } : null;
    }
    getLedger(planId) {
        const ledger = this._ledgers.get(planId);
        if (!ledger)
            return null;
        return {
            planId: ledger.planId,
            finalStatus: ledger.finalStatus,
            entries: ledger.entries.map((e) => ({ ...e })),
        };
    }
    async transact(commands) {
        if (!this._isReady) {
            throw new shared_1.AgyError('RuntimeState is not ready', {
                code: 'STATE_NOT_READY',
                subsystem: 'runtime-state',
                retryable: false,
            });
        }
        // Single-writer command queue serialization
        const result = new Promise((resolve) => {
            this._transactionQueue = this._transactionQueue
                .then(async () => {
                // Backup state for rollback
                const leasesBackup = new Map();
                for (const [k, v] of this._leases.entries()) {
                    leasesBackup.set(k, { ...v, capabilities: [...v.capabilities] });
                }
                const ledgersBackup = new Map();
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
                        const record = {
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
                        }
                        finally {
                            fs.closeSync(fd);
                        }
                    }
                    const txResult = {
                        version: this._version,
                        success: true,
                    };
                    if (this._eventBus) {
                        await this._eventBus.publish('state.mutated', {
                            id: (0, shared_1.asUUID)((0, node_crypto_1.randomUUID)()),
                            topic: 'state.mutated',
                            key: `v:${this._version}`,
                            payload: { version: this._version, commandCount: commands.length },
                            timestamp: Date.now(),
                        });
                    }
                    resolve(txResult);
                }
                catch (err) {
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
    async grantLease(lease) {
        await this.transact([{ type: 'GRANT_LEASE', payload: lease }]);
    }
    async revokeLease(leaseId) {
        const existing = this._leases.get(leaseId);
        if (!existing || existing.revoked)
            return false;
        await this.transact([{ type: 'REVOKE_LEASE', payload: { leaseId } }]);
        return true;
    }
    async trackPlan(planId) {
        await this.transact([{ type: 'TRACK_PLAN', payload: { planId } }]);
    }
    async untrackPlan(planId) {
        await this.transact([{ type: 'UNTRACK_PLAN', payload: { planId } }]);
    }
    async appendLedgerEntry(planId, entry) {
        await this.transact([{ type: 'APPEND_LEDGER', payload: { planId, entry } }]);
    }
    async flush() {
        // Settle pending queue
        await this._transactionQueue;
    }
    applyCommand(cmd) {
        switch (cmd.type) {
            case 'GRANT_LEASE': {
                const lease = cmd.payload;
                this._leases.set(lease.leaseId, { ...lease });
                break;
            }
            case 'REVOKE_LEASE': {
                const { leaseId } = cmd.payload;
                const lease = this._leases.get(leaseId);
                if (lease) {
                    lease.revoked = true;
                }
                break;
            }
            case 'TRACK_PLAN': {
                const { planId } = cmd.payload;
                this._activePlans.add(planId);
                if (!this._ledgers.has(planId)) {
                    this._ledgers.set(planId, { planId, entries: [] });
                }
                break;
            }
            case 'UNTRACK_PLAN': {
                const { planId } = cmd.payload;
                this._activePlans.delete(planId);
                break;
            }
            case 'APPEND_LEDGER': {
                const { planId, entry } = cmd.payload;
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
exports.RuntimeState = RuntimeState;
//# sourceMappingURL=runtime-state.js.map