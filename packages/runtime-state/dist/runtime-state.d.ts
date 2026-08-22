/**
 * Concrete single-writer Runtime State implementation.
 * Guarantees monotonic versioning, copy-on-write immutable snapshots,
 * transactional atomicity, write-ahead logging (WAL), and event emission.
 */
import { Command, ExecutionLedger, Lease, LedgerEntry, StateSnapshot, SubsystemHealth, TransactionResult, UUID, ISubsystem } from '@agy/shared';
import { IRuntimeState, RuntimeStateOptions } from './interfaces.js';
export declare class RuntimeState implements IRuntimeState, ISubsystem {
    readonly id: UUID;
    readonly name = "runtime-state";
    start(): Promise<void>;
    stop(): Promise<void>;
    getHealth(): Promise<SubsystemHealth>;
    private _version;
    private _leases;
    private _ledgers;
    private _activePlans;
    private _walLog;
    private _transactionQueue;
    private _isReady;
    private _bootTime;
    private _eventBus?;
    private _persistenceDir?;
    private _walPersister?;
    private _fsync;
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