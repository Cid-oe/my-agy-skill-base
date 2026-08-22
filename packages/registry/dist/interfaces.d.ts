/**
 * Skill Registry & Loader interfaces and contracts.
 * Strictly implements Phase 3 (ISkillRegistry, ISkillLoader) and RFC-0002 / RFC-0002a.
 */
import { SkillHandle, SkillManifest, SubsystemHealth } from '@agy/shared';
import { ISubsystem } from '@agy/shared';
export interface LoadedSkill {
    readonly manifest: SkillManifest;
    readonly handle: SkillHandle;
    refCount: number;
    execute(context: Record<string, unknown>): Promise<unknown>;
    dispose(): Promise<void>;
}
export interface QuarantineRecord {
    path: string;
    reason: string;
    errors: string[];
    timestamp: number;
}
export interface ISkillRegistry extends ISubsystem {
    register(manifest: SkillManifest, sourceRoot?: string): Promise<SkillHandle>;
    unregister(id: string): Promise<boolean>;
    getManifest(id: string, version?: string): SkillManifest | null;
    getActiveVersion(id: string): SkillManifest | null;
    listAll(): SkillManifest[];
    findByProduces(artifactType: string): SkillManifest[];
    findByCapability(tag: string): SkillManifest[];
    getQuarantined(): QuarantineRecord[];
    scan(roots: string[]): Promise<SkillManifest[]>;
    health(): Promise<SubsystemHealth> | SubsystemHealth;
}
export interface ISkillLoader extends ISubsystem {
    load(id: string, version?: string): Promise<LoadedSkill>;
    acquire(id: string): Promise<LoadedSkill>;
    release(target: string | LoadedSkill): Promise<void>;
    unload(id: string): Promise<boolean>;
    reload(id: string): Promise<LoadedSkill>;
    getLoaded(id: string): LoadedSkill | null;
    health(): Promise<SubsystemHealth> | SubsystemHealth;
}
//# sourceMappingURL=interfaces.d.ts.map