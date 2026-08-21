"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const fixtures_js_1 = require("./fixtures.js");
(0, node_test_1.test)('Testkit generates synthetic manifests and large catalogs', () => {
    const single = (0, fixtures_js_1.generateSyntheticManifest)('test-1');
    node_assert_1.default.strictEqual(single.id, 'test-1');
    node_assert_1.default.strictEqual(single.produces[0], 'Artifact-test-1');
    const catalog = (0, fixtures_js_1.generateSyntheticCatalog)(100);
    node_assert_1.default.strictEqual(catalog.length, 100);
    node_assert_1.default.strictEqual(catalog[99].id, 'skill-99');
});
//# sourceMappingURL=testkit.test.js.map