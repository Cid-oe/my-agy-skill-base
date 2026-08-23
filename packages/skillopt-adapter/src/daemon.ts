import { ISubsystem, SubsystemHealth, UUID, asUUID } from '@agy/shared';
import { randomUUID } from 'node:crypto';
import { SkillOptAdapterConfig } from './types.js';
import { TrajectoryRecorder } from './trajectory.js';
import { OptimizationScheduler } from './optimizer.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface SkillOptDaemonOptions {
  config: SkillOptAdapterConfig;
  recorder: TrajectoryRecorder;
  scheduler: OptimizationScheduler;
}

export class SkillOptDaemon implements ISubsystem {
  public readonly id: UUID = asUUID(randomUUID());
  public readonly name = 'skillopt-daemon';

  private _config: SkillOptAdapterConfig;
  private _recorder: TrajectoryRecorder;
  private _scheduler: OptimizationScheduler;
  private _isReady = false;
  private _bootTime = 0;
  private _timer: NodeJS.Timeout | null = null;

  constructor(options: SkillOptDaemonOptions) {
    this._config = options.config;
    this._recorder = options.recorder;
    this._scheduler = options.scheduler;
  }

  public async start(): Promise<void> { await this.boot(); }
  public async stop(): Promise<void> { await this.shutdown(); }
  public async getHealth(): Promise<SubsystemHealth> { return Promise.resolve(this.health()); }

  public async boot(): Promise<void> {
    this._isReady = true;
    this._bootTime = Date.now();

    // Start a periodic check for auto-trigger optimization (using a naive 1-hour interval for simplicity)
    // A robust implementation would use a proper cron parser based on this._config.sleep.schedule
    const intervalMs = 60 * 60 * 1000; 
    this._timer = setInterval(() => this.checkAndTrigger(), intervalMs);
    this._timer.unref(); // Don't prevent process exit
  }

  public async shutdown(): Promise<void> {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._isReady = false;
  }

  public health(): SubsystemHealth {
    return {
      status: this._isReady ? 'healthy' : 'unhealthy',
      uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0,
    };
  }

  private checkAndTrigger(): void {
    if (!this._isReady) return;

    try {
      const storageDir = this._config.trajectories.storageDir;
      if (!fs.existsSync(storageDir)) return;

      const skills = fs.readdirSync(storageDir);
      for (const skillName of skills) {
        if (this._recorder.shouldTriggerOptimization(skillName)) {
          // Determine production path. We assume it's in cwd/skills/<skillName>/manifest.json
          const prodPath = path.join(process.cwd(), 'skills', skillName, 'manifest.json');
          
          if (fs.existsSync(prodPath)) {
            console.log(`[skillopt-daemon] Auto-triggering optimization for skill: ${skillName}`);
            this._scheduler.enqueue(skillName, prodPath);
          }
        }
      }
    } catch (err) {
      console.error(`[skillopt-daemon] Error during check: ${String(err)}`);
    }
  }
}
