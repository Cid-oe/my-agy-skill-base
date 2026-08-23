/**
 * Concrete implementation of the AGY Event Bus.
 * Supports per-key sequential FIFO delivery, bounded queues, retries,
 * dead-letter routing, and deterministic shutdown (RFC-0006, RFC-0006a).
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Event, EventHandler, Subscription, SubsystemHealth, AgyError, UUID, asUUID, deepClone } from '@agy/shared';
import { EventBusOptions, EventBusStats, IEventBus } from './interfaces.js';

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
  current?: QueueItem;
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

  private readonly _maxQueueLengthPerKey: number;
  private readonly _maxRetries: number;
  private readonly _backoffBaseMs: number;
  private readonly _maxDeadLetters: number;
  private readonly _shutdownDrainMs: number;
  private readonly _persistenceDir?: string;

  constructor(options: EventBusOptions = {}) {
    this._maxQueueLengthPerKey = validatePositiveInteger(options.maxQueueLengthPerKey ?? 1000, 'maxQueueLengthPerKey');
    this._maxRetries = validatePositiveInteger(options.maxRetries ?? 3, 'maxRetries');
    this._backoffBaseMs = validateNonNegativeNumber(options.backoffBaseMs ?? 50, 'backoffBaseMs');
    this._maxDeadLetters = validatePositiveInteger(options.maxDeadLetters ?? 500, 'maxDeadLetters');
    this._shutdownDrainMs = validateNonNegativeNumber(options.shutdownDrainMs ?? 5000, 'shutdownDrainMs');
    this._persistenceDir = options.persistenceDir;
  }

  public async start(): Promise<void> { await this.boot(); }
  public async stop(): Promise<void> { await this.shutdown(); }
  public async getHealth(): Promise<SubsystemHealth> { return Promise.resolve(this.health()); }

  public async boot(): Promise<void> {
    if (this._isReady) return;
    this._isReady = true;
    this._bootTime = Date.now();
    this.loadDeadLetters();
  }

  public async shutdown(): Promise<void> {
    // Reject new publications before draining so shutdown cannot be extended by
    // a producer that continuously republishes events.
    this._isReady = false;

    const deadline = Date.now() + this._shutdownDrainMs;
    while (this._keyQueues.size > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Every publication owns a promise. Do not abandon those promises when a
    // queue is force-aborted; callers must always receive a terminal result.
    for (const queue of this._keyQueues.values()) {
      // Publications already accepted by the bus are completed as dropped
      // during forced shutdown. This prevents unhandled rejections in
      // fire-and-forget producers; new publications still reject with
      // BUS_NOT_READY before entering a queue.
      if (queue.current) queue.current.resolve();
      for (const item of queue.items) item.resolve();
      queue.items.length = 0;
    }
    this._keyQueues.clear();
    this._subscriptions.clear();
  }

  public health(): SubsystemHealth {
    return {
      status: this._isReady ? 'healthy' : 'unhealthy',
      uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0,
    };
  }

  public getDeadLetterQueue(): Event[] {
    return deepClone(this._deadLetterQueue);
  }

  public clearDeadLetters(): void {
    this._deadLetterQueue = [];
    this.persistDeadLetters();
  }

  public getStats(): EventBusStats {
    return {
      processedCount: this._processedCount,
      errorCount: this._errorCount,
      deadLetterCount: this._deadLetterQueue.length,
      activeKeyQueues: this._keyQueues.size,
    };
  }

  public subscribe<T = unknown>(topic: string, handler: EventHandler<T>): Subscription {
    if (!topic || typeof handler !== 'function') {
      throw new TypeError('EventBus subscriptions require a topic and handler');
    }
    if (!this._subscriptions.has(topic)) this._subscriptions.set(topic, []);
    const id = asUUID(randomUUID());
    const sub: TopicSubscription = { id, handler: handler as EventHandler<unknown> };
    this._subscriptions.get(topic)!.push(sub);

    return {
      id,
      topic,
      unsubscribe: () => {
        const subs = this._subscriptions.get(topic);
        if (subs) this._subscriptions.set(topic, subs.filter((s) => s.id !== id));
      },
    };
  }

  public async publish<T = unknown>(topic: string, event: Event<T>): Promise<void> {
    if (!this._isReady) {
      throw new AgyError('EventBus is not in ready state for publish', {
        code: 'BUS_NOT_READY', subsystem: 'event-bus', retryable: false,
      });
    }
    if (!topic || !event || typeof event.key !== 'string') {
      throw new AgyError('Event topic and key are required', {
        code: 'EVENT_INVALID', subsystem: 'event-bus', retryable: false,
      });
    }

    // RFC-0006a defines ordering by event key, independently of topic.
    const key = event.key || 'default';
    return new Promise<void>((resolve, reject) => {
      let keyQueue = this._keyQueues.get(key);
      if (!keyQueue) keyQueue = { items: [], running: false };

      const queueSize = keyQueue.items.length + (keyQueue.current ? 1 : 0);
      if (queueSize >= this._maxQueueLengthPerKey) {
        // Do not install an empty queue for a rejected publication.
        return reject(new AgyError(`Queue limit exceeded for key ${key}`, {
          code: 'QUEUE_OVERFLOW', subsystem: 'event-bus', retryable: true,
        }));
      }

      if (!this._keyQueues.has(key)) this._keyQueues.set(key, keyQueue);
      keyQueue.items.push({ topic, event: event as Event<unknown>, resolve, reject });
      if (!keyQueue.running) void this.processKeyQueue(key, keyQueue);
    });
  }

  private async processKeyQueue(key: string, keyQueue: KeyQueue): Promise<void> {
    keyQueue.running = true;
    try {
      while (keyQueue.items.length > 0) {
        const item = keyQueue.items.shift()!;
        keyQueue.current = item;
        try {
          await this.dispatchToSubscribers(item.topic, item.event);
          item.resolve();
        } catch (err) {
          // An unexpected bus-internal failure must not strand this publication.
          item.reject(err);
        } finally {
          keyQueue.current = undefined;
        }
      }
    } finally {
      keyQueue.running = false;
      if (this._keyQueues.get(key) === keyQueue) this._keyQueues.delete(key);
    }
  }

  private recordDeadLetter(event: Event<unknown>): void {
    if (this._deadLetterQueue.length >= this._maxDeadLetters) this._deadLetterQueue.shift();
    this._deadLetterQueue.push(deepClone(event));
    this.persistDeadLetters();
  }

  private async dispatchToSubscribers<T>(topic: string, event: Event<T>): Promise<void> {
    const subs = [...(this._subscriptions.get(topic) || []), ...(this._subscriptions.get('*') || [])];
    let eventFailed = false;

    // Failure of one subscriber is isolated. Every subscriber gets its own
    // retry budget, and a failed subscriber cannot prevent later subscribers
    // from receiving the event.
    for (const sub of subs) {
      let delivered = false;
      for (let attempt = 1; attempt <= this._maxRetries; attempt++) {
        try {
          await sub.handler(deepClone(event));
          delivered = true;
          this._processedCount++;
          break;
        } catch (err) {
          this._errorCount++;
          if (attempt === this._maxRetries) {
            eventFailed = true;
            break;
          }
          const backoff = this._backoffBaseMs * Math.pow(2, attempt - 1) + Math.random() * 20;
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }
      }
      if (!delivered) eventFailed = true;
    }

    if (eventFailed) this.recordDeadLetter(event as Event<unknown>);
  }

  private deadLetterPath(): string | undefined {
    return this._persistenceDir ? path.join(this._persistenceDir, 'dead-letters.json') : undefined;
  }

  private loadDeadLetters(): void {
    const file = this.deadLetterPath();
    if (!file || !fs.existsSync(file)) return;
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Event[];
      if (Array.isArray(raw)) this._deadLetterQueue = raw.slice(-this._maxDeadLetters);
    } catch {
      // A corrupt DLQ must not prevent the bus from booting.
    }
  }

  private persistDeadLetters(): void {
    const file = this.deadLetterPath();
    if (!file) return;
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = `${file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this._deadLetterQueue));
      const fd = fs.openSync(tmp, 'r+');
      try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      fs.renameSync(tmp, file);
    } catch (err) {
      // Delivery must not fail merely because observability persistence failed.
      console.error('[EventBus] Failed to persist dead-letter queue:', err);
    }
  }
}

function validatePositiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) throw new RangeError(`${name} must be a positive integer`);
  return value;
}

function validateNonNegativeNumber(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be a finite non-negative number`);
  return value;
}
