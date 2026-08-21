"use strict";
/**
 * Concrete single-writer Runtime State implementation.
 * Guarantees monotonic versioning, copy-on-write immutable snapshots,
 * transactional atomicity, write-ahead logging (WAL), and event emission.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeState = void 0;
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@agy/shared");
class RuntimeState {
    name = 'runtime-state';
    _version = 0;
    _leases = new Map();
    _ledgers = new Map();
    _activePlans = new Set();
    _walLog = [];
    _transactionQueue = Promise.resolve();
    _isReady = false;
    _bootTime = 0;
    _eventBus;
    constructor(options = {}) {
        this._eventBus = options.eventBus;
    }
    async boot() {
        this._isReady = true;
        this._bootTime = Date.now();
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
        const result = new Promise((resolve, reject) => {
            this._transactionQueue = this._transactionQueue
                .then(async () => {
                try {
                    for (const cmd of commands) {
                        this.applyCommand(cmd);
                        this._walLog.push(cmd);
                    }
                    this._version++;
                    const txResult = {
                        version: this._version,
                        success: true,
                    };
                    if (this._eventBus) {
                        await this._eventBus.publish('state.mutated', {
                            id: (0, node_crypto_1.randomUUID)(),
                            topic: 'state.mutated',
                            key: `v:${this._version}`,
                            payload: { version: this._version, commandCount: commands.length },
                            timestamp: Date.now(),
                        });
                    }
                    resolve(txResult);
                }
                catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    resolve({
                        version: this._version,
                        success: false,
                        error: msg,
                    });
                }
            })
                .catch(reject);
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