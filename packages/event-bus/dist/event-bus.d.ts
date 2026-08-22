/**
 * Concrete implementation of the AGY Event Bus.
 * Supports per-key sequential FIFO delivery, at-least-once delivery guarantee,
 * bounded queues, backpressure handling, and dead-letter routing (RFC-0006, RFC-0006a).
 */
import { Event, EventHandler, Subscription, SubsystemHealth, UUID } from '@agy/shared';
import { EventBusOptions, IEventBus } from './interfaces.js';
export declare class EventBus implements IEventBus {
    readonly id: UUID;
    readonly name = "event-bus";
    private _keyQueues;
    private _deadLetterQueue;
    private _isReady;
    private _processedCount;
    private _errorCount;
    private _bootTime;
    private _subscriptions;
    private _maxQueueLengthPerKey;
    private _maxRetries;
    private _backoffBaseMs;
    private _maxDeadLetters;
    constructor(options?: EventBusOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    getHealth(): Promise<SubsystemHealth>;
    boot(): Promise<void>;
    shutdown(): Promise<void>;
    health(): SubsystemHealth;
    getDeadLetterQueue(): Event[];
    clearDeadLetters(): void;
    subscribe<T = unknown>(topic: string, handler: EventHandler<T>): Subscription;
    publish<T = unknown>(topic: string, event: Event<T>): Promise<void>;
    private processKeyQueue;
    private recordDeadLetter;
    private dispatchToSubscribers;
}
//# sourceMappingURL=event-bus.d.ts.map