/**
 * Kernel public interfaces and lifecycle contracts.
 * Strictly implements Phase 3 (IKernel) and Phase 5 (Kernel Startup & Shutdown).
 */

import { Container, SubsystemHealth, UUID } from '@agy/shared';

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

export interface ISubsystem {
  readonly name: string;
  boot(): Promise<void>;
  shutdown(): Promise<void>;
  health(): Promise<SubsystemHealth> | SubsystemHealth;
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
