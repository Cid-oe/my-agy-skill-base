"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const kernel_js_1 = require("./kernel.js");
class MockSubsystem {
    name;
    booted = false;
    shutDown = false;
    constructor(name) {
        this.name = name;
    }
    async boot() {
        this.booted = true;
    }
    async shutdown() {
        this.shutDown = true;
    }
    health() {
        return { status: 'healthy', uptimeMs: 100 };
    }
}
(0, node_test_1.test)('Kernel boots subsystems in order and reaches ready state', async () => {
    const kernel = new kernel_js_1.Kernel();
    const sub1 = new MockSubsystem('sub1');
    const sub2 = new MockSubsystem('sub2');
    kernel.registerSubsystem(sub1);
    kernel.registerSubsystem(sub2);
    const handle = await kernel.boot();
    node_assert_1.default.strictEqual(handle.state, 'ready');
    node_assert_1.default.strictEqual(sub1.booted, true);
    node_assert_1.default.strictEqual(sub2.booted, true);
    // Verification of health aggregation
    const health = await handle.health();
    node_assert_1.default.strictEqual(health['kernel'].status, 'healthy');
    node_assert_1.default.strictEqual(health['sub1'].status, 'healthy');
    node_assert_1.default.strictEqual(health['sub2'].status, 'healthy');
    // Verification of graceful shutdown
    await handle.shutdown();
    node_assert_1.default.strictEqual(kernel.state, 'shutdown');
    node_assert_1.default.strictEqual(sub1.shutDown, true);
    node_assert_1.default.strictEqual(sub2.shutDown, true);
});
(0, node_test_1.test)('Kernel shutdown is idempotent', async () => {
    const kernel = new kernel_js_1.Kernel();
    await kernel.boot();
    await kernel.shutdown();
    await kernel.shutdown(); // second call must succeed without error
    node_assert_1.default.strictEqual(kernel.state, 'shutdown');
});
(0, node_test_1.test)('Kernel rolls back booted subsystems in reverse order on boot failure', async () => {
    const kernel = new kernel_js_1.Kernel();
    const sub1 = new MockSubsystem('sub1');
    const subFail = new MockSubsystem('subFail');
    subFail.boot = async () => {
        throw new Error('Explosion during boot');
    };
    kernel.registerSubsystem(sub1);
    kernel.registerSubsystem(subFail);
    await node_assert_1.default.rejects(async () => {
        await kernel.boot();
    }, (err) => {
        return err.code === 'BOOT_FAILED';
    });
    node_assert_1.default.strictEqual(kernel.state, 'shutdown');
    node_assert_1.default.strictEqual(sub1.booted, true);
    node_assert_1.default.strictEqual(sub1.shutDown, true); // Rolled back cleanly!
});
(0, node_test_1.test)('Kernel handles hanging subsystem health checks gracefully', async () => {
    const kernel = new kernel_js_1.Kernel();
    const sub1 = new MockSubsystem('sub1');
    const subHanging = new MockSubsystem('subHanging');
    subHanging.health = async () => {
        await new Promise((r) => setTimeout(r, 5000));
        return { status: 'healthy', uptimeMs: 0 };
    };
    kernel.registerSubsystem(sub1);
    kernel.registerSubsystem(subHanging);
    await kernel.boot();
    const health = await kernel.health();
    node_assert_1.default.strictEqual(health['sub1'].status, 'healthy');
    node_assert_1.default.strictEqual(health['subHanging'].status, 'unhealthy');
    await kernel.shutdown();
});
//# sourceMappingURL=kernel.test.js.map