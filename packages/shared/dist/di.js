"use strict";
/**
 * Lightweight Dependency Injection Container for Kernel Subsystems.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Container = void 0;
class Container {
    services = new Map();
    factories = new Map();
    register(token, instance) {
        this.services.set(token, instance);
    }
    registerFactory(token, factory) {
        this.factories.set(token, factory);
    }
    resolve(token) {
        if (this.services.has(token)) {
            return this.services.get(token);
        }
        if (this.factories.has(token)) {
            const instance = this.factories.get(token)(this);
            this.services.set(token, instance);
            return instance;
        }
        throw new Error(`[DI:CONTAINER] Service not registered for token: ${token}`);
    }
    has(token) {
        return this.services.has(token) || this.factories.has(token);
    }
    clear() {
        this.services.clear();
        this.factories.clear();
    }
}
exports.Container = Container;
//# sourceMappingURL=di.js.map