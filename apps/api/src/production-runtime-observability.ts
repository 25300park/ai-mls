import { randomUUID } from "node:crypto";

const PHASES = ["BOOTSTRAPPING", "PRE_LISTENER_VALIDATING", "PRE_LISTENER_READY", "ACTIVATING_LISTENER",
  "ACTIVATING_WORKERS", "RUNTIME_READY", "SHUTTING_DOWN", "STOPPED"] as const;
export type ProductionStartupPhase = typeof PHASES[number] | "STARTUP_FAILED" | "SHUTDOWN_FAILED";
export type ProductionGateName = "serviceWorkloadGate" | "humanIdentityGate" | "requiredSecretsGate";
export type ProductionGateStatus = "NOT_CHECKED" | "READY" | "READY_EMPTY_MANIFEST" | "FAILED";
const FAILURE_CODES = ["PRODUCTION_STARTUP_UNAVAILABLE", "PRE_LISTENER_NOT_READY", "LISTENER_START_FAILED", "WORKER_START_FAILED",
  "ACTIVATION_CLEANUP_FAILED", "DUPLICATE_ACTIVATION", "SHUTDOWN_FAILED", "WORKER_MANIFEST_INVALID",
  "SERVICE_WORKLOAD_GATE_FAILED", "HUMAN_IDENTITY_GATE_FAILED", "REQUIRED_SECRETS_GATE_FAILED", "DATABASE_READINESS_FAILED",
  "PRODUCTION_SERVICE_IDENTITY_UNAVAILABLE", "PRODUCTION_STARTUP_BINDING_UNAVAILABLE",
  "PINNED_WORKLOAD", "IDENTITY_EVIDENCE", "REGISTRATION_AUDIT", "BINDING", "BINDING_AUDIT", "SERVICE_PRINCIPAL",
  "ORGANIZATION", "PROJECT", "AUTHORIZATION_TEAM", "TYPED_SCOPE", "AUTHORIZATION", "REVALIDATION", "SCHEMA_READINESS",
  "AUTH_BINDING", "AUTH_ADAPTER", "ARGON2_RUNTIME", "FRESHNESS_POLICY", "HUMAN_PERSISTENCE", "SESSION_PERSISTENCE",
  "TRUSTED_BINDING", "LIVE_AUTHORIZATION", "COMPOSITION_INPUT"] as const;
export type ProductionObservedFailureCode = typeof FAILURE_CODES[number];

export interface ProductionStartupEvidenceSnapshot {
  readonly schemaVersion: 1;
  readonly runtimeAttemptId: string;
  readonly startedAt: string;
  readonly observedAt: string;
  readonly completedAt: string | null;
  readonly startupPhase: ProductionStartupPhase;
  readonly liveness: "LIVE";
  readonly readiness: "READY" | "NOT_READY";
  readonly shutdownRequested: boolean;
  readonly serviceWorkloadGate: ProductionGateStatus;
  readonly humanIdentityGate: ProductionGateStatus;
  readonly requiredSecretsGate: ProductionGateStatus;
  readonly preListenerChain: "NOT_READY" | "READY" | "FAILED";
  readonly listenerState: "NOT_STARTED" | "STARTING" | "STARTED" | "STOPPING" | "STOPPED" | "FAILED";
  readonly workerManifestSchemaVersion: 1 | null;
  readonly requiredWorkerCount: 0 | null;
  readonly workerState: "NOT_STARTED" | "READY_EMPTY_MANIFEST" | "STOPPED" | "FAILED";
  readonly runtimeActivation: "NOT_READY" | "READY" | "FAILED";
  readonly physicalPoolCount: 0 | 1;
  readonly databaseConnectivity: "NOT_CHECKED" | "READ_PATH_VERIFIED" | "CLOSED" | "UNKNOWN";
  readonly poolReadiness: "NOT_CHECKED" | "READY" | "CLOSED" | "FAILED";
  readonly failureCode: ProductionObservedFailureCode | null;
  readonly gateFailureCode: ProductionObservedFailureCode | null;
}
type EvidenceChange = { -readonly [Key in keyof ProductionStartupEvidenceSnapshot]?: ProductionStartupEvidenceSnapshot[Key] };

