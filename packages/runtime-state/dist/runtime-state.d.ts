/**
 * Concrete single-writer Runtime State implementation.
 * Guarantees monotonic versioning, copy-on-write immutable snapshots,
 * transactional atomicity, write-ahead logging (WAL), and event emission.
 */
import { Command, ExecutionLedger, Lease, LedgerEntry, StateSnapshot, SubsystemHealth, TransactionResult, UUID } from '@agy/shared';
import { IEventBus } from '@agy/event-bus';
import { IRuntimeState } from './interfaces.js';
export interface RuntimeStateOptions {
    eventBus?: IEventBus;
    walPersister?: (entry: Command) => Promise<void> | void;
}
export declare class RuntimeState implements IRuntimeState {
    readonly name = "runtime-state";
    private _version;
    private _leases;
    private _ledgers;
    private _activePlans;
    private _walLog;
    private _transactionQueue;
    private _isReady;
    private _bootTime;
    private _eventBus?;
    constructor(options?: RuntimeStateOptions);
    boot(): Promise<void>;
    shutdown(): Promise<void>;
    health(): SubsystemHealth;
    getSnapshot(): StateSnapshot;
    getLease(leaseId: UUID): Lease | null;
    getLedger(planId: UUID): ExecutionLedger | null;
    transact(commands: Command[]): Promise<TransactionResult>;
    grantLease(lease: Lease): Promise<void>;
    revokeLease(leaseId: UUID): Promise<boolean>;
    trackPlan(planId: UUID): Promise<void>;
    untrackPlan(planId: UUID): Promise<void>;
    appendLedgerEntry(planId: UUID, entry: LedgerEntry): Promise<void>;
    flush(): Promise<void>;
    private applyCommand;
}
//# sourceMappingURL=runtime-state.d.ts.map