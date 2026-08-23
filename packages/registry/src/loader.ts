/**
 * Concrete Skill Loader implementation.
 * Manages loaded executable skill instances, lifecycle state transitions,
 * in-flight task reference counting, and the RFC-0002a drain/hot-reload protocol.
 */

import { randomUUID } from 'node:crypto';
import { SkillHandle, SubsystemHealth, AgyError, UUID, asUUID } from '@agy/shared';
import { IEventBus } from '@agy/event-bus';
import { ISkillLoader, ISkillRegistry, LoadedSkill } from './interfaces.js';

export interface SkillLoaderOptions {
  registry: ISkillRegistry;
  eventBus?: IEventBus;
  drainTimeoutMs?: number;
}

export class SkillLoader implements ISkillLoader {
  public readonly id: UUID = asUUID('skill-loader');
  public readonly name = 'skill-loader';

  public async start(): Promise<void> { await this.boot(); }

  public async stop(): Promise<void> { await this.shutdown(); }

  public async getHealth(): Promise<SubsystemHealth> { return Promise.resolve(this.health()); }
  private _registry: ISkillRegistry;
  private _eventBus?: IEventBus;
  private _loadedSkills = new Map<string, LoadedSkill>();
  private _drainingSkills = new Map<string, LoadedSkill>();
  private _drainTimers = new Map<string, NodeJS.Timeout>();
  private _isReady = false;
  private _bootTime = 0;
  public readonly drainTimeoutMs: number = 30000;

  constructor(options: SkillLoaderOptions) {
    this._registry = options.registry;
    this._eventBus = options.eventBus;
    if (options.drainTimeoutMs !== undefined) {
      if (!Number.isFinite(options.drainTimeoutMs) || options.drainTimeoutMs <= 0) throw new RangeError('drainTimeoutMs must be a positive finite number');
      this.drainTimeoutMs = options.drainTimeoutMs;
    }
  }

  public async boot(): Promise<void> {
    this._isReady = true;
    this._bootTime = Date.now();
  }

  public async shutdown(): Promise<void> {
    // Dispose loaded skills immediately and cancel any pending drain timers.
    for (const [, skill] of Array.from(this._loadedSkills.entries())) {
      await skill.dispose();
    }
    this._loadedSkills.clear();
    for (const [, skill] of Array.from(this._drainingSkills.entries())) {
      await skill.dispose();
    }
    this._drainingSkills.clear();
    this.clearDrainTimers();
    this._isReady = false;
  }

  public health(): SubsystemHealth {
    return {
      status: this._isReady ? 'healthy' : 'unhealthy',
      uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0,
    };
  }

  public getLoaded(id: string): LoadedSkill | null {
    return this._loadedSkills.get(id) || null;
  }

  public async load(id: string, version?: string): Promise<LoadedSkill> {
    if (!this._isReady) {
      throw new AgyError('SkillLoader is not ready', {
        code: 'LOADER_NOT_READY',
        subsystem: 'registry',
        retryable: false,
      });
    }

    if (this._loadedSkills.has(id)) {
      const existing = this._loadedSkills.get(id)!;
      if (version && existing.manifest.version !== version) {
        throw new AgyError(`Skill ${id} version ${version} conflicts with loaded version ${existing.manifest.version}`, {
          code: 'SKILL_VERSION_CONFLICT', subsystem: 'registry', retryable: false,
        });
      }
      existing.refCount++;
      return existing;
    }

    const manifest = this._registry.getManifest(id, version);
    if (!manifest) {
      throw new AgyError(`Skill ${id} not found in registry`, {
        code: 'SKILL_NOT_FOUND',
        subsystem: 'registry',
        retryable: false,
      });
    }

    const handle: SkillHandle = {
      id: manifest.id,
      version: manifest.version,
      registryRef: `registry://${manifest.id}@${manifest.version}`,
      lifecycleState: 'loaded',
    };

    // Resolve an executable module path. A skill with a resolvable modulePath
    // is executed by the executor in a restricted child process (SRC-1/2/3).
    // A skill without one is declarative and uses the serialized adapter below.
    const modulePath = manifest.modulePath;

    const loadedSkill: LoadedSkill = {
      manifest,
      handle,
      refCount: 1,
      modulePath,
      // Declarative passthrough for skills that ship no executable module.
      // Module-backed skills bypass this via the executor's worker path.
      execute: async (ctx: Record<string, unknown>) => {
        return {
          skillId: manifest.id,
          executedAt: Date.now(),
          declarative: true,
          echoed: ctx,
        };
      },
      dispose: async () => {
        handle.lifecycleState = 'unloaded';
      },
    };

    this._loadedSkills.set(id, loadedSkill);

    if (this._eventBus) {
      await this._eventBus.publish('skill.loaded', {
        id: asUUID(randomUUID()),
        topic: 'skill.loaded',
        key: id,
        payload: { id, version: manifest.version },
        timestamp: Date.now(),
      });
    }

    return loadedSkill;
  }

