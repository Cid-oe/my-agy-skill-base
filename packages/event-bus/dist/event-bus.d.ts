/**
 * Concrete implementation of the AGY Event Bus.
 * Supports per-key sequential FIFO delivery, at-least-once delivery guarantee,
 * bounded queues, backpressure handling, and dead-letter routing (RFC-0006, RFC-0006a).
 */
import { Event, EventHandler, Subscription, SubsystemHealth } from '@agy/shared';
import { IEventBus } from './interfaces.js';
export declare class EventBus implements IEventBus {
    readonly name = "event-bus";
    private _subscriptions;
    private _keyQueues;
    private _deadLetterQueue;
    private _isReady;
    private _processedCount;
    private _errorCount;
    private _bootTime;
    boot(): Promise<void>;
    shutdown(): Promise<void>;
    health(): SubsystemHealth;
    getDeadLetterQueue(): Event[];
    subscribe<T = unknown>(topic: string, handler: EventHandler<T>): Subscription;
    publish<T = unknown>(topic: string, event: Event<T>): Promise<void>;
    private dispatchToSubscribers;
}
//# sourceMappingURL=event-bus.d.ts.map