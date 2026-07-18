import type {
  AppendAuditEvent,
  AuditEvent,
  AuditPrincipal,
  AuditSink,
  Clock,
  IdFactory,
} from "../../../packages/security-contracts/src/index.js";

const sensitiveKeyPattern =
  /(?:authorization|cookie|credential|mfa.?(?:code|key|secret|token)|pass(?:word)?|private.?key|secret|session.?token|token)/iu;

interface AuditLogDependencies {
  readonly clock: Clock;
  readonly idFactory: IdFactory;
}

interface AuditQuery {
  readonly requesterId: string;
  readonly purpose: string;
  readonly eventType?: string;
  readonly targetId?: string;
  readonly correlationId?: string;
}

interface AuditCorrection {
  readonly originalEventId: string;
  readonly principal: AuditPrincipal;
  readonly reason: string;
  readonly correlationId: string;
  readonly correctedDetails: Readonly<Record<string, unknown>>;
}

function assertSafeDetails(value: unknown, path = "details"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      assertSafeDetails(entry, `${path}[${String(index)}]`);
    });
    return;
  }

  if (value === null || typeof value !== "object") {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (sensitiveKeyPattern.test(key)) {
      throw new Error(`SENSITIVE_AUDIT_DETAIL:${path}.${key}`);
    }
    assertSafeDetails(nestedValue, `${path}.${key}`);
  }
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach((nestedValue) => {
      deepFreeze(nestedValue);
    });
    Object.freeze(value);
  }
  return value;
}

function immutableSnapshot<T>(value: T): Readonly<T> {
  return deepFreeze(structuredClone(value));
}

export class AuditLog implements AuditSink {
  readonly #clock: Clock;
  readonly #idFactory: IdFactory;
  readonly #events: AuditEvent[] = [];

  public constructor(dependencies: AuditLogDependencies) {
    this.#clock = dependencies.clock;
    this.#idFactory = dependencies.idFactory;
  }

  public append(input: AppendAuditEvent): AuditEvent {
    if (input.details !== undefined) {
      assertSafeDetails(input.details);
    }

    const event = immutableSnapshot({
      ...input,
      id: this.#idFactory(),
      occurredAt: this.#clock().toISOString(),
    }) as AuditEvent;
    this.#events.push(event);
    return event;
  }

  public query(request: AuditQuery): readonly AuditEvent[] {
    if (request.purpose.trim().length === 0) {
      throw new Error("AUDIT_PURPOSE_REQUIRED");
    }
    if (request.requesterId.trim().length === 0) {
      throw new Error("AUDIT_ACCESS_DENIED");
    }

    return Object.freeze(
      this.#events.filter(
        (event) =>
          (request.eventType === undefined || event.eventType === request.eventType) &&
          (request.targetId === undefined || event.target.id === request.targetId) &&
          (request.correlationId === undefined ||
            event.correlationId === request.correlationId),
      ),
    );
  }

  public correct(request: AuditCorrection): AuditEvent {
    const original = this.#events.find((event) => event.id === request.originalEventId);
    if (original === undefined) {
      throw new Error("AUDIT_EVENT_NOT_FOUND");
    }
    if (request.reason.trim().length === 0) {
      throw new Error("AUDIT_CORRECTION_REASON_REQUIRED");
    }

    return this.append({
      eventType: "AUDIT_CORRECTION",
      principal: request.principal,
      action: "audit.correct",
      target: { type: "AuditEvent", id: original.id },
      purpose: "AUDIT_INTEGRITY",
      policyVersion: original.policyVersion,
      classification: "RESTRICTED_SECURITY",
      decision: "ALLOW",
      outcome: "COMPLETED",
      reason: request.reason,
      correlationId: request.correlationId,
      details: request.correctedDetails,
      correctionOf: original.id,
    });
  }
}
