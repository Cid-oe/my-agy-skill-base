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

  /** Canonical lifecycle: boot the subsystem (allocate resources, load config). */
  boot(): Promise<void>;
  /** Canonical lifecycle: shut the subsystem down (release resources, flush). */
  shutdown(): Promise<void>;

  /** Start the subsystem – allocate resources, load configuration, etc.
   * Alias for {@link boot}; retained for backwards compatibility. */
  start(): Promise<void>;

  /** Stop the subsystem – release resources, flush state, etc.
   * Alias for {@link shutdown}; retained for backwards compatibility. */
  stop(): Promise<void>;

  /** Return the latest health snapshot */
  getHealth(): Promise<SubsystemHealth>;
}
