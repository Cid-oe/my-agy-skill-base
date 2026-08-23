import { IEventBus } from '@agy/event-bus';
import { IArtifactStore } from '@agy/artifact';
import { ISubsystem, SubsystemHealth, UUID, asUUID } from '@agy/shared';
import { TrajectoryRecorder } from './trajectory.js';
import { SkillOptAdapterConfig } from './types.js';
import { randomUUID } from 'node:crypto';

export interface SkillOptRegistryHookOptions {
  eventBus: IEventBus;
  artifactStore: IArtifactStore;
  config: SkillOptAdapterConfig;
}

export class SkillOptRegistryHook implements ISubsystem {
  public readonly id: UUID = asUUID(randomUUID());
  public readonly name = 'skillopt-registry-hook';
  
  private _eventBus: IEventBus;
  private _artifactStore: IArtifactStore;
  private _config: SkillOptAdapterConfig;
  private _recorder: TrajectoryRecorder;
  private _isReady = false;
  private _bootTime = 0;

  // Track task starts to map taskId to skill name
  private _taskToSkill = new Map<string, string>();

  constructor(options: SkillOptRegistryHookOptions) {
    this._eventBus = options.eventBus;
    this._artifactStore = options.artifactStore;
    this._config = options.config;
    this._recorder = new TrajectoryRecorder(this._config);
  }

  public async start(): Promise<void> { await this.boot(); }
  public async stop(): Promise<void> { await this.shutdown(); }
  public async getHealth(): Promise<SubsystemHealth> { return Promise.resolve(this.health()); }

  public async boot(): Promise<void> {
    this._eventBus.subscribe('executor.task.started', this.onTaskStarted.bind(this));
    this._eventBus.subscribe('executor.task.finished', this.onTaskFinished.bind(this));
    this._eventBus.subscribe('executor.task.failed', this.onTaskFailed.bind(this));
    
    this._isReady = true;
    this._bootTime = Date.now();
  }

  public async shutdown(): Promise<void> {
    this._isReady = false;
  }

  public health(): SubsystemHealth {
    return {
      status: this._isReady ? 'healthy' : 'unhealthy',
      uptimeMs: this._bootTime ? Date.now() - this._bootTime : 0,
    };
  }

  private async onTaskStarted(event: any): Promise<void> {
    if (!event.payload || !event.payload.taskId || !event.payload.skill) return;
    this._taskToSkill.set(event.payload.taskId, event.payload.skill);
  }

  private async onTaskFinished(event: any): Promise<void> {
    await this.recordTrajectory(event, 'success');
  }

  private async onTaskFailed(event: any): Promise<void> {
    await this.recordTrajectory(event, 'failure');
  }

  private async recordTrajectory(event: any, outcome: 'success' | 'failure'): Promise<void> {
    if (!event.payload || !event.payload.taskId) return;
    const taskId = event.payload.taskId;
    const skillName = this._taskToSkill.get(taskId);
    if (!skillName) return;

    // Cleanup memory
    this._taskToSkill.delete(taskId);

    // In a full implementation we would parse the RuntimeState and ExecutionLedger
    // to get the true userRequest, inputs, outputs, and tool calls.
    // For now we fulfill the adapter's requirement with safe defaults or minimal data.
    const userRequest = `Task Execution: ${taskId}`;
    const failureReason = outcome === 'failure' ? event.payload.error : undefined;

    let skillOutputStr = outcome === 'success' ? { status: 'success', durationMs: event.payload.durationMs } : {};
    
    // Attempt to fetch output artifact from artifact store (which uses the payload)
    // Wait, we don't have the artifact hash, we only have taskId.
    // In a real implementation we would query RuntimeState for the ledger and get the artifact hashes.
    // For now we will mock it to satisfy compilation and the architecture.
    if (!this._artifactStore) {
      console.warn('ArtifactStore not available to registry hook');
    }

    this._recorder.record({
      skillName,
      skillContentHash: 'unknown-hash',
      userRequest,
      activatedSkills: [skillName],
      reasoningMetadata: {},
      toolCalls: [],
      skillInput: { taskId },
      skillOutput: skillOutputStr,
      finalAnswer: outcome === 'success' ? { status: 'success' } : { error: failureReason },
      outcome,
      failureReason,
      retryCount: 0,
      durationMs: event.payload.durationMs ?? 0,
      modelId: 'executor-worker'
    });
  }
}
