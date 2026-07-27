import type { PublicationModificationCommand } from "./publication-application-contracts.js";
import { immutableInterfaceValue, isJsonInterfaceValue } from "./publication-interface-models.js";

export interface ValidPublicationInterfaceRequest {
  readonly valid: true;
}

export interface InvalidPublicationInterfaceRequest {
  readonly valid: false;
  readonly failureCode: "INTERFACE_REQUEST_INVALID";
}

export type PublicationInterfaceValidationResult = ValidPublicationInterfaceRequest | InvalidPublicationInterfaceRequest;

export interface PublicationInterfaceValidator {
  validate(request: unknown): PublicationInterfaceValidationResult;
}

const modificationTypes = [
  "BEGIN_INITIAL_EXECUTION",
  "RESOLVE_EXECUTION",
  "REQUEST_WITHDRAWAL",
  "RESOLVE_WITHDRAWAL",
  "BEGIN_ACTIVE_OPERATION",
  "BEGIN_WITHDRAWN_REPUBLISH",
  "RESOLVE_RECONCILIATION",
  "SUPERSEDE",
  "TERMINATE",
  "SET_SUSPENSION",
] as const satisfies readonly PublicationModificationCommand["type"][];

export class StructuralPublicationInterfaceValidator implements PublicationInterfaceValidator {
  public validate(request: unknown): PublicationInterfaceValidationResult {
    const valid = isRecord(request)
      && isJsonInterfaceValue(request)
      && validExecutionContext(request["context"])
      && (request["operation"] === "CREATE_PUBLICATION"
        ? hasOnlyKeys(request, ["operation", "context", "input"]) && validCreateInput(request["input"])
        : request["operation"] === "MODIFY_PUBLICATION"
          && hasOnlyKeys(request, ["operation", "context", "identity", "input"])
          && validIdentity(request["identity"])
          && validModificationInput(request["input"]));
    return valid
      ? immutableInterfaceValue({ valid: true as const })
      : immutableInterfaceValue({ valid: false as const, failureCode: "INTERFACE_REQUEST_INVALID" as const });
  }
}

function validCreateInput(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, ["identity", "binding", "prerequisites", "classification", "command", "predecessorPublicationId"])
    && validIdentity(value["identity"])
    && validBinding(value["binding"])
    && validPrerequisites(value["prerequisites"])
    && nonBlankString(value["classification"])
    && validCommandContext(value["command"])
    && (!("predecessorPublicationId" in value) || validIdentifier(value["predecessorPublicationId"]));
}

function validModificationInput(value: unknown): boolean {
  if (!(isRecord(value)
    && typeof value["type"] === "string"
    && modificationTypes.includes(value["type"] as PublicationModificationCommand["type"])
    && Number.isSafeInteger(value["expectedAggregateVersion"])
    && (value["expectedAggregateVersion"] as number) > 0
    && validCommandContext(value["command"]))) return false;
  switch (value["type"]) {
    case "BEGIN_INITIAL_EXECUTION":
    case "REQUEST_WITHDRAWAL":
      return hasOnlyKeys(value, ["type", "expectedAggregateVersion", "command", "attempt"])
        && validAttempt(value["attempt"]);
    case "RESOLVE_EXECUTION":
      return hasOnlyKeys(value, ["type", "expectedAggregateVersion", "command", "outcome", "evidenceRefs", "externalObjectReference", "reconciliationCaseId"])
        && nonBlankString(value["outcome"])
        && stringArray(value["evidenceRefs"])
        && optionalIdentifier(value, "externalObjectReference")
        && optionalIdentifier(value, "reconciliationCaseId");
    case "RESOLVE_WITHDRAWAL":
      return hasOnlyKeys(value, ["type", "expectedAggregateVersion", "command", "outcome", "evidenceRefs", "reconciliationCaseId"])
        && nonBlankString(value["outcome"])
        && stringArray(value["evidenceRefs"])
        && optionalIdentifier(value, "reconciliationCaseId");
    case "BEGIN_ACTIVE_OPERATION":
      return hasOnlyKeys(value, ["type", "expectedAggregateVersion", "command", "operation", "materiality", "nextBinding", "attempt"])
        && nonBlankString(value["operation"])
        && nonBlankString(value["materiality"])
        && validBinding(value["nextBinding"])
        && validAttempt(value["attempt"]);
    case "BEGIN_WITHDRAWN_REPUBLISH":
      return hasOnlyKeys(value, ["type", "expectedAggregateVersion", "command", "nextBinding", "attempt"])
        && validBinding(value["nextBinding"])
        && validAttempt(value["attempt"]);
    case "RESOLVE_RECONCILIATION":
      return hasOnlyKeys(value, ["type", "expectedAggregateVersion", "command", "caseId", "resolution", "evidenceRefs", "externalObjectReference"])
        && validIdentifier(value["caseId"])
        && nonBlankString(value["resolution"])
        && stringArray(value["evidenceRefs"])
        && optionalIdentifier(value, "externalObjectReference");
    case "SUPERSEDE":
      return hasOnlyKeys(value, ["type", "expectedAggregateVersion", "command", "successorPublicationId", "evidenceRefs"])
        && validIdentifier(value["successorPublicationId"])
        && stringArray(value["evidenceRefs"]);
    case "TERMINATE":
      return hasOnlyKeys(value, ["type", "expectedAggregateVersion", "command"]);
    case "SET_SUSPENSION":
      return hasOnlyKeys(value, ["type", "expectedAggregateVersion", "command", "suspensionStatus"])
        && nonBlankString(value["suspensionStatus"]);
    default:
      return false;
  }
}