/** No configuration, credentials, user/session identifiers or arbitrary payloads are accepted. */
export class ProductionRuntimeObservability {
  private evidence: ProductionStartupEvidenceSnapshot;
  private readonly clock: () => Date;
  private readonly sink: ((snapshot: ProductionStartupEvidenceSnapshot) => void) | undefined;

  public constructor(options: Readonly<{ clock?: () => Date; sink?: (snapshot: ProductionStartupEvidenceSnapshot) => void }> = {}) {
    this.clock = options.clock ?? ((): Date => new Date());
    this.sink = options.sink;
    const timestamp = this.clock().toISOString();
    this.evidence = Object.freeze({ schemaVersion: 1, runtimeAttemptId: randomUUID(), startedAt: timestamp, observedAt: timestamp,
      completedAt: null, startupPhase: "BOOTSTRAPPING", liveness: "LIVE", readiness: "NOT_READY", shutdownRequested: false,
      serviceWorkloadGate: "NOT_CHECKED", humanIdentityGate: "NOT_CHECKED", requiredSecretsGate: "NOT_CHECKED",
      preListenerChain: "NOT_READY", listenerState: "NOT_STARTED", workerManifestSchemaVersion: null, requiredWorkerCount: null,
      workerState: "NOT_STARTED", runtimeActivation: "NOT_READY", physicalPoolCount: 0, databaseConnectivity: "NOT_CHECKED",
      poolReadiness: "NOT_CHECKED", failureCode: null, gateFailureCode: null });
    this.emit();
  }

  public snapshot(): ProductionStartupEvidenceSnapshot { return this.evidence; }

  public advance(phase: typeof PHASES[number]): void {
    const previous = PHASES.indexOf(this.evidence.startupPhase as typeof PHASES[number]);
    if (previous < 0 || PHASES[previous + 1] !== phase) throw invalid();
    const change: EvidenceChange = { startupPhase: phase };
    if (phase === "PRE_LISTENER_READY") {
      if (this.evidence.serviceWorkloadGate !== "READY" || this.evidence.humanIdentityGate !== "READY"
        || this.evidence.requiredSecretsGate !== "READY_EMPTY_MANIFEST") throw invalid();
      change.preListenerChain = "READY";
    }
    if (phase === "ACTIVATING_LISTENER") change.listenerState = "STARTING";
    if (phase === "ACTIVATING_WORKERS") change.listenerState = "STARTED";
    if (phase === "RUNTIME_READY") {
      if (this.evidence.preListenerChain !== "READY" || this.evidence.listenerState !== "STARTED"
        || this.evidence.requiredWorkerCount !== 0 || this.evidence.poolReadiness !== "READY") throw invalid();
      change.workerState = "READY_EMPTY_MANIFEST"; change.runtimeActivation = "READY";
      change.readiness = this.evidence.shutdownRequested ? "NOT_READY" : "READY";
      change.completedAt = this.clock().toISOString();
    }
    if (phase === "SHUTTING_DOWN") { change.readiness = "NOT_READY"; change.shutdownRequested = true; change.runtimeActivation = "NOT_READY"; change.listenerState = "STOPPING"; }
    if (phase === "STOPPED") { change.listenerState = "STOPPED"; change.workerState = "STOPPED"; change.completedAt = this.clock().toISOString(); }
    this.update(change);
  }

  public gate(gate: ProductionGateName, status: Exclude<ProductionGateStatus, "NOT_CHECKED">, failure?: ProductionObservedFailureCode): void {
    if (!["serviceWorkloadGate", "humanIdentityGate", "requiredSecretsGate"].includes(gate)
      || !["READY", "READY_EMPTY_MANIFEST", "FAILED"].includes(status) || this.evidence.startupPhase !== "PRE_LISTENER_VALIDATING"
      || this.evidence[gate] !== "NOT_CHECKED" || (failure !== undefined && !validFailure(failure))) throw invalid();
    this.update({ [gate]: status, ...(failure === undefined ? {} : { gateFailureCode: failure }) });
  }

