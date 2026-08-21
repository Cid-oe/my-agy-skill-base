/**
 * Lightweight Dependency Injection Container for Kernel Subsystems.
 */
export declare class Container {
    private services;
    private factories;
    register<T>(token: string, instance: T): void;
    registerFactory<T>(token: string, factory: (c: Container) => T): void;
    resolve<T>(token: string): T;
    has(token: string): boolean;
    clear(): void;
}
//# sourceMappingURL=di.d.ts.map