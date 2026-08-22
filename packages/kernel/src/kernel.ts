/**
 * Concrete implementation of the AGY Kernel composition root.
 * Enforces Phase 5 dependency-ordered startup and graceful drain/shutdown.
 */

import { randomUUID } from 'node:crypto';
import { Container, SubsystemHealth, AgyError, UUID, asUUID } from '@agy/shared';
import {
  IKernel,
  ISubsystem,
  KernelConfig,
  KernelHandle,
  KernelLifecycleState,
} from './interfaces.js';

export class Kernel implements IKernel {
  private _state: KernelLifecycleState = 'uninitialized';
  private _kernelId: UUID = asUUID(randomUUID());
  private _container = new Container();
  private _subsystems: ISubsystem[] = [];
  private _config: KernelConfig = {};
  private _bootedAt: number = 0;

  constructor(container?: Container) {
    if (container) {
      this._container = container;
    }
  }

  public get state(): KernelLifecycleState {
    return this._state;
  }

  public getContainer(): Container {
    return this._container;
  }

  public registerSubsystem(subsystem: ISubsystem): void {
    if (this._state !== 'uninitialized') {
      throw new AgyError(
        `Cannot register subsystem '${subsystem.name}' while kernel is in state '${this._state}'`,
        { code: 'INVALID_STATE', subsystem: 'kernel', retryable: false }
      );
    }
    this._subsystems.push(subsystem);
  }

  public async boot(config: KernelConfig = {}): Promise<KernelHandle> {
    if (this._state === 'ready') {
      return this.createHandle();
    }
    if (this._state !== 'uninitialized' && this._state !== 'shutdown') {
      throw new AgyError(`Cannot boot kernel from state '${this._state}'`, {
        code: 'INVALID_STATE',
        subsystem: 'kernel',
        retryable: false,
      });
    }

    this._config = config;
    this._kernelId = config.kernelId || asUUID(randomUUID());
    this._state = 'booting';
    this._bootedAt = Date.now();

    const bootedSubsystems: ISubsystem[] = [];

    try {
      // Step 1: Initialize container configuration
      this._container.register('config', this._config);
      this._container.register('kernelId', this._kernelId);

      // Step 2-8: Sequential dependency-ordered subsystem boot
      for (const subsystem of this._subsystems) {
        await subsystem.boot();
        bootedSubsystems.push(subsystem);
        this._container.register(subsystem.name, subsystem);
      }

      this._state = 'ready';
      return this.createHandle();
    } catch (err: unknown) {
      // Reverse-order rollback on boot failure (Phase 7 / RFC-0000)
      for (const sub of [...bootedSubsystems].reverse()) {
        try {
          await sub.shutdown();
        } catch (rollbackErr) {
          console.error(`Error during rollback shutdown of ${sub.name}:`, rollbackErr);
        }
      }

      this._state = 'shutdown';
      const msg = err instanceof Error ? err.message : String(err);
      throw new AgyError(`Kernel boot failed: ${msg}`, {
        code: 'BOOT_FAILED',
        subsystem: 'kernel',
        retryable: false,
        details: { originalError: msg },
      });
    }
  }

  public async shutdown(): Promise<void> {
    if (this._state === 'shutdown') {
      return; // idempotent shutdown per Phase 3
    }
    this._state = 'draining';

    // Reverse order shutdown per Phase 5
    const reversed = [...this._subsystems].reverse();
    for (const subsystem of reversed) {
      try {
        await subsystem.shutdown();
      } catch (err) {
        // Log & proceed to guarantee all subsystems get shutdown chance
        console.error(`Error shutting down subsystem ${subsystem.name}:`, err);
      }
    }

    this._state = 'shutdown';
  }

  public async health(): Promise<Record<string, SubsystemHealth>> {
    const report: Record<string, SubsystemHealth> = {
      kernel: {
        status: this._state === 'ready' ? 'healthy' : this._state === 'degraded' ? 'degraded' : 'unhealthy',
        uptimeMs: this._bootedAt ? Date.now() - this._bootedAt : 0,
      },
    };

    // Parallelized health checks with individual timeout guards (RFC-0015)
    const healthPromises = this._subsystems.map(async (subsystem) => {
      try {
        const timeoutPromise = new Promise<SubsystemHealth>((_, reject) =>
          setTimeout(() => reject(new Error(`Health check timeout for ${subsystem.name}`)), 2000)
        );
        const health = await Promise.race([subsystem.health(), timeoutPromise]);
        return { name: subsystem.name, health };
      } catch (err) {
        return {
          name: subsystem.name,
          health: {
            status: 'unhealthy' as const,
            lastError: err instanceof Error ? err.message : String(err),
            uptimeMs: 0,
          },
        };
      }
    });

    const results = await Promise.allSettled(healthPromises);
    for (const res of results) {
      if (res.status === 'fulfilled') {
        report[res.value.name] = res.value.health;
      }
    }

    return report;
  }

  private createHandle(): KernelHandle {
    return {
      kernelId: this._kernelId,
      state: this._state,
      container: this._container,
      shutdown: () => this.shutdown(),
      health: () => this.health(),
    };
  }
}