  public poolOpened(): void { this.update({ physicalPoolCount: 1 }); }
  public identityReadVerified(): void { this.update({ databaseConnectivity: "READ_PATH_VERIFIED" }); }
  public poolReady(): void { this.update({ poolReadiness: "READY" }); }
  public poolClosed(): void { this.update({ databaseConnectivity: "CLOSED", poolReadiness: "CLOSED" }); }
  public poolCloseFailed(): void { this.update({ databaseConnectivity: "UNKNOWN", poolReadiness: "FAILED" }); }
  public workerManifestReady(): void { this.update({ workerManifestSchemaVersion: 1, requiredWorkerCount: 0 }); }
  public listenerClosed(failed = false): void { this.update({ listenerState: failed ? "FAILED" : "STOPPED" }); }
  public emptyWorkersStopped(): void { if (this.evidence.requiredWorkerCount === 0) this.update({ workerState: "STOPPED" }); }
  public shutdownRequested(): void {
    if (!this.evidence.shutdownRequested) this.update({ shutdownRequested: true, readiness: "NOT_READY" });
  }

  public failed(code: ProductionObservedFailureCode): void {
    if (!validFailure(code) || ["RUNTIME_READY", "SHUTTING_DOWN", "STOPPED", "SHUTDOWN_FAILED", "STARTUP_FAILED"].includes(this.evidence.startupPhase)) throw invalid();
    this.update({ startupPhase: "STARTUP_FAILED", failureCode: code, readiness: "NOT_READY", runtimeActivation: "FAILED",
      preListenerChain: this.evidence.preListenerChain === "READY" ? "READY" : "FAILED",
      ...(this.evidence.listenerState === "STARTING" ? { listenerState: "FAILED" as const } : {}),
      ...(code === "WORKER_START_FAILED" ? { workerState: "FAILED" as const } : {}), completedAt: this.clock().toISOString() });
  }

  public shutdownFinished(failed: boolean): void {
    if (this.evidence.startupPhase !== "SHUTTING_DOWN") throw invalid();
    if (!failed) { this.advance("STOPPED"); return; }
    this.update({ startupPhase: "SHUTDOWN_FAILED", failureCode: "SHUTDOWN_FAILED", readiness: "NOT_READY",
      completedAt: this.clock().toISOString() });
  }

  private update(change: Partial<ProductionStartupEvidenceSnapshot>): void {
    this.evidence = Object.freeze({ ...this.evidence, ...change, observedAt: this.clock().toISOString() });
    this.emit();
  }
  private emit(): void { try { this.sink?.(this.evidence); } catch { /* diagnostics cannot change lifecycle semantics */ } }
}

/** Only own data fields with known canonical tokens are consumed; never messages, causes or getters. */
export function safeStartupFailureCode(error: unknown, fallback: ProductionObservedFailureCode = "PRODUCTION_STARTUP_UNAVAILABLE"): ProductionObservedFailureCode {
  if (!validFailure(fallback)) throw invalid();
  try {
    if (error !== null && typeof error === "object") {
      for (const key of ["stage", "reason", "code"]) {
        const descriptor = Object.getOwnPropertyDescriptor(error, key);
        if (descriptor !== undefined && "value" in descriptor && validFailure(descriptor.value)
          && descriptor.value !== "PRODUCTION_STARTUP_UNAVAILABLE") return descriptor.value;
      }
    }
  } catch { /* hostile diagnostic data stays unavailable */ }
  return fallback;
}
function validFailure(value: unknown): value is ProductionObservedFailureCode { return typeof value === "string" && (FAILURE_CODES as readonly string[]).includes(value); }
function invalid(): Error { return new Error("Production observability transition is invalid."); }
