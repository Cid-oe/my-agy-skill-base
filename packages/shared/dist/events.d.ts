/**
 * Event and Topic models for Event Bus.
 */
import { UUID, Timestamp } from './types.js';
export interface Event<T = unknown> {
    id: UUID;
    topic: string;
    key: string;
    payload: T;
    timestamp: Timestamp;
    causationId?: UUID;
}
export type EventHandler<T = unknown> = (event: Event<T>) => Promise<void> | void;
export interface Subscription {
    id: UUID;
    topic: string;
    unsubscribe(): void;
}
//# sourceMappingURL=events.d.ts.map