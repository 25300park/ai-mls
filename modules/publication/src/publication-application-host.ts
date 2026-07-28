import {
  isApprovedPublicationHostComposition,
  isPublicationCompositionRuntimeFailure,
  type PublicationHostCompositionFacade,
  type PublicationHostCompositionFactory,
  type PublicationCompositionOptions,
} from "./publication-composition-root.js";
import type { PublicationHostClock } from "./publication-host-clock.js";
import {
  PublicationHostError,
  type PublicationHostDiagnostics,
  type PublicationHostShutdownStatus,
  type PublicationHostStateSnapshot,
} from "./publication-host-contracts.js";
import { createPublicationHostDiagnostics } from "./publication-host-diagnostics.js";
import { PublicationHostLifecycleController } from "./publication-host-lifecycle.js";

export class PublicationApplicationHost {
  private readonly lifecycle = new PublicationHostLifecycleController();
  private composition: PublicationHostCompositionFacade | undefined;
  private startupDurationMs: number | null = null;
  private shutdownStatus: PublicationHostShutdownStatus = "NOT_STARTED";
  private stoppedSnapshot: PublicationHostStateSnapshot | undefined;

  public constructor(
    private readonly compositionFactory: PublicationHostCompositionFactory,
    private readonly clock: PublicationHostClock,
    private readonly compositionOptions: PublicationCompositionOptions,
  ) {}

  public get status(): PublicationHostStateSnapshot {
    return this.lifecycle.snapshot;
  }

  public get diagnostics(): PublicationHostDiagnostics {
    return createPublicationHostDiagnostics(
      this.lifecycle.snapshot,
      this.startupDurationMs,
      this.shutdownStatus,
    );
  }

  public start(): PublicationHostStateSnapshot {
    if (this.lifecycle.snapshot.state === "READY") {
      throw new PublicationHostError("HOST_ALREADY_STARTED", "Host has already started.");
    }
    if (this.lifecycle.snapshot.state !== "CREATED") {
      throw new PublicationHostError("HOST_TRANSITION_INVALID", "Host cannot start from its current state.");
    }
    this.lifecycle.transition("INITIALISING");
    try {
      const startedAt = this.clock.now();
      const composition = this.compositionFactory(this.compositionOptions);
      if (!isApprovedPublicationHostComposition(composition)) {
        throw new PublicationHostError("HOST_BOOTSTRAP_FAILED", "Host Composition is invalid.");
      }
      if (composition.runtimeStatus !== "READY"
        || composition.validationStatus !== "VALID") {
        throw new PublicationHostError("HOST_RUNTIME_FAILURE", "Host Runtime is unavailable.");
      }
      this.composition = composition;
      this.startupDurationMs = Math.max(0, this.clock.now() - startedAt);
      this.shutdownStatus = "NOT_REQUESTED";
      return this.lifecycle.transition("READY");
    } catch (error) {
      if (this.composition !== undefined) {
        try {
          this.composition.shutdown();
          this.shutdownStatus = "COMPLETE";
        } catch {
          this.shutdownStatus = "FAILED";
        }
      }
      this.lifecycle.transition("FAILED");
      if (error instanceof PublicationHostError) throw error;
      if (isPublicationCompositionRuntimeFailure(error)) {
        throw new PublicationHostError("HOST_RUNTIME_FAILURE", "Host Runtime bootstrap failed.");
      }
      throw new PublicationHostError("HOST_BOOTSTRAP_FAILED", "Host bootstrap failed.");
    }
  }

  public execute(
    request: unknown,
  ): ReturnType<PublicationHostCompositionFacade["execute"]> {
    if (this.lifecycle.snapshot.state !== "READY" || this.composition === undefined) {
      throw new PublicationHostError("HOST_NOT_READY", "Host is not ready for execution.");
    }
    try {
      return this.composition.execute(request);
    } catch {
      try {
        this.composition.shutdown();
        this.shutdownStatus = "COMPLETE";
      } catch {
        this.shutdownStatus = "FAILED";
      }
      this.lifecycle.transition("FAILED");
      throw new PublicationHostError("HOST_RUNTIME_FAILURE", "Host Runtime execution failed.");
    }
  }

  public stop(): PublicationHostStateSnapshot {
    if (this.lifecycle.snapshot.state === "STOPPED" && this.stoppedSnapshot !== undefined) {
      return this.stoppedSnapshot;
    }
    if (this.lifecycle.snapshot.state !== "READY" || this.composition === undefined) {
      throw new PublicationHostError("HOST_TRANSITION_INVALID", "Host cannot stop from its current state.");
    }
    this.lifecycle.transition("STOPPING");
    this.shutdownStatus = "IN_PROGRESS";
    try {
      this.composition.shutdown();
      this.shutdownStatus = "COMPLETE";
      this.stoppedSnapshot = this.lifecycle.transition("STOPPED");
      return this.stoppedSnapshot;
    } catch {
      this.shutdownStatus = "FAILED";
      this.lifecycle.transition("FAILED");
      throw new PublicationHostError("HOST_SHUTDOWN_FAILED", "Host shutdown failed.");
    }
  }
}
