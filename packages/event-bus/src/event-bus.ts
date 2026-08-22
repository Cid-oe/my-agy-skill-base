/**
 * Concrete implementation of the AGY Event Bus.
 * Supports per-key sequential FIFO delivery, at-least-once delivery guarantee,
 * bounded queues, backpressure handling, and dead-letter routing (RFC-0006, RFC-0006a).
 */

import { randomUUID } from 'node:crypto';
import { Event, EventHandler, Subscription, SubsystemHealth, AgyError, UUID, asUUID } from '@agy/shared';
import { EventBusOptions, IEventBus } from './interfaces.js';

interface TopicSubscription<T = unknown> {
  id: UUID;
  handler: EventHandler<T>;
}

interface QueueItem {
  topic: string;
  event: Event<unknown>;
  resolve: () => void;
  reject: (err: unknown) => void;
}

interface KeyQueue {
  items: QueueItem[];
  running: boolean;
}

export class EventBus implements IEventBus {
  public readonly id: UUID = asUUID('event-bus');
  public readonly name = 'event-bus';

  private _keyQueues = new Map<string, KeyQueue>();
  private _deadLetterQueue: Event[] = [];
  private _isReady = false;
  private _processedCount = 0;
  private _errorCount = 0;
  private _bootTime = 0;
  private _subscriptions = new Map<string, TopicSubscription[]>();

  private _maxQueueLengthPerKey: number;
  private _maxRetries: number;
  private _backoffBaseMs: number;
  private _maxDeadLetters: number;

  constructor(options: EventBusOptions = {}) {
    this._maxQueueLengthPerKey = options.maxQueueLengthPerKey ?? 1000;
    this._maxRetries = options.maxRetries ?? 3;
    this._backoffBaseMs = options.backoffBaseMs ?? 50;
    this._maxDeadLetters = options.maxDeadLetters ?? 500;
  }

  public async start(): Promise<void> {
    await this.boot();
  }

  public async stop(): Promise<void> {
    await this.shutdown();
  }

  public async getHealth(): Promise<SubsystemHealth> {
    return Promise.resolve(this.health());
  }

  public async boot(): Promise<void> {
    this._isReady = true;
    this._bootTime = Date.now();
  }

  public async shutdown(): Promise<void> {
    // Wait for all in-flight queues to finish
    while (this._keyQueues.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
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

  public clearDeadLetters(): void {
    this._deadLetterQueue = [];
  }

  public subscribe<T = unknown>(topic: string, handler: EventHandler<T>): Subscription {
    if (!this._subscriptions.has(topic)) {
      this._subscriptions.set(topic, []);
    }
    const id = asUUID(randomUUID());
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

    return new Promise<void>((resolve, reject) => {
      let keyQueue = this._keyQueues.get(key);
      if (!keyQueue) {
        keyQueue = { items: [], running: false };
        this._keyQueues.set(key, keyQueue);
      }

      if (keyQueue.items.length >= this._maxQueueLengthPerKey) {
        return reject(
          new AgyError(`Queue limit exceeded for key ${key}`, {
            code: 'QUEUE_OVERFLOW',
            subsystem: 'event-bus',
            retryable: true,
          })
        );
      }

      keyQueue.items.push({
        topic,
        event: event as Event<unknown>,
        resolve,
        reject,
      });

      if (!keyQueue.running) {
        this.processKeyQueue(key, keyQueue);
      }
    });
  }

  private async processKeyQueue(key: string, keyQueue: KeyQueue): Promise<void> {
    keyQueue.running = true;

    while (keyQueue.items.length > 0) {
      const item = keyQueue.items.shift()!;
      try {
        await this.dispatchToSubscribers(item.topic, item.event);
        item.resolve();
      } catch (err: unknown) {
        this._errorCount++;
        this.recordDeadLetter(item.event);
        console.error(`[EventBus] Handled error by routing event ${item.event.id} to DLQ on key ${key}:`, err);
        item.resolve();
      }
    }

    // Clean up empty key queues immediately to prevent memory leaks
    this._keyQueues.delete(key);
  }

  private recordDeadLetter(event: Event<unknown>): void {
    if (this._deadLetterQueue.length >= this._maxDeadLetters) {
      this._deadLetterQueue.shift();
    }
    this._deadLetterQueue.push(event);
  }

  private async dispatchToSubscribers<T>(topic: string, event: Event<T>): Promise<void> {
    const subs = this._subscriptions.get(topic) || [];
    const wildcardSubs = this._subscriptions.get('*') || [];
    const allSubs = [...subs, ...wildcardSubs];

    for (const sub of allSubs) {
      let attempts = 0;
      let delivered = false;

      while (attempts < this._maxRetries && !delivered) {
        attempts++;
        try {
          await sub.handler(event);
          delivered = true;
          this._processedCount++;
        } catch (err) {
          if (attempts >= this._maxRetries) {
            throw err;
          }
          const backoff = this._backoffBaseMs * Math.pow(2, attempts - 1) + Math.random() * 20;
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }
      }
    }
  }
}
