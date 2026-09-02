import type { DataClassification } from "../../../packages/security-contracts/src/index.js";
import type { AuthorizationService } from "../../authorization/src/authorization-service.js";
import type { SessionContext } from "../../identity/src/session-service.js";

export type SourceIngestionScope = Readonly<{
  readonly scopeType: "TENANT" | "TEAM" | "ORGANIZATION" | "SOURCE";
  readonly scopeId: string;
}>;

export interface SourceIngestionPolicySnapshot {
  readonly sourceId: string;
  readonly tenantId: string;
  readonly scope: SourceIngestionScope;
  readonly status: "DRAFT" | "UNDER_REVIEW" | "ACTIVE" | "PAUSED" | "BLOCKED" | "RETIRED";
  readonly version: number;
  readonly allowedMethods: readonly string[];
  readonly allowedPurposes: readonly string[];
  readonly classification: DataClassification;
}

export interface ConnectorAdmissionSnapshot {
  readonly connectorId: string;
  readonly tenantId: string;
  readonly scope: SourceIngestionScope;
  readonly status: "APPROVED" | "ACTIVE" | "PAUSED" | "REVOKED" | "RETIRED";
  readonly version: number;
  readonly sourceIds: readonly string[];
  readonly allowedMethods: readonly string[];
  readonly allowedPurposes: readonly string[];
}

export interface SourceIngestionPolicyReader {
  readCurrent(input: Readonly<{ readonly tenantId: string; readonly sourceId: string }>): SourceIngestionPolicySnapshot | undefined;
}

export interface ConnectorAdmissionReader {
  readCurrent(input: Readonly<{ readonly tenantId: string; readonly connectorId: string }>): ConnectorAdmissionSnapshot | undefined;
}

export interface SourceIngestionAdmissionInput {
  readonly actor: SessionContext;
  readonly tenantId: string;
  readonly scope: SourceIngestionScope;
  readonly sourceId: string;
  readonly sourcePolicyVersion: number;
  readonly connectorId: string;
  readonly connectorVersion: number;
  readonly method: string;
  readonly purpose: string;
  readonly correlationId: string;
}

export type SourceIngestionAdmissionDecision = Readonly<{
  readonly status: "ELIGIBLE";
  readonly sourceId: string;
  readonly sourcePolicyVersion: number;
  readonly connectorId: string;
  readonly connectorVersion: number;
  readonly tenantId: string;
  readonly scope: SourceIngestionScope;
  readonly purpose: string;
  readonly method: string;
}> | Readonly<{
  readonly status: "BLOCKED";
  readonly reasonCode: "ADMISSION_DENIED";
}>;

export class SourceIngestionAdmissionGate {
  public constructor(private readonly dependencies: Readonly<{
    readonly sourcePolicies: SourceIngestionPolicyReader;
    readonly connectors: ConnectorAdmissionReader;
    readonly authorization: Pick<AuthorizationService, "evaluate">;
  }>) {}

  public evaluate(input: SourceIngestionAdmissionInput): SourceIngestionAdmissionDecision {
    if (
      !nonBlank(input.tenantId)
      || !nonBlank(input.scope.scopeId)
      || !nonBlank(input.sourceId)
      || !Number.isInteger(input.sourcePolicyVersion)
      || input.sourcePolicyVersion <= 0
      || !nonBlank(input.connectorId)
      || !Number.isInteger(input.connectorVersion)
      || input.connectorVersion <= 0
      || !nonBlank(input.method)
      || !nonBlank(input.purpose)
      || !nonBlank(input.correlationId)
    ) {
      return blocked();
    }
    try {
      const source = this.dependencies.sourcePolicies.readCurrent({
        tenantId: input.tenantId,
        sourceId: input.sourceId,
      });
      const connector = this.dependencies.connectors.readCurrent({
        tenantId: input.tenantId,
        connectorId: input.connectorId,
      });
      if (
        source?.status !== "ACTIVE"
        || source.tenantId !== input.tenantId
        || source.sourceId !== input.sourceId
        || source.version !== input.sourcePolicyVersion
        || !source.allowedMethods.includes(input.method)
        || !source.allowedPurposes.includes(input.purpose)
        || connector?.status !== "ACTIVE"
        || connector.tenantId !== input.tenantId
        || connector.connectorId !== input.connectorId
        || connector.version !== input.connectorVersion
        || !connector.sourceIds.includes(input.sourceId)
        || !connector.allowedMethods.includes(input.method)
        || !connector.allowedPurposes.includes(input.purpose)
        || !sameScope(source.scope, input.scope)
        || !sameScope(connector.scope, input.scope)
        || (input.scope.scopeType === "TEAM" && input.actor.teamId !== input.scope.scopeId)
      ) {
        return blocked();
      }
      const teamId = input.scope.scopeType === "TEAM" ? input.scope.scopeId : undefined;
      const sourceAuthorization = this.dependencies.authorization.evaluate({
        session: input.actor,
        action: "source.read",
        resource: {
          type: "SourceRegistry",
          id: source.sourceId,
          tenantId: input.tenantId,
          version: source.version,
          ...(teamId === undefined ? {} : { teamId }),
        },
        purpose: input.purpose,
        correlationId: input.correlationId,
      });
      if (sourceAuthorization.effect !== "ALLOW") return blocked();
      const intakeAuthorization = this.dependencies.authorization.evaluate({
        session: input.actor,
        action: "intake.create",
        resource: {
          type: "RawSource",
          id: source.sourceId,
          tenantId: input.tenantId,
          version: source.version,
          ...(teamId === undefined ? {} : { teamId }),
        },
        purpose: input.purpose,
        correlationId: input.correlationId,
      });
      if (intakeAuthorization.effect !== "ALLOW") return blocked();
      return Object.freeze({
        status: "ELIGIBLE" as const,
        sourceId: source.sourceId,
        sourcePolicyVersion: source.version,
        connectorId: connector.connectorId,
        connectorVersion: connector.version,
        tenantId: source.tenantId,
        scope: Object.freeze({ ...source.scope }),
        purpose: input.purpose,
        method: input.method,
      });
    } catch {
      return blocked();
    }
  }
}

function blocked(): Extract<SourceIngestionAdmissionDecision, { readonly status: "BLOCKED" }> {
  return Object.freeze({ status: "BLOCKED" as const, reasonCode: "ADMISSION_DENIED" as const });
}

function sameScope(left: SourceIngestionScope, right: SourceIngestionScope): boolean {
  return left.scopeType === right.scopeType && left.scopeId === right.scopeId;
}

function nonBlank(value: string): boolean {
  return value.trim().length > 0;
}