  public async acquire(id: string): Promise<LoadedSkill> {
    const loaded = this._loadedSkills.get(id);
    if (loaded) {
      loaded.refCount++;
      return loaded;
    }
    return this.load(id);
  }

  public async release(target: string | LoadedSkill): Promise<void> {
    const instance =
      typeof target === 'string'
        ? this._drainingSkills.get(target) || this._loadedSkills.get(target)
        : target;

    if (!instance) return;

    if (instance.refCount > 0) {
      instance.refCount--;
    }

    if (instance.handle.lifecycleState === 'draining' && instance.refCount <= 0) {
      await instance.dispose();
      this._drainingSkills.delete(instance.manifest.id);
      this.clearDrainTimer(instance.manifest.id);
    }
  }

  public async unload(id: string): Promise<boolean> {
    const loaded = this._loadedSkills.get(id);
    if (!loaded) return false;

    this._loadedSkills.delete(id);

    if (loaded.refCount > 0) {
      loaded.handle.lifecycleState = 'draining';
      this._drainingSkills.set(id, loaded);
      // RFC-0002a drain: let in-flight references finish, but bound it by
      // drainTimeoutMs via a background timer (non-blocking) (SRC-18).
      this.scheduleDrain(id);
    } else {
      await loaded.dispose();
    }

    if (this._eventBus) {
      await this._eventBus.publish('skill.unloaded', {
        id: asUUID(randomUUID()),
        topic: 'skill.unloaded',
        key: id,
        payload: { id },
        timestamp: Date.now(),
      });
    }

    return true;
  }

  /**
   * Schedule a background forced disposal of a draining skill after
   * drainTimeoutMs. If in-flight references release first, `release` disposes
   * it and clears the timer. This makes the drain timeout enforceable without
   * blocking callers.
   */
  private scheduleDrain(id: string): void {
    const existing = this._drainTimers.get(id);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(() => {
      this._drainTimers.delete(id);
      const skill = this._drainingSkills.get(id);
      if (skill) {
        void skill.dispose();
        this._drainingSkills.delete(id);
      }
    }, this.drainTimeoutMs);
    // Don't keep the event loop alive solely for a drain deadline.
    timer.unref?.();
    this._drainTimers.set(id, timer);
  }

  private clearDrainTimer(id: string): void {
    const timer = this._drainTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this._drainTimers.delete(id);
    }
  }

  private clearDrainTimers(): void {
    for (const timer of this._drainTimers.values()) {
      clearTimeout(timer);
    }
    this._drainTimers.clear();
  }

  public async reload(id: string): Promise<LoadedSkill> {
    const oldInstance = this._loadedSkills.get(id);
    if (oldInstance) {
      oldInstance.handle.lifecycleState = 'draining';
      this._drainingSkills.set(id, oldInstance);
      this._loadedSkills.delete(id);

      if (oldInstance.refCount === 0) {
        await oldInstance.dispose();
        this._drainingSkills.delete(id);
      }
    }

    return this.load(id);
  }
}
