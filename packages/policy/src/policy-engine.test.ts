import { test } from 'node:test';
import assert from 'node:assert';
import { PolicyEngine } from './policy-engine.js';
import { IPolicy } from './interfaces.js';
import { RuntimeState } from '@agy/runtime-state';
import { PolicyRequest, asUUID } from '@agy/shared';

test('PolicyEngine enforces Deny-Overrides and Priority Precedence', async () => {
  const engine = new PolicyEngine();
  await engine.boot();

  const allowPolicy: IPolicy = {
    name: 'GeneralAllow',
    priority: 100,
    evaluate: (req) => ({
      requestId: req.requestId,
      subject: req.subject,
      capability: req.capability,
      decision: 'allow',
      reason: 'General allow rule',
      policyVersion: '1.0.0',
    }),
  };

  const securityDenyPolicy: IPolicy = {
    name: 'SecurityDeny',
    priority: 1, // High priority
    evaluate: (req) => {
      if (req.capability.name === 'fs:delete_root') {
        return {
          requestId: req.requestId,
          subject: req.subject,
          capability: req.capability,
          decision: 'deny',
          reason: 'Protected root path violation',
          policyVersion: '1.0.0',
        };
      }
      return {
        requestId: req.requestId,
        subject: req.subject,
        capability: req.capability,
        decision: 'allow',
        reason: 'Safe capability',
        policyVersion: '1.0.0',
      };
    },
  };

  engine.registerPolicy(allowPolicy);
  engine.registerPolicy(securityDenyPolicy);

  const safeReq: PolicyRequest = {
    requestId: asUUID('req-1'),
    subject: 'skill-reader',
    capability: { name: 'fs:read', scope: '/project' },
  };

  const deniedReq: PolicyRequest = {
    requestId: asUUID('req-2'),
    subject: 'skill-rogue',
    capability: { name: 'fs:delete_root', scope: '/' },
  };

  const safeDecision = await engine.evaluate(safeReq);
  assert.strictEqual(safeDecision.decision, 'allow');

  const denyDecision = await engine.evaluate(deniedReq);
  assert.strictEqual(denyDecision.decision, 'deny');
  assert.strictEqual(denyDecision.reason, 'Protected root path violation');

  await engine.shutdown();
});

test('PolicyEngine issues and validates Leases against RuntimeState', async () => {
  const state = new RuntimeState();
  await state.boot();

  const engine = new PolicyEngine({ runtimeState: state });
  await engine.boot();

  const lease = await engine.issueLease(
    'agent-worker-1',
    [{ name: 'network:outbound', scope: 'api.google.com' }],
    60000
  );

  const isValid = await engine.validateLease(lease.leaseId, {
    name: 'network:outbound',
    scope: 'api.google.com',
  });
  assert.strictEqual(isValid, true);

  const isInvalidCapability = await engine.validateLease(lease.leaseId, {
    name: 'fs:write',
    scope: '/etc',
  });
  assert.strictEqual(isInvalidCapability, false);

  // Revoke lease
  await engine.revokeLease(lease.leaseId);
  const isPostRevokeValid = await engine.validateLease(lease.leaseId, {
    name: 'network:outbound',
    scope: 'api.google.com',
  });
  assert.strictEqual(isPostRevokeValid, false);

  await engine.shutdown();
  await state.shutdown();
});

test('PolicyEngine enforces fail-closed default when 0 policies registered', async () => {
  const engine = new PolicyEngine();
  await engine.boot();

  const decision = await engine.evaluate({
    requestId: asUUID('req-fail-closed'),
    subject: 'untrusted-agent',
    capability: { name: 'fs:read', scope: '/project' },
  });

  assert.strictEqual(decision.decision, 'deny');
  assert.strictEqual(decision.reason, 'Default deny: No matching permit policy');

  await engine.shutdown();
});

test('PolicyEngine validates subpath scope containment constraints', async () => {
  const state = new RuntimeState();
  await state.boot();

  const engine = new PolicyEngine({ runtimeState: state });
  await engine.boot();

  const lease = await engine.issueLease(
    'scoped-worker',
    [{ name: 'fs:read', scope: '/workspace/project' }],
    60000
  );

  // Subpath within /workspace/project should match
  const validSubpath = await engine.validateLease(lease.leaseId, {
    name: 'fs:read',
    scope: '/workspace/project/src/index.ts',
  });
  assert.strictEqual(validSubpath, true);

  // Path outside scope should be rejected
  const invalidPath = await engine.validateLease(lease.leaseId, {
    name: 'fs:read',
    scope: '/etc/passwd',
  });
  assert.strictEqual(invalidPath, false);

  await engine.shutdown();
  await state.shutdown();
});

test('PolicyEngine rejects prefix-collision and path-traversal scope bypasses (EX-3, EX-4)', async () => {
  const state = new RuntimeState();
  await state.boot();

  const engine = new PolicyEngine({ runtimeState: state });
  await engine.boot();

  // Prefix collision: '/data/priv' must NOT cover '/data/private'
  const collisionLease = await engine.issueLease(
    'collision-worker',
    [{ name: 'fs:read', scope: '/data/priv' }],
    60000
  );
  const collision = await engine.validateLease(collisionLease.leaseId, {
    name: 'fs:read',
    scope: '/data/private',
  });
  assert.strictEqual(collision, false, 'prefix collision must be rejected');

  // Path traversal: '/workspace/project' must NOT cover escaped paths
  const traversalLease = await engine.issueLease(
    'traversal-worker',
    [{ name: 'fs:read', scope: '/workspace/project' }],
    60000
  );
  const traversal = await engine.validateLease(traversalLease.leaseId, {
    name: 'fs:read',
    scope: '/workspace/project/../../../etc/passwd',
  });
  assert.strictEqual(traversal, false, 'path traversal must be rejected');

  // Sibling directory must also be rejected
  const sibling = await engine.validateLease(traversalLease.leaseId, {
    name: 'fs:read',
    scope: '/workspace/project-secrets',
  });
  assert.strictEqual(sibling, false, 'sibling prefix must be rejected');

  // Legitimate deep subpath must STILL be allowed (regression guard)
  const deep = await engine.validateLease(traversalLease.leaseId, {
    name: 'fs:read',
    scope: '/workspace/project/src/index.ts',
  });
  assert.strictEqual(deep, true, 'legitimate subpath must remain allowed');

  await engine.shutdown();
  await state.shutdown();
});

test('PolicyEngine rejects expired leases and sweeps them from state', async () => {
  const state = new RuntimeState();
  await state.boot();

  const engine = new PolicyEngine({ runtimeState: state });
  await engine.boot();

  // Create lease that expires in 10ms
  const lease = await engine.issueLease(
    'expiring-worker',
    [{ name: 'fs:read', scope: '*' }],
    10
  );

  await new Promise((resolve) => setTimeout(resolve, 25));

  // Should fail validation due to expiry
  const valid = await engine.validateLease(lease.leaseId, {
    name: 'fs:read',
    scope: '/any/path',
  });
  assert.strictEqual(valid, false);

  // Sweep expired leases
  const sweptCount = await engine.sweepExpiredLeases();
  assert.strictEqual(sweptCount, 1);
  assert.strictEqual(state.getLease(lease.leaseId)?.revoked, true);

  await engine.shutdown();
  await state.shutdown();
});
