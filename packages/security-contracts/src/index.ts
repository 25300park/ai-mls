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
