/**
 * Event Bus interfaces and contracts.
 * Strictly implements Phase 3 (IEventBus) and RFC-0006 / RFC-0006a.
 */

import { Event, EventHandler, Subscription, SubsystemHealth } from '@agy/shared';
import { ISubsystem } from '@agy/kernel';

export interface IEventBus extends ISubsystem {
  publish<T = unknown>(topic: string, event: Event<T>): Promise<void>;
  subscribe<T = unknown>(topic: string, handler: EventHandler<T>): Subscription;
  getDeadLetterQueue(): Event[];
  health(): Promise<SubsystemHealth> | SubsystemHealth;
}
