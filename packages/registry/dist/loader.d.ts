/**
 * Concrete Skill Loader implementation.
 * Manages loaded executable skill instances, lifecycle state transitions,
 * in-flight task reference counting, and the RFC-0002a drain/hot-reload protocol.
 */
import { SubsystemHealth, UUID } from '@agy/shared';
import { IEventBus } from '@agy/event-bus';
import { ISkillLoader, ISkillRegistry, LoadedSkill } from './interfaces.js';
export interface SkillLoaderOptions {
    registry: ISkillRegistry;
    eventBus?: IEventBus;
    drainTimeoutMs?: number;
}
export declare class SkillLoader implements ISkillLoader {
    readonly id: UUID;
    readonly name = "skill-loader";
    start(): Promise<void>;
    stop(): Promise<void>;
    getHealth(): Promise<SubsystemHealth>;
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
    acquire(id: string): Promise<LoadedSkill>;
    release(target: string | LoadedSkill): Promise<void>;
    unload(id: string): Promise<boolean>;
    reload(id: string): Promise<LoadedSkill>;
}
//# sourceMappingURL=loader.d.ts.map