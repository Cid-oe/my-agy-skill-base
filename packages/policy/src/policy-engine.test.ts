import { test } from 'node:test';
import assert from 'node:assert';
import { PolicyEngine } from './policy-engine.js';
import { IPolicy } from './interfaces.js';
import { RuntimeState } from '@agy/runtime-state';
import { PolicyRequest } from '@agy/shared';

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
    requestId: 'req-1',
    subject: 'skill-reader',
    capability: { name: 'fs:read', scope: '/project' },
  };

  const deniedReq: PolicyRequest = {
    requestId: 'req-2',
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
