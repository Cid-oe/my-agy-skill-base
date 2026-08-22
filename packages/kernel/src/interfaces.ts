/**
 * Kernel public interfaces and lifecycle contracts.
 * Strictly implements Phase 3 (IKernel) and Phase 5 (Kernel Startup & Shutdown).
 */

import { Container, SubsystemHealth, UUID } from '@agy/shared';

/**
 * Canonical kernel subsystem contract (SRC-20). Previously the kernel declared
 * its own narrower ISubsystem (boot/shutdown/health) while @agy/shared declared
 * a different one (start/stop/getHealth/health/id); the shared contract now
 * carries both the canonical boot/shutdown lifecycle and the legacy aliases, so
 * there is a single source of truth. Re-exported here for kernel consumers.
 */
export type { ISubsystem } from '@agy/shared';

export type KernelLifecycleState =
  | 'uninitialized'
  | 'booting'
  | 'ready'
  | 'draining'
  | 'shutdown'
  | 'degraded';

export interface KernelConfig {
  kernelId?: UUID;
  environment?: 'development' | 'production' | 'test';
  scanRoots?: string[];
  persistenceDir?: string;
  maxBootRetries?: number;
  drainTimeoutMs?: number;
}

export interface KernelHandle {
  readonly kernelId: UUID;
  readonly state: KernelLifecycleState;
  readonly container: Container;
  shutdown(): Promise<void>;
  health(): Promise<Record<string, SubsystemHealth>>;
}

export interface IKernel {
  readonly state: KernelLifecycleState;
  boot(config?: KernelConfig): Promise<KernelHandle>;
  shutdown(): Promise<void>;
  health(): Promise<Record<string, SubsystemHealth>>;
  getContainer(): Container;
}
