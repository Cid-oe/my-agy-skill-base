/**
 * Concrete Skill Registry implementation.
 * Stores validated manifests, maintains inverted capability and produces indices,
 * manages quarantining, and integrates with the Event Bus (RFC-0002).
 */
import { SkillHandle, SkillManifest, SubsystemHealth } from '@agy/shared';
import { IEventBus } from '@agy/event-bus';
import { ISkillRegistry, QuarantineRecord } from './interfaces.js';
export interface SkillRegistryOptions {
    eventBus?: IEventBus;
}
export declare class SkillRegistry implements ISkillRegistry {
    readonly name = "skill-registry";
    private _manifests;
    private _activeVersions;
    private _byProduces;
    private _byCapability;
    private _quarantine;
    private _isReady;
    private _bootTime;
    private _eventBus?;
    constructor(options?: SkillRegistryOptions);
    boot(): Promise<void>;
    shutdown(): Promise<void>;
    health(): SubsystemHealth;
    register(manifest: SkillManifest, sourceRoot?: string): Promise<SkillHandle>;
    unregister(id: string): Promise<boolean>;
    getManifest(id: string, version?: string): SkillManifest | null;
    getActiveVersion(id: string): SkillManifest | null;
    listAll(): SkillManifest[];
    findByProduces(artifactType: string): SkillManifest[];
    findByCapability(tag: string): SkillManifest[];
    getQuarantined(): QuarantineRecord[];
}
//# sourceMappingURL=registry.d.ts.map