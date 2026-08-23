import * as assert from 'node:assert';
import { describe, it } from 'node:test';
import { SkillOptRegistryHook } from '../registry-hook.js';
import { makeTestConfig } from '../config.js';
import { EventBusStats } from '@agy/event-bus';
import { Subscription } from '@agy/shared';

describe('SkillOptRegistryHook', () => {
  it('should initialize and subscribe to events', async () => {
    const subscribedTopics: string[] = [];
    const mockEventBus = {
      id: 'mock',
      name: 'mock',
      async start() {},
      async stop() {},
      async getHealth() { return { status: 'healthy', uptimeMs: 0 }; },
      health() { return { status: 'healthy', uptimeMs: 0 }; },
      async publish() {},
      subscribe(topic: string): Subscription {
        subscribedTopics.push(topic);
        return { id: 'test' as any, topic, unsubscribe: () => {} };
      },
      getDeadLetterQueue: () => [],
      clearDeadLetters: () => {},
      getStats: (): EventBusStats => ({ processedCount: 0, errorCount: 0, deadLetterCount: 0, activeKeyQueues: 0 })
    };
    
    const hook = new SkillOptRegistryHook({
      eventBus: mockEventBus as any,
      artifactStore: {} as any,
      config: makeTestConfig()
    });

    await hook.boot();
    assert.ok(subscribedTopics.includes('executor.task.started'));
    assert.ok(subscribedTopics.includes('executor.task.finished'));
    assert.ok(subscribedTopics.includes('executor.task.failed'));
  });
});
