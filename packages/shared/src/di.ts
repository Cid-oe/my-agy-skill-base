/**
 * Lightweight Dependency Injection Container for Kernel Subsystems.
 */

export class Container {
  private services = new Map<string, unknown>();
  private factories = new Map<string, (c: Container) => unknown>();

  public register<T>(token: string, instance: T): void {
    this.services.set(token, instance);
  }

  public registerFactory<T>(token: string, factory: (c: Container) => T): void {
    this.factories.set(token, factory);
  }

  public resolve<T>(token: string): T {
    if (this.services.has(token)) {
      return this.services.get(token) as T;
    }
    if (this.factories.has(token)) {
      const instance = this.factories.get(token)!(this);
      this.services.set(token, instance);
      return instance as T;
    }
    throw new Error(`[DI:CONTAINER] Service not registered for token: ${token}`);
  }

  public has(token: string): boolean {
    return this.services.has(token) || this.factories.has(token);
  }

  public clear(): void {
    this.services.clear();
    this.factories.clear();
  }
}
