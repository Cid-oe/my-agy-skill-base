/**
 * RuntimeState interfaces and contracts.
 * Strictly implements Phase 3 (IRuntimeState) and RFC-0005.
 */

import {
  Command,
  ExecutionLedger,
  Lease,
  LedgerEntry,
  StateSnapshot,
  SubsystemHealth,
  TransactionResult,
  UUID,
  ISubsystem,
} from '@agy/shared';
import { IEventBus } from '@agy/event-bus';

export interface WalRecord {
  seq: number;
  crc?: number;
  timestamp: number;
  commands: Command[];
}

export interface RuntimeStateOptions {
  persistenceDir?: string;
  eventBus?: IEventBus;
  fsync?: boolean;
  checkpointIntervalCommands?: number;
  walPersister?: (entry: Command) => Promise<void> | void;
}

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
