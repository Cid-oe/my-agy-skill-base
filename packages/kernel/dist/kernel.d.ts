/**
 * Concrete implementation of the AGY Kernel composition root.
 * Enforces Phase 5 dependency-ordered startup and graceful drain/shutdown.
 */
import { Container, SubsystemHealth } from '@agy/shared';
import { IKernel, ISubsystem, KernelConfig, KernelHandle, KernelLifecycleState } from './interfaces.js';
export declare class Kernel implements IKernel {
    private _state;
    private _kernelId;
    private _container;
    private _subsystems;
    private _config;
    private _bootedAt;
    constructor(container?: Container);
    get state(): KernelLifecycleState;
    getContainer(): Container;
    registerSubsystem(subsystem: ISubsystem): void;
    boot(config?: KernelConfig): Promise<KernelHandle>;
    shutdown(): Promise<void>;
    health(): Promise<Record<string, SubsystemHealth>>;
    private createHandle;
}
//# sourceMappingURL=kernel.d.ts.map