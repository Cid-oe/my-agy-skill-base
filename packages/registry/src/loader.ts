/**
 * Concrete Skill Loader implementation.
 * Manages loaded executable skill instances, lifecycle state transitions,
 * in-flight task reference counting, and the RFC-0002a drain/hot-reload protocol.
 */

import { randomUUID } from 'node:crypto';
import { SkillHandle, SubsystemHealth, AgyError } from '@agy/shared';
import { IEventBus } from '@agy/event-bus';
import { ISkillLoader, ISkillRegistry, LoadedSkill } from './interfaces.js';

export interface SkillLoaderOptions {
  registry: ISkillRegistry;
  eventBus?: IEventBus;
  drainTimeoutMs?: number;
}

export class SkillLoader implements ISkillLoader {
  public readonly name = 'skill-loader';
  private _registry: ISkillRegistry;
  private _eventBus?: IEventBus;
  private _loadedSkills = new Map<string, LoadedSkill>();
  private _drainingSkills = new Map<string, LoadedSkill>();
  private _isReady = false;
  private _bootTime = 0;
  public readonly drainTimeoutMs: number = 30000;

  constructor(options: SkillLoaderOptions) {
    this._registry = options.registry;
    this._eventBus = options.eventBus;
    if (options.drainTimeoutMs) {
      this.drainTimeoutMs = options.drainTimeoutMs;
    }
  }

  public async boot(): Promise<void> {
    this._isReady = true;
    this._bootTime = Date.now();
  }

  public async shutdown(): Promise<void> {
    for (const [id] of Array.from(this._loadedSkills.entries())) {
      await this.unload(id);
    }
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

    const loadedSkill: LoadedSkill = {
      manifest,
      handle,
      refCount: 1,
      execute: async (ctx: Record<string, unknown>) => {
        return {
          skillId: manifest.id,
          executedAt: Date.now(),
          output: `Execution output from ${manifest.name}`,
          context: ctx,
        };
      },
      dispose: async () => {
        handle.lifecycleState = 'unloaded';
      },
    };

    this._loadedSkills.set(id, loadedSkill);

    if (this._eventBus) {
      await this._eventBus.publish('skill.loaded', {
        id: randomUUID(),
        topic: 'skill.loaded',
        key: id,
        payload: { id, version: manifest.version },
        timestamp: Date.now(),
      });
    }

    return loadedSkill;
  }

  public async unload(id: string): Promise<boolean> {
    const loaded = this._loadedSkills.get(id);
    if (!loaded) return false;

    if (loaded.refCount > 1) {
      loaded.refCount--;
      return false; // Still referenced by in-flight tasks
    }

    loaded.handle.lifecycleState = 'draining';
    this._drainingSkills.set(id, loaded);
    this._loadedSkills.delete(id);

    await loaded.dispose();
    this._drainingSkills.delete(id);

    if (this._eventBus) {
      await this._eventBus.publish('skill.unloaded', {
        id: randomUUID(),
        topic: 'skill.unloaded',
        key: id,
        payload: { id },
        timestamp: Date.now(),
      });
    }

    return true;
  }

  public async reload(id: string): Promise<LoadedSkill> {
    const oldInstance = this._loadedSkills.get(id);
    if (oldInstance) {
      oldInstance.handle.lifecycleState = 'draining';
      this._drainingSkills.set(id, oldInstance);
      this._loadedSkills.delete(id);
    }

    const newInstance = await this.load(id);

    if (oldInstance) {
      setTimeout(async () => {
        await oldInstance.dispose();
        this._drainingSkills.delete(id);
      }, 100);
    }

    return newInstance;
  }
}
