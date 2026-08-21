/**
 * RuntimeState interfaces and contracts.
 * Strictly implements Phase 3 (IRuntimeState) and RFC-0005.
 */
import { Command, ExecutionLedger, Lease, LedgerEntry, StateSnapshot, SubsystemHealth, TransactionResult, UUID } from '@agy/shared';
import { ISubsystem } from '@agy/kernel';
export interface IRuntimeState extends ISubsystem {
    transact(commands: Command[]): Promise<TransactionResult>;
    getSnapshot(): StateSnapshot;
    getLease(leaseId: UUID): Lease | null;
    getLedger(planId: UUID): ExecutionLedger | null;
    appendLedgerEntry(planId: UUID, entry: LedgerEntry): Promise<void>;
    grantLease(lease: Lease): Promise<void>;
    revokeLease(leaseId: UUID): Promise<boolean>;
    trackPlan(planId: UUID): Promise<void>;
    untrackPlan(planId: UUID): Promise<void>;
    flush(): Promise<void>;
    health(): Promise<SubsystemHealth> | SubsystemHealth;
}
//# sourceMappingURL=interfaces.d.ts.map