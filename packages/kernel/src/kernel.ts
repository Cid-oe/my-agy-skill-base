/**
 * Concrete implementation of the AGY Kernel composition root.
 * Enforces Phase 5 dependency-ordered startup and graceful drain/shutdown.
 */

import { randomUUID } from 'node:crypto';
import { Container, SubsystemHealth, AgyError } from '@agy/shared';
import {
  IKernel,
  ISubsystem,
  KernelConfig,
  KernelHandle,
  KernelLifecycleState,
} from './interfaces.js';

export class Kernel implements IKernel {
  private _state: KernelLifecycleState = 'uninitialized';
  private _kernelId: string = randomUUID();
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
    this._kernelId = config.kernelId || randomUUID();
    this._state = 'booting';
    this._bootedAt = Date.now();

    try {
      // Step 1: Initialize container configuration
      this._container.register('config', this._config);
      this._container.register('kernelId', this._kernelId);

      // Step 2-8: Sequential dependency-ordered subsystem boot
      for (const subsystem of this._subsystems) {
        await subsystem.boot();
        this._container.register(subsystem.name, subsystem);
      }

      this._state = 'ready';
      return this.createHandle();
    } catch (err: unknown) {
      this._state = 'degraded';
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

    for (const subsystem of this._subsystems) {
      try {
        report[subsystem.name] = await subsystem.health();
      } catch (err) {
        report[subsystem.name] = {
          status: 'unhealthy',
          lastError: err instanceof Error ? err.message : String(err),
          uptimeMs: 0,
        };
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
