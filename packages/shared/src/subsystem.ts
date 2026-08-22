import { UUID, SubsystemHealth } from "./types.js";

/**
 * Core contract for any kernel subsystem (e.g., Scheduler, Executor, Registry).
 * Implementations must be stateless aside from internal resource handling and must expose
 * a health endpoint for observability.
 */
export interface ISubsystem {
  /** Unique identifier for the subsystem */
  id: UUID;
  /** Human‑readable name */
  name: string;
  /** Current health status */
  health(): SubsystemHealth | Promise<SubsystemHealth>;

  /** Start the subsystem – allocate resources, load configuration, etc. */
  start(): Promise<void>;

  /** Stop the subsystem – release resources, flush state, etc. */
  stop(): Promise<void>;

  /** Return the latest health snapshot */
  getHealth(): Promise<SubsystemHealth>;
}
