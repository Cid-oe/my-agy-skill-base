/**
 * Kernel composition root with collision-safe registration, lifecycle-aware
 * handles, rollback, bounded health checks, and aggregate health status.
 */

import { randomUUID } from 'node:crypto';
import { Container, SubsystemHealth, AgyError, UUID, asUUID } from '@agy/shared';
import { IKernel, ISubsystem, KernelConfig, KernelHandle, KernelLifecycleState } from './interfaces.js';

export class Kernel implements IKernel {
  private _state: KernelLifecycleState = 'uninitialized';
  private _kernelId: UUID = asUUID(randomUUID());
  private _container = new Container();
  private _subsystems: ISubsystem[] = [];
  private _config: KernelConfig = {};
  private _bootedAt = 0;
  private _shutdownPromise?: Promise<void>;

  constructor(container?: Container) { if (container) this._container = container; }
  public get state(): KernelLifecycleState { return this._state; }
  public getContainer(): Container { return this._container; }

  public registerSubsystem(subsystem: ISubsystem): void {
    if (!subsystem || !subsystem.name) throw new TypeError('A subsystem with a name is required');
    if (this._state !== 'uninitialized') throw new AgyError(`Cannot register subsystem '${subsystem.name}' while kernel is in state '${this._state}'`, { code: 'INVALID_STATE', subsystem: 'kernel', retryable: false });
    if (this._subsystems.some((existing) => existing.name === subsystem.name)) throw new AgyError(`Duplicate subsystem name '${subsystem.name}'`, { code: 'DUPLICATE_SUBSYSTEM', subsystem: 'kernel', retryable: false });
    this._subsystems.push(subsystem);
  }

  public async boot(config: KernelConfig = {}): Promise<KernelHandle> {
    if (this._state === 'ready') return this.createHandle();
    if (this._state !== 'uninitialized' && this._state !== 'shutdown') throw new AgyError(`Cannot boot kernel from state '${this._state}'`, { code: 'INVALID_STATE', subsystem: 'kernel', retryable: false });
    this._config = { ...config };
    this._kernelId = config.kernelId || asUUID(randomUUID());
    this._state = 'booting';
    this._bootedAt = Date.now();
    this._shutdownPromise = undefined;
    const booted: ISubsystem[] = [];

    try {
      this._container.clear();
      this._container.register('config', this._config);
      this._container.register('kernelId', this._kernelId);
      const maxBootRetries = validateNonNegativeInteger(config.maxBootRetries ?? 0, 'maxBootRetries');
      for (const subsystem of this._subsystems) {
        let lastError: unknown;
        let bootedSuccessfully = false;
        for (let attempt = 0; attempt <= maxBootRetries; attempt++) {
          try {
            await subsystem.boot();
            bootedSuccessfully = true;
            break;
          } catch (err) {
            lastError = err;
            try { await subsystem.shutdown(); } catch { /* retry still owns rollback */ }
          }
        }
        if (!bootedSuccessfully) throw lastError;
        booted.push(subsystem);
        this._container.register(subsystem.name, subsystem);
      }
      this._state = 'ready';
      return this.createHandle();
    } catch (err) {
      for (const subsystem of [...booted].reverse()) {
        try { await subsystem.shutdown(); } catch (rollbackError) { console.error(`Error during rollback shutdown of ${subsystem.name}:`, rollbackError); }
      }
      this._state = 'shutdown';
      throw new AgyError(`Kernel boot failed: ${err instanceof Error ? err.message : String(err)}`, { code: 'BOOT_FAILED', subsystem: 'kernel', retryable: false, cause: err });
    }
  }

  public async shutdown(): Promise<void> {
    if (this._state === 'shutdown') return;
    if (this._shutdownPromise) return this._shutdownPromise;
    this._state = 'draining';
    const timeoutMs = validateNonNegativeNumber(this._config.drainTimeoutMs ?? 5000, 'drainTimeoutMs');
    this._shutdownPromise = (async () => {
      for (const subsystem of [...this._subsystems].reverse()) {
        try {
          let timer: NodeJS.Timeout | undefined;
          const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Shutdown timeout for ${subsystem.name}`)), timeoutMs); });
          try { await Promise.race([subsystem.shutdown(), timeout]); }
          finally { if (timer) clearTimeout(timer); }
        } catch (err) { console.error(`Error shutting down subsystem ${subsystem.name}:`, err); }
      }
      this._state = 'shutdown';
    })();
    return this._shutdownPromise;
  }

  public async health(): Promise<Record<string, SubsystemHealth>> {
    const report: Record<string, SubsystemHealth> = {
      kernel: { status: this._state === 'ready' ? 'healthy' : this._state === 'degraded' ? 'degraded' : 'unhealthy', uptimeMs: this._bootedAt ? Date.now() - this._bootedAt : 0 },
    };
    const results = await Promise.all(this._subsystems.map(async (subsystem) => {
      try {
        let timer: NodeJS.Timeout | undefined;
        const timeout = new Promise<SubsystemHealth>((_, reject) => { timer = setTimeout(() => reject(new Error(`Health check timeout for ${subsystem.name}`)), 2000); });
        try { return { name: subsystem.name, health: await Promise.race([subsystem.health(), timeout]) }; }
        finally { if (timer) clearTimeout(timer); }
      } catch (err) {
        return { name: subsystem.name, health: { status: 'unhealthy' as const, lastError: err instanceof Error ? err.message : String(err), uptimeMs: 0 } };
      }
    }));
    let unhealthy = false;
    for (const result of results) { report[result.name] = result.health; if (result.health.status !== 'healthy') unhealthy = true; }
    if (this._state === 'ready' && unhealthy) report.kernel = { ...report.kernel, status: 'degraded' };
    return report;
  }

  private createHandle(): KernelHandle {
    const kernel = this;
    return {
      kernelId: this._kernelId,
      get state(): KernelLifecycleState { return kernel._state; },
      container: this._container,
      shutdown: () => this.shutdown(),
      health: () => this.health(),
    };
  }
}

function validateNonNegativeInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0) throw new RangeError(`${name} must be a non-negative integer`);
  return value;
}

function validateNonNegativeNumber(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and non-negative`);
  return value;
}
