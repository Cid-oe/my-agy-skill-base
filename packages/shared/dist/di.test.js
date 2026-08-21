"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const di_js_1 = require("./di.js");
const errors_js_1 = require("./errors.js");
(0, node_test_1.test)('Container registers and resolves singleton instance', () => {
    const container = new di_js_1.Container();
    const service = { name: 'testService' };
    container.register('test', service);
    node_assert_1.default.strictEqual(container.has('test'), true);
    node_assert_1.default.strictEqual(container.resolve('test'), service);
});
(0, node_test_1.test)('Container registers and resolves factory instance', () => {
    const container = new di_js_1.Container();
    let count = 0;
    container.registerFactory('factoryTest', () => {
        count++;
        return { count };
    });
    const first = container.resolve('factoryTest');
    const second = container.resolve('factoryTest');
    node_assert_1.default.strictEqual(first.count, 1);
    node_assert_1.default.strictEqual(second.count, 1); // cached after first resolution
    node_assert_1.default.strictEqual(count, 1);
});
(0, node_test_1.test)('Error hierarchy captures code, subsystem and retryable flags', () => {
    const err = new errors_js_1.ResolutionError('Could not resolve graph', { reason: 'cycle' }, false);
    node_assert_1.default.strictEqual(err instanceof errors_js_1.AgyError, true);
    node_assert_1.default.strictEqual(err.subsystem, 'resolver');
    node_assert_1.default.strictEqual(err.code, 'RESOLUTION_FAILED');
    node_assert_1.default.strictEqual(err.retryable, false);
});
//# sourceMappingURL=di.test.js.map