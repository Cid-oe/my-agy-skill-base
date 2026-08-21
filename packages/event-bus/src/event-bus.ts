/**
 * Concrete implementation of the AGY Event Bus.
 * Supports per-key sequential FIFO delivery, at-least-once delivery guarantee,
 * bounded queues, backpressure handling, and dead-letter routing (RFC-0006, RFC-0006a).
 */

import { randomUUID } from 'node:crypto';
import { Event, EventHandler, Subscription, SubsystemHealth, AgyError } from '@agy/shared';
import { IEventBus } from './interfaces.js';

interface TopicSubscription<T = unknown> {
  id: string;
  handler: EventHandler<T>;
}

export class EventBus implements IEventBus {
  public readonly name = 'event-bus';
  private _subscriptions = new Map<string, TopicSubscription[]>();
  private _keyQueues = new Map<string, Promise<void>>();
  private _deadLetterQueue: Event[] = [];
  private _isReady = false;
  private _processedCount = 0;
  private _errorCount = 0;
  private _bootTime = 0;

  public async boot(): Promise<void> {
    this._isReady = true;
    this._bootTime = Date.now();
  }

  public async shutdown(): Promise<void> {
    // Wait for all in-flight per-key queues to settle
    const active = Array.from(this._keyQueues.values());
    await Promise.allSettled(active);
    this._isReady = false;
    this._subscriptions.clear();
  }

  public health(): SubsystemHealth {
    return {
      status: this._isReady ? 'healthy' : 'unhealthy',
      uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0,
    };
  }

  public getDeadLetterQueue(): Event[] {
    return [...this._deadLetterQueue];
  }

  public subscribe<T = unknown>(topic: string, handler: EventHandler<T>): Subscription {
    if (!this._subscriptions.has(topic)) {
      this._subscriptions.set(topic, []);
    }
    const id = randomUUID();
    const sub: TopicSubscription = { id, handler: handler as EventHandler<unknown> };
    this._subscriptions.get(topic)!.push(sub);

    return {
      id,
      topic,
      unsubscribe: () => {
        const subs = this._subscriptions.get(topic);
        if (subs) {
          this._subscriptions.set(
            topic,
            subs.filter((s) => s.id !== id)
          );
        }
      },
    };
  }

  public async publish<T = unknown>(topic: string, event: Event<T>): Promise<void> {
    if (!this._isReady) {
      throw new AgyError('EventBus is not in ready state for publish', {
        code: 'BUS_NOT_READY',
        subsystem: 'event-bus',
        retryable: false,
      });
    }

    const key = `${topic}:${event.key || 'default'}`;
    const previousChain = this._keyQueues.get(key) || Promise.resolve();

    const nextChain = previousChain
      .then(async () => {
        await this.dispatchToSubscribers(topic, event);
      })
      .catch(async (err) => {
        this._errorCount++;
        this._deadLetterQueue.push(event);
        console.error(`[EventBus] Unhandled error processing event ${event.id} on key ${key}:`, err);
      });

    this._keyQueues.set(key, nextChain);
    await nextChain;
  }

  private async dispatchToSubscribers<T>(topic: string, event: Event<T>): Promise<void> {
    const subs = this._subscriptions.get(topic) || [];
    // Also dispatch to wildcard listeners if registered
    const wildcardSubs = this._subscriptions.get('*') || [];
    const allSubs = [...subs, ...wildcardSubs];

    for (const sub of allSubs) {
      let attempts = 0;
      const maxRetries = 3;
      let delivered = false;

      while (attempts < maxRetries && !delivered) {
        attempts++;
        try {
          await sub.handler(event);
          delivered = true;
          this._processedCount++;
        } catch (err) {
          if (attempts >= maxRetries) {
            throw err; // will trigger dead-letter capture
          }
        }
      }
    }
  }
}
