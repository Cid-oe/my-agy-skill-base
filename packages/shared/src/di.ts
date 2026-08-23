/**
 * Lightweight dependency-injection container with collision-safe registration.
 */

export class Container {
  private services = new Map<string, unknown>();
  private factories = new Map<string, (container: Container) => unknown>();

  public register<T>(token: string, instance: T): void {
    this.validateToken(token);
    if (this.services.has(token) || this.factories.has(token)) throw new Error(`[DI:CONTAINER] Duplicate service token: ${token}`);
    this.services.set(token, instance);
  }

  public registerFactory<T>(token: string, factory: (container: Container) => T): void {
    this.validateToken(token);
    if (this.services.has(token) || this.factories.has(token)) throw new Error(`[DI:CONTAINER] Duplicate service token: ${token}`);
    this.factories.set(token, factory);
  }

  public resolve<T>(token: string): T {
    this.validateToken(token);
    if (this.services.has(token)) return this.services.get(token) as T;
    const factory = this.factories.get(token);
    if (factory) {
      const instance = factory(this);
      this.services.set(token, instance);
      this.factories.delete(token);
      return instance as T;
    }
    throw new Error(`[DI:CONTAINER] Service not registered for token: ${token}`);
  }

  public has(token: string): boolean { return this.services.has(token) || this.factories.has(token); }
  public clear(): void { this.services.clear(); this.factories.clear(); }
  private validateToken(token: string): void { if (!token || typeof token !== 'string') throw new TypeError('DI token must be a non-empty string'); }
}