function validBinding(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, ["subjectId", "subjectRevision", "representationId", "representationVersion", "representationChecksum", "approvalId", "approvalVersion", "targetId", "targetVersion", "channelId", "channelPolicyVersion"])
    && validIdentifier(value["subjectId"])
    && positiveInteger(value["subjectRevision"])
    && validIdentifier(value["representationId"])
    && positiveInteger(value["representationVersion"])
    && nonBlankString(value["representationChecksum"])
    && validIdentifier(value["approvalId"])
    && positiveInteger(value["approvalVersion"])
    && validIdentifier(value["targetId"])
    && positiveInteger(value["targetVersion"])
    && validIdentifier(value["channelId"])
    && nonBlankString(value["channelPolicyVersion"]);
}

function validPrerequisites(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, ["immutableSnapshot", "effectiveApproval", "exactTargetChannel", "provenancePresent"])
    && typeof value["immutableSnapshot"] === "boolean"
    && typeof value["effectiveApproval"] === "boolean"
    && typeof value["exactTargetChannel"] === "boolean"
    && typeof value["provenancePresent"] === "boolean";
}

function validAttempt(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, ["id", "commandId", "operation", "occurredAt", "evidenceRefs"])
    && validIdentifier(value["id"])
    && validIdentifier(value["commandId"])
    && nonBlankString(value["operation"])
    && nonBlankString(value["occurredAt"])
    && stringArray(value["evidenceRefs"]);
}

function validExecutionContext(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, ["actorId", "correlationId", "idempotencyKey", "intentFingerprint"])
    && nonBlankString(value["actorId"])
    && nonBlankString(value["correlationId"])
    && validIdentifier(value["idempotencyKey"])
    && nonBlankString(value["intentFingerprint"]);
}

function validCommandContext(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, ["actorId", "authorityContext", "reason", "correlationId", "occurredAt"])
    && nonBlankString(value["actorId"])
    && nonBlankString(value["authorityContext"])
    && nonBlankString(value["reason"])
    && nonBlankString(value["correlationId"])
    && nonBlankString(value["occurredAt"]);
}

function validIdentity(value: unknown): boolean {
  return isRecord(value)
    && hasOnlyKeys(value, ["publicationId", "tenantScopeId"])
    && validIdentifier(value["publicationId"])
    && validIdentifier(value["tenantScopeId"]);
}

function validIdentifier(value: unknown): boolean {
  return typeof value === "string" && /^\S+$/.test(value);
}

function nonBlankString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function positiveInteger(value: unknown): boolean {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function stringArray(value: unknown): boolean {
  return Array.isArray(value)
    && Object.keys(value).length === value.length
    && value.every((item) => typeof item === "string");
}

function optionalIdentifier(value: Readonly<Record<string, unknown>>, key: string): boolean {
  return !(key in value) || validIdentifier(value[key]);
}

function hasOnlyKeys(value: Readonly<Record<string, unknown>>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
