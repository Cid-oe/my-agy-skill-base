"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const index_js_1 = require("./index.js");
(0, node_test_1.test)('Playground simulation runs end-to-end sandbox check', async () => {
    const success = await (0, index_js_1.runPlaygroundSimulation)();
    node_assert_1.default.strictEqual(success, true);
});
//# sourceMappingURL=playground.test.js.map