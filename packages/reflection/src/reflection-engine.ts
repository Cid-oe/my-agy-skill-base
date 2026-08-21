/**
 * Concrete Reflection Engine implementation.
 * Provides read-only introspection over runtime state snapshots,
 * lease metrics, and system diagnostics without state mutation paths (RFC-0011).
 */

import { SubsystemHealth, AgyError } from '@agy/shared';
import { IRuntimeState } from '@agy/runtime-state';
import { IReflectionEngine, ReflectionReport } from './interfaces.js';

export interface ReflectionEngineOptions {
  runtimeState: IRuntimeState;
}

export class ReflectionEngine implements IReflectionEngine {
  public readonly name = 'reflection';
  private _runtimeState: IRuntimeState;
  private _isReady = false;
  private _bootTime = 0;

  constructor(options: ReflectionEngineOptions) {
    this._runtimeState = options.runtimeState;
  }

  public async boot(): Promise<void> {
    this._isReady = true;
    this._bootTime = Date.now();
  }

  public async shutdown(): Promise<void> {
    this._isReady = false;
  }

  public health(): SubsystemHealth {
    return {
      status: this._isReady ? 'healthy' : 'unhealthy',
      uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0,
    };
  }

  public async inspectRuntime(): Promise<ReflectionReport> {
    if (!this._isReady) {
      throw new AgyError('ReflectionEngine is not ready', {
        code: 'REFLECTION_NOT_READY',
        subsystem: 'reflection',
        retryable: false,
      });
    }

    const snapshot = this._runtimeState.getSnapshot();
    const activeLeaseCount = Object.values(snapshot.leases).filter((l) => !l.revoked).length;
    const activePlanCount = snapshot.activePlans.length;

    const diagnostics: string[] = [
      `Kernel Runtime Version: ${snapshot.version}`,
      `Active Plans: ${activePlanCount}`,
      `Active Leases: ${activeLeaseCount}`,
    ];

    return {
      timestamp: Date.now(),
      runtimeVersion: snapshot.version,
      activePlanCount,
      activeLeaseCount,
      snapshot,
      diagnostics,
    };
  }
}
