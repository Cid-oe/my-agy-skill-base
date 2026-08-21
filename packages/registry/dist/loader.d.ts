/**
 * Concrete Skill Loader implementation.
 * Manages loaded executable skill instances, lifecycle state transitions,
 * in-flight task reference counting, and the RFC-0002a drain/hot-reload protocol.
 */
import { SubsystemHealth } from '@agy/shared';
import { IEventBus } from '@agy/event-bus';
import { ISkillLoader, ISkillRegistry, LoadedSkill } from './interfaces.js';
export interface SkillLoaderOptions {
    registry: ISkillRegistry;
    eventBus?: IEventBus;
    drainTimeoutMs?: number;
}
export declare class SkillLoader implements ISkillLoader {
    readonly name = "skill-loader";
    private _registry;
    private _eventBus?;
    private _loadedSkills;
    private _drainingSkills;
    private _isReady;
    private _bootTime;
    readonly drainTimeoutMs: number;
    constructor(options: SkillLoaderOptions);
    boot(): Promise<void>;
    shutdown(): Promise<void>;
    health(): SubsystemHealth;
    getLoaded(id: string): LoadedSkill | null;
    load(id: string, version?: string): Promise<LoadedSkill>;
    unload(id: string): Promise<boolean>;
    reload(id: string): Promise<LoadedSkill>;
}
//# sourceMappingURL=loader.d.ts.map