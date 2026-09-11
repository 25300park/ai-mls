export type PrincipalType = "HUMAN" | "SERVICE";

export type RoleCode =
  | "COL"
  | "AGT"
  | "SAG"
  | "REV"
  | "AIR"
  | "DUR"
  | "VER"
  | "PMR"
  | "PUA"
  | "MGR"
  | "DST"
  | "OPS"
  | "SEC"
  | "ADM"
  | "RELEASE_OWNER"
  | "SVC"
  | "EXT";

export type DataClassification =
  | "PUBLIC_APPROVED"
  | "INTERNAL"
  | "CONFIDENTIAL_BUSINESS"
  | "RESTRICTED_PERSONAL"
  | "RESTRICTED_SECURITY";

export interface AuditPrincipal {
  readonly id: string;
  readonly type: PrincipalType;
  readonly roles: readonly RoleCode[];
  readonly teamId?: string;
  readonly sessionId?: string;
}

export interface AuditTarget {
  readonly type: string;
  readonly id: string;
  readonly version?: number;
}

export interface AppendAuditEvent {
  readonly eventType: string;
  readonly principal: AuditPrincipal;
  readonly action: string;
  readonly target: AuditTarget;
  readonly purpose: string;
  readonly policyVersion: string;
  readonly classification: DataClassification;
  readonly decision: "ALLOW" | "DENY" | "NOT_APPLICABLE";
  readonly outcome: "ACCEPTED" | "COMPLETED" | "FAILED" | "UNKNOWN";
  readonly reason?: string;
  readonly requestId?: string;
  readonly correlationId: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly correctionOf?: string;
}

export interface AuditEvent extends AppendAuditEvent {
  readonly id: string;
  readonly occurredAt: string;
}

export interface AuditSink {
  append(input: AppendAuditEvent): AuditEvent;
}

export type Clock = () => Date;

export type IdFactory = () => string;

const sensitiveSecurityDetailKeyPattern =
  /(?:authorization|chain.?of.?thought|cookie|credential|database.?path|email|filesystem.?path|mfa.?(?:code|key|secret|token)|pass(?:word)?|phone|private.?key|provider.?response|raw.?(?:body|message|payload|prompt|request|response)|reasoning|secret|session.?token|stack(?:trace)?|token)/iu;

const unsafeSecurityDetailValuePatterns = Object.freeze([
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu,
  /(?:^|[^A-Za-z0-9])\+?\d(?:[\s().-]*\d){8,}(?:[^A-Za-z0-9]|$)/u,
  /(?:^|[^a-z0-9])(?:api[-_ ]?key|authorization|bearer|cookie|credential|password|private[-_ ]?key|secret|session[-_ ]?token|token)(?:[^a-z0-9]|$)/iu,
  /(?:raw\s+(?:body|message|payload|prompt|provider|model|request|response)|chain[- ]of[- ]thought|hidden\s+reasoning)/iu,
  /(?:^|\n)\s*(?:[A-Za-z]*Error:.*\n\s*)?at\s+[^\n]+/u,
  /(?:[A-Za-z]:\\(?:[^\\\r\n]+\\)+[^\\\r\n]+|\/(?:[^/\r\n]+\/)+[^/\r\n]+|\b[^\s/\\]+\.(?:db|sqlite|sqlite3)\b)/iu,
]);

export function isSensitiveSecurityDetailKey(value: string): boolean {
  return sensitiveSecurityDetailKeyPattern.test(value);
}

export function isUnsafeSecurityDetailValue(value: string): boolean {
  return unsafeSecurityDetailValuePatterns.some((pattern) => pattern.test(value));
}
