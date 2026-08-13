import { createHash } from "node:crypto";

import type { PrincipalType, RoleCode } from "../../../packages/security-contracts/src/index.js";
import {
  hasVerifiedMfaAssurance,
  isAuthenticationAssuranceConsistent,
  type SessionContext,
} from "../../../modules/identity/src/session-service.js";
import {
  AdministrationContractValidationError,
  failValidation,
  requireBoundedString,
  requireCanonicalId,
  requireCanonicalIdList,
  requireCanonicalVersion,
  requireClosedValue,
  requireExactKeys,
  requireIsoTimestamp,
  requireRecord,
  requireSafeReason,
} from "./administration-api-validation.js";

export const ADMINISTRATION_API_COMMAND_OPERATIONS = Object.freeze([
  "PROPOSE_ROLE_ASSIGNMENT",
  "APPROVE_ROLE_ASSIGNMENT",
  "REJECT_ROLE_ASSIGNMENT",
  "REVOKE_ROLE_ASSIGNMENT",
  "PROPOSE_ROLE_CHANGE",
  "APPROVE_ROLE_CHANGE",
  "REJECT_ROLE_CHANGE",
  "PROPOSE_POLICY_CHANGE",
  "APPROVE_POLICY_CHANGE",
  "REJECT_POLICY_CHANGE",
  "PROPOSE_TEAM_SCOPE_CHANGE",
  "APPROVE_TEAM_SCOPE_CHANGE",
  "REJECT_TEAM_SCOPE_CHANGE",
  "PROPOSE_SOURCE_GOVERNANCE",
  "APPROVE_SOURCE_GOVERNANCE",
  "REJECT_SOURCE_GOVERNANCE",
  "TRANSITION_SOURCE_GOVERNANCE",
  "PROPOSE_PUBLICATION_TARGET_GOVERNANCE",
  "APPROVE_PUBLICATION_TARGET_GOVERNANCE",
  "REJECT_PUBLICATION_TARGET_GOVERNANCE",
  "TRANSITION_PUBLICATION_TARGET_GOVERNANCE",
] as const);

export const ADMINISTRATION_API_QUERY_OPERATIONS = Object.freeze([
  "READ_ROLE_ASSIGNMENT",
  "LIST_ROLE_ASSIGNMENTS",
  "READ_ROLE",
  "LIST_ROLES",
  "READ_POLICY",
  "LIST_POLICIES",
  "READ_TEAM_SCOPE",
  "LIST_TEAM_SCOPES",
  "READ_SOURCE_GOVERNANCE",
  "LIST_SOURCE_GOVERNANCE",
  "READ_PUBLICATION_TARGET_GOVERNANCE",
  "LIST_PUBLICATION_TARGET_GOVERNANCE",
  "LIST_ADMINISTRATION_PROPOSALS",
  "READ_ADMINISTRATION_DECISION",
  "LIST_ADMINISTRATION_DECISIONS",
] as const);

export type AdministrationApiCommandOperation = typeof ADMINISTRATION_API_COMMAND_OPERATIONS[number];
export type AdministrationApiQueryOperation = typeof ADMINISTRATION_API_QUERY_OPERATIONS[number];
export type AdministrationGovernedResourceType =
  | "ROLE_ASSIGNMENT"
  | "ROLE"
  | "POLICY"
  | "TEAM_SCOPE"
  | "SOURCE_REGISTRY"
  | "PUBLICATION_TARGET";
export type AdministrationScopeType = "TENANT" | "TEAM" | "ORGANIZATION" | "RESOURCE" | "POLICY" | "SOURCE" | "TARGET";

export interface AdministrationOperationDescriptor {
  readonly kind: "COMMAND" | "QUERY";
  readonly resourceType: AdministrationGovernedResourceType | "ADMINISTRATION_DECISION" | "ADMINISTRATION_PROPOSAL";
  readonly allowedScopeTypes: readonly AdministrationScopeType[];
  readonly requiresHumanActor: boolean;
  readonly requiresMfa: boolean;
  readonly requiresReason: boolean;
  readonly requiresExpectedVersion: boolean;
  readonly requiresIdempotency: boolean;
  readonly requiresLiveAuthorization: boolean;
  readonly requiresCurrentPolicy: boolean;
  readonly requiresIndependentProposal: boolean;
}

type ContractValue = unknown;

export interface AdministrationScopeReference {
  readonly tenantId: string;
  readonly scopeType: AdministrationScopeType;
  readonly scopeId: string;
}

export interface AdministrationEvidenceReference {
  readonly type: "DECISION" | "APPROVAL" | "AUDIT" | "CASE";
  readonly id: string;
  readonly version: number;
}

interface AdministrationApiRequestEnvelope<Operation extends string> {
  readonly requestId: string;
  readonly sessionId: string;
  readonly tenantId: string;
  readonly correlationId: string;
  readonly operation: Operation;
}

export interface AdministrationApiCommandRequest extends AdministrationApiRequestEnvelope<AdministrationApiCommandOperation> {
  readonly kind: "COMMAND";
  readonly payload: Readonly<Record<string, ContractValue>> & Readonly<{
    readonly scope: AdministrationScopeReference;
    readonly expectedVersion: number;
    readonly idempotencyKey: string;
    readonly reason: string;
    readonly evidenceReferences: readonly AdministrationEvidenceReference[];
  }>;
}

export interface AdministrationApiQueryRequest extends AdministrationApiRequestEnvelope<AdministrationApiQueryOperation> {
  readonly kind: "QUERY";
  readonly payload: Readonly<Record<string, ContractValue>> & Readonly<{
    readonly scope: AdministrationScopeReference;
  }>;
}

export type AdministrationApiRequest = AdministrationApiCommandRequest | AdministrationApiQueryRequest;

export const ADMINISTRATION_API_OPERATION_REGISTRY: Readonly<Record<AdministrationApiCommandOperation | AdministrationApiQueryOperation, AdministrationOperationDescriptor>> = Object.freeze(
  Object.fromEntries([
    ...ADMINISTRATION_API_COMMAND_OPERATIONS.map((operation) => [operation, commandDescriptor(operation)] as const),
    ...ADMINISTRATION_API_QUERY_OPERATIONS.map((operation) => [operation, queryDescriptor(operation)] as const),
  ]) as unknown as Record<AdministrationApiCommandOperation | AdministrationApiQueryOperation, AdministrationOperationDescriptor>,
);

export interface AdministrationSessionResolver {
  resolve(sessionId: string): SessionContext | undefined;
}

export interface ResolvedAdministrationApiRequest<Request extends AdministrationApiRequest = AdministrationApiRequest> {
  readonly request: Request;
  readonly actor: SessionContext;
}

export interface AdministrationCommandIdentity {
  readonly tenantId: string;
  readonly actorId: string;
  readonly operation: AdministrationApiCommandOperation;
  readonly resourceIdentity: string;
  readonly idempotencyKey: string;
}

export interface AdministrationProposalEvidence {
  readonly proposalId: string;
  readonly proposerId: string;
  readonly resourceType: AdministrationGovernedResourceType;
  readonly resourceId: string;
  readonly scope: AdministrationScopeReference;
  readonly proposedChangeReference: string;
  readonly policyReference: string;
  readonly version: number;
  readonly reasonReference: string;
  readonly evidenceReferences: readonly AdministrationEvidenceReference[];
}

export interface AdministrationApiCommandResult {
  readonly operation: AdministrationApiCommandOperation;
  readonly proposalId: string;
  readonly resourceType: AdministrationGovernedResourceType;
  readonly resourceId: string;
  readonly status: "PROPOSED" | "ACTIVE" | "REJECTED" | "REVOKED" | "PAUSED" | "BLOCKED" | "RETIRED";
  readonly version: number;
  readonly decisionReferences: readonly string[];
  readonly evidenceReferences: readonly AdministrationEvidenceReference[];
}

export interface AdministrationCollectionView<Item> {
  readonly items: readonly Item[];
  readonly nextCursor?: string;
}

interface AdministrationGovernedViewBase<Status extends string> {
  readonly scope: AdministrationScopeReference;
  readonly status: Status;
  readonly version: number;
  readonly evidenceReferences: readonly AdministrationEvidenceReference[];
}

export interface AdministrationRoleAssignmentView extends AdministrationGovernedViewBase<"PROPOSED" | "ACTIVE" | "REVOKED"> {
  readonly viewType: "ROLE_ASSIGNMENT";
  readonly roleAssignmentId: string;
  readonly subjectPrincipalReference: string;
  readonly roleId: string;
}
export interface AdministrationRoleView extends AdministrationGovernedViewBase<"ACTIVE" | "RETIRED"> { readonly viewType: "ROLE"; readonly roleId: string }
export interface AdministrationPolicyView extends AdministrationGovernedViewBase<"PROPOSED" | "ACTIVE" | "REJECTED" | "REVOKED"> { readonly viewType: "POLICY"; readonly policyId: string }
export interface AdministrationTeamScopeView extends AdministrationGovernedViewBase<"PROPOSED" | "ACTIVE" | "REVOKED"> { readonly viewType: "TEAM_SCOPE"; readonly teamId: string }
export interface AdministrationSourceGovernanceView extends AdministrationGovernedViewBase<"DRAFT" | "UNDER_REVIEW" | "ACTIVE" | "PAUSED" | "BLOCKED" | "RETIRED"> { readonly viewType: "SOURCE_GOVERNANCE"; readonly sourceRegistryEntryId: string; readonly policyReference: string }
export interface AdministrationPublicationTargetGovernanceView extends AdministrationGovernedViewBase<"PROPOSED" | "ACTIVE" | "PAUSED" | "RETIRED"> { readonly viewType: "PUBLICATION_TARGET_GOVERNANCE"; readonly publicationTargetId: string; readonly policyReference: string; readonly channelReference: string }
export interface AdministrationProposalView extends AdministrationGovernedViewBase<"PROPOSED" | "APPROVED" | "REJECTED" | "REVOKED"> { readonly viewType: "ADMINISTRATION_PROPOSAL"; readonly proposalId: string; readonly proposerReference: string; readonly proposedChangeReference: string }
export interface AdministrationDecisionSummaryView extends AdministrationGovernedViewBase<"APPROVED" | "REJECTED" | "REVOKED"> { readonly viewType: "ADMINISTRATION_DECISION"; readonly decisionId: string; readonly proposalId: string; readonly decisionActorReference: string }
export type AdministrationReadView =
  | AdministrationRoleAssignmentView | AdministrationRoleView | AdministrationPolicyView
  | AdministrationTeamScopeView | AdministrationSourceGovernanceView
  | AdministrationPublicationTargetGovernanceView | AdministrationProposalView
  | AdministrationDecisionSummaryView;

export type AdministrationApiErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "AUTHORIZATION_DENIED"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "SELF_APPROVAL_FORBIDDEN"
  | "MFA_REQUIRED"
  | "VERSION_CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_STATE"
  | "POLICY_DENIED"
  | "INTERNAL_ERROR";

export class AdministrationApiError extends Error {
  public constructor(public readonly code: AdministrationApiErrorCode, internalMessage: string = code) {
    super(internalMessage);
    this.name = "AdministrationApiError";
  }
}

export function parseAdministrationApiRequest(input: unknown): AdministrationApiRequest {
  try {
    const envelope = requireRecord(input);
    requireExactKeys(envelope, ["requestId", "sessionId", "tenantId", "correlationId", "operation", "payload"]);
    const requestId = requireCanonicalId(envelope["requestId"]);
    const sessionId = requireCanonicalId(envelope["sessionId"]);
    const tenantId = requireCanonicalId(envelope["tenantId"]);
    const correlationId = requireCanonicalId(envelope["correlationId"]);
    const operation = requireBoundedString(envelope["operation"], 3, 80);
    if ((ADMINISTRATION_API_COMMAND_OPERATIONS as readonly string[]).includes(operation)) {
      return immutableAdministrationApiValue({
        kind: "COMMAND",
        requestId,
        sessionId,
        tenantId,
        correlationId,
        operation: operation as AdministrationApiCommandOperation,
        payload: parseCommandPayload(operation as AdministrationApiCommandOperation, envelope["payload"], tenantId),
      });
    }
    if ((ADMINISTRATION_API_QUERY_OPERATIONS as readonly string[]).includes(operation)) {
      return immutableAdministrationApiValue({
        kind: "QUERY",
        requestId,
        sessionId,
        tenantId,
        correlationId,
        operation: operation as AdministrationApiQueryOperation,
        payload: parseQueryPayload(operation as AdministrationApiQueryOperation, envelope["payload"], tenantId),
      });
    }
    failValidation();
  } catch (error: unknown) {
    if (error instanceof AdministrationApiError) throw error;
    if (error instanceof AdministrationContractValidationError) throw new AdministrationApiError("VALIDATION_FAILED");
    throw error;
  }
}

export function resolveAdministrationApiSession<Request extends AdministrationApiRequest>(
  request: Request,
  sessionResolver?: AdministrationSessionResolver,
  clock: () => Date = () => new Date(),
): ResolvedAdministrationApiRequest<Request> {
  let session: SessionContext | undefined;
  try {
    session = sessionResolver?.resolve(request.sessionId);
  } catch {
    throw new AdministrationApiError("AUTHENTICATION_REQUIRED");
  }
  const now = clock().getTime();
  const expiresAt = session === undefined ? Number.NaN : Date.parse(session.expiresAt);
  const absoluteExpiresAt = session === undefined ? Number.NaN : Date.parse(session.absoluteExpiresAt);
  if (
    session?.id !== request.sessionId
    || session.state !== "ACTIVE"
    || !Number.isFinite(expiresAt)
    || !Number.isFinite(absoluteExpiresAt)
    || now >= expiresAt
    || now >= absoluteExpiresAt
  ) {
    throw new AdministrationApiError("AUTHENTICATION_REQUIRED");
  }
  if (!isAuthenticationAssuranceConsistent(session)) throw new AdministrationApiError("MFA_REQUIRED");
  if (request.kind === "COMMAND") {
    if (session.principalType !== "HUMAN") throw new AdministrationApiError("AUTHORIZATION_DENIED");
    if (!hasVerifiedMfaAssurance(session)) throw new AdministrationApiError("MFA_REQUIRED");
  }
  return immutableAdministrationApiValue({ request, actor: session });
}

export function assertIndependentAdministrationApproval(
  actor: SessionContext,
  proposal: AdministrationProposalEvidence,
): void {
  if (actor.principalId === proposal.proposerId) throw new AdministrationApiError("SELF_APPROVAL_FORBIDDEN");
}

export function createAdministrationProposalResult(
  result: AdministrationApiCommandResult & Readonly<{ readonly status: "PROPOSED" }>,
): AdministrationApiCommandResult {
  return createAdministrationCommandResult(result);
}

export function createAdministrationCommandResult(input: unknown): AdministrationApiCommandResult {
  try {
    const value = requireRecord(input);
    requireExactKeys(value, ["operation", "resourceType", "resourceId", "status", "version", "decisionReferences", "evidenceReferences"], ["proposalId"]);
    const proposalId = requireCanonicalId(value["proposalId"]);
    const result = {
      operation: requireClosedValue(value["operation"], ADMINISTRATION_API_COMMAND_OPERATIONS),
      proposalId,
      resourceType: requireClosedValue(value["resourceType"], governedResourceTypes),
      resourceId: requireCanonicalId(value["resourceId"]),
      status: requireClosedValue(value["status"], ["PROPOSED", "ACTIVE", "REJECTED", "REVOKED", "PAUSED", "BLOCKED", "RETIRED"] as const),
      version: requireCanonicalVersion(value["version"]),
      decisionReferences: value["decisionReferences"] === undefined ? Object.freeze([]) : requireCanonicalIdListAllowEmpty(value["decisionReferences"]),
      evidenceReferences: parseEvidenceReferences(value["evidenceReferences"], true),
    };
    if (result.resourceType !== ADMINISTRATION_API_OPERATION_REGISTRY[result.operation].resourceType) failValidation();
    if (result.operation.startsWith("PROPOSE_") && result.status !== "PROPOSED") failValidation();
    if (result.operation.startsWith("APPROVE_") && result.status !== "ACTIVE") failValidation();
    if (result.operation.startsWith("REJECT_") && result.status !== "REJECTED") failValidation();
    if (result.operation.startsWith("REVOKE_") && result.status !== "REVOKED") failValidation();
    if (result.operation === "TRANSITION_SOURCE_GOVERNANCE" && !["PAUSED", "BLOCKED", "RETIRED"].includes(result.status)) failValidation();
    if (result.operation === "TRANSITION_PUBLICATION_TARGET_GOVERNANCE" && !["PAUSED", "RETIRED"].includes(result.status)) failValidation();
    return immutableAdministrationApiValue(result);
  } catch (error: unknown) {
    if (error instanceof AdministrationContractValidationError) throw new AdministrationApiError("VALIDATION_FAILED");
    throw error;
  }
}

export function createAdministrationCollectionView(input: unknown): AdministrationCollectionView<AdministrationReadView> {
  try {
    const value = requireRecord(input);
    requireExactKeys(value, ["items"], ["nextCursor"]);
    if (!Array.isArray(value["items"]) || value["items"].length > 100) failValidation();
    return immutableAdministrationApiValue({
      items: Object.freeze(value["items"].map(createAdministrationReadView)),
      ...(value["nextCursor"] === undefined ? {} : { nextCursor: requireCanonicalId(value["nextCursor"]) }),
    });
  } catch (error: unknown) {
    if (error instanceof AdministrationApiError) throw error;
    if (error instanceof AdministrationContractValidationError) throw new AdministrationApiError("VALIDATION_FAILED");
    throw error;
  }
}

export function createAdministrationReadView(input: unknown): AdministrationReadView {
  try {
    const value = requireRecord(input);
    const viewType = requireClosedValue(value["viewType"], readViewTypes);
    const identityKeys = readViewIdentityKeys[viewType];
    const extraKeys = viewType === "ROLE_ASSIGNMENT" ? ["subjectPrincipalReference", "roleId"]
      : viewType === "SOURCE_GOVERNANCE" ? ["policyReference"]
        : viewType === "PUBLICATION_TARGET_GOVERNANCE" ? ["policyReference", "channelReference"]
          : viewType === "ADMINISTRATION_PROPOSAL" ? ["proposerReference", "proposedChangeReference"]
            : viewType === "ADMINISTRATION_DECISION" ? ["proposalId", "decisionActorReference"] : [];
    requireExactKeys(value, ["viewType", identityKeys, ...extraKeys, "scope", "status", "version", "evidenceReferences"]);
    const result: Record<string, unknown> = {
      viewType,
      [identityKeys]: requireCanonicalId(value[identityKeys]),
      scope: parseScopeWithoutEnvelope(value["scope"]),
      status: requireClosedValue(value["status"], readViewStatuses[viewType]),
      version: requireCanonicalVersion(value["version"]),
      evidenceReferences: parseEvidenceReferences(value["evidenceReferences"], true),
    };
    const governedViewResource = viewType === "SOURCE_GOVERNANCE" ? "SOURCE_REGISTRY"
      : viewType === "PUBLICATION_TARGET_GOVERNANCE" ? "PUBLICATION_TARGET"
        : viewType;
    const allowedScopes = allowedScopesForResource(governedViewResource);
    if (!allowedScopes.includes((result["scope"] as AdministrationScopeReference).scopeType)) failValidation();
    for (const key of extraKeys) result[key] = requireCanonicalId(value[key]);
    return immutableAdministrationApiValue(result) as unknown as AdministrationReadView;
  } catch (error: unknown) {
    if (error instanceof AdministrationContractValidationError) throw new AdministrationApiError("VALIDATION_FAILED");
    throw error;
  }
}

export function createAdministrationCommandFingerprint(request: AdministrationApiCommandRequest): string {
  const intentPayload: Record<string, unknown> = { ...request.payload };
  delete intentPayload["idempotencyKey"];
  const canonicalIntent = stableJson(normalizeIntent({
    tenantId: request.tenantId,
    operation: request.operation,
    payload: intentPayload,
  }));
  return createHash("sha256").update(canonicalIntent).digest("hex");
}

export function createAdministrationCommandIdentity(
  resolved: ResolvedAdministrationApiRequest<AdministrationApiCommandRequest>,
): AdministrationCommandIdentity {
  const payload = resolved.request.payload;
  const resourceIdentity = [
    "roleAssignmentId",
    "roleId",
    "policyId",
    "teamId",
    "sourceRegistryEntryId",
    "publicationTargetId",
    "proposalId",
    "subjectPrincipalId",
  ].map((key) => payload[key]).find((value): value is string => typeof value === "string")
    ?? `NEW:${resolved.request.operation}`;
  return immutableAdministrationApiValue({
    tenantId: resolved.request.tenantId,
    actorId: resolved.actor.principalId,
    operation: resolved.request.operation,
    resourceIdentity,
    idempotencyKey: resolved.request.payload.idempotencyKey,
  });
}

export function safeAdministrationApiError(error: unknown): Readonly<{ code: AdministrationApiErrorCode; message: string }> {
  const mappedCode = error instanceof AdministrationApiError
    ? error.code
    : error instanceof Error
      ? administrationErrorCodeMap[error.message] ?? "INTERNAL_ERROR"
      : "INTERNAL_ERROR";
  const code = mappedCode === "AUTHORIZATION_DENIED" ? "NOT_FOUND" : mappedCode;
  const message = code === "AUTHENTICATION_REQUIRED"
    ? "Authentication required."
    : code === "NOT_FOUND"
      ? "Resource not found."
      : code === "VALIDATION_FAILED"
        ? "Request validation failed."
        : "Request could not be completed.";
  return Object.freeze({ code, message });
}

export function immutableAdministrationApiValue<Value>(value: Value): Value {
  const copy = structuredClone(value);
  deepFreeze(copy);
  return copy;
}

function parseCommandPayload(
  operation: AdministrationApiCommandOperation,
  input: unknown,
  tenantId: string,
): AdministrationApiCommandRequest["payload"] {
  const payload = requireRecord(input);
  const common = ["scope", "expectedVersion", "idempotencyKey", "reason", "evidenceReferences"] as const;
  const identityKeys = commandIdentityKeys(operation);
  const proposalKeys = operation === "PROPOSE_ROLE_ASSIGNMENT"
    ? ["subjectPrincipalId", "subjectPrincipalType", "role", "teamIds", "resourceTypes", "purposes", "effectiveFrom", "effectiveUntil"]
    : operation === "PROPOSE_SOURCE_GOVERNANCE"
      ? ["name", "sourceType", "policyReference", "allowedMethods", "allowedPurposes", "classification"]
      : operation === "PROPOSE_PUBLICATION_TARGET_GOVERNANCE"
        ? ["name", "targetType", "channelReference", "policyReference", "allowedFieldReferences"]
    : operation.startsWith("PROPOSE_")
      ? ["proposedChangeReference"]
      : operation.startsWith("TRANSITION_")
        ? ["targetStatus"]
        : [];
  requireExactKeys(payload, [...identityKeys, ...proposalKeys, ...common]);
  const parsed: Record<string, ContractValue> = {};
  for (const key of identityKeys) parsed[key] = requireCanonicalId(payload[key]);
  if (operation === "PROPOSE_ROLE_ASSIGNMENT") {
    parsed["subjectPrincipalId"] = requireCanonicalId(payload["subjectPrincipalId"]);
    parsed["subjectPrincipalType"] = requireClosedValue(payload["subjectPrincipalType"], ["HUMAN", "SERVICE"] satisfies readonly PrincipalType[]);
    parsed["role"] = requireClosedValue(payload["role"], roleCodes);
    parsed["teamIds"] = requireCanonicalIdList(payload["teamIds"]);
    parsed["resourceTypes"] = requireCanonicalIdList(payload["resourceTypes"]);
    parsed["purposes"] = requireCanonicalIdList(payload["purposes"]);
    parsed["effectiveFrom"] = requireIsoTimestamp(payload["effectiveFrom"]);
    parsed["effectiveUntil"] = requireIsoTimestamp(payload["effectiveUntil"]);
    if (Date.parse(parsed["effectiveFrom"] as string) >= Date.parse(parsed["effectiveUntil"] as string)) failValidation();
  } else if (operation === "PROPOSE_SOURCE_GOVERNANCE") {
    parsed["name"] = requireBoundedString(payload["name"], 3, 160);
    parsed["sourceType"] = requireCanonicalId(payload["sourceType"]);
    parsed["policyReference"] = requireCanonicalId(payload["policyReference"]);
    parsed["allowedMethods"] = requireCanonicalIdList(payload["allowedMethods"]);
    parsed["allowedPurposes"] = requireCanonicalIdList(payload["allowedPurposes"]);
    parsed["classification"] = requireClosedValue(payload["classification"], [
      "PUBLIC_APPROVED", "INTERNAL", "CONFIDENTIAL_BUSINESS", "RESTRICTED_PERSONAL", "RESTRICTED_SECURITY",
    ] as const);
  } else if (operation === "PROPOSE_PUBLICATION_TARGET_GOVERNANCE") {
    parsed["name"] = requireBoundedString(payload["name"], 3, 160);
    parsed["targetType"] = requireCanonicalId(payload["targetType"]);
    parsed["channelReference"] = requireCanonicalId(payload["channelReference"]);
    parsed["policyReference"] = requireCanonicalId(payload["policyReference"]);
    parsed["allowedFieldReferences"] = requireCanonicalIdList(payload["allowedFieldReferences"]);
  } else if (operation.startsWith("PROPOSE_")) {
    parsed["proposedChangeReference"] = requireCanonicalId(payload["proposedChangeReference"]);
  } else if (operation === "TRANSITION_SOURCE_GOVERNANCE") {
    parsed["targetStatus"] = requireClosedValue(payload["targetStatus"], ["PAUSED", "BLOCKED", "RETIRED"]);
  } else if (operation === "TRANSITION_PUBLICATION_TARGET_GOVERNANCE") {
    parsed["targetStatus"] = requireClosedValue(payload["targetStatus"], ["PAUSED", "RETIRED"]);
  }
  parsed["scope"] = parseScope(payload["scope"], tenantId);
  if (!ADMINISTRATION_API_OPERATION_REGISTRY[operation].allowedScopeTypes.includes((parsed["scope"] as AdministrationScopeReference).scopeType)) failValidation();
  parsed["expectedVersion"] = requireCanonicalVersion(payload["expectedVersion"]);
  if (
    (operation === "PROPOSE_ROLE_ASSIGNMENT"
      || operation === "PROPOSE_SOURCE_GOVERNANCE"
      || operation === "PROPOSE_PUBLICATION_TARGET_GOVERNANCE")
    && parsed["expectedVersion"] !== 0
  ) failValidation();
  parsed["idempotencyKey"] = requireCanonicalId(payload["idempotencyKey"]);
  parsed["reason"] = requireSafeReason(payload["reason"]);
  parsed["evidenceReferences"] = parseEvidenceReferences(payload["evidenceReferences"]);
  return immutableAdministrationApiValue(parsed) as AdministrationApiCommandRequest["payload"];
}

function parseQueryPayload(
  operation: AdministrationApiQueryOperation,
  input: unknown,
  tenantId: string,
): AdministrationApiQueryRequest["payload"] {
  const payload = requireRecord(input);
  const identityKey = queryIdentityKey(operation);
  const isRead = operation.startsWith("READ_");
  requireExactKeys(
    payload,
    ["scope", ...(isRead && identityKey !== undefined ? [identityKey] : [])],
    isRead ? [] : ["pagination", "status"],
  );
  const parsed: Record<string, ContractValue> = { scope: parseScope(payload["scope"], tenantId) };
  if (!ADMINISTRATION_API_OPERATION_REGISTRY[operation].allowedScopeTypes.includes((parsed["scope"] as AdministrationScopeReference).scopeType)) failValidation();
  if (identityKey !== undefined && payload[identityKey] !== undefined) parsed[identityKey] = requireCanonicalId(payload[identityKey]);
  if (payload["pagination"] !== undefined) parsed["pagination"] = parsePagination(payload["pagination"]);
  if (payload["status"] !== undefined) parsed["status"] = requireClosedValue(payload["status"], queryStatuses(operation));
  return immutableAdministrationApiValue(parsed) as AdministrationApiQueryRequest["payload"];
}

function commandIdentityKeys(operation: AdministrationApiCommandOperation): readonly string[] {
  if (operation === "PROPOSE_ROLE_ASSIGNMENT") return [];
  if (operation === "REVOKE_ROLE_ASSIGNMENT") return ["proposalId", "roleAssignmentId"];
  if (operation.endsWith("ROLE_ASSIGNMENT")) return ["proposalId", "roleAssignmentId"];
  if (operation.endsWith("ROLE_CHANGE")) return operation.startsWith("PROPOSE_") ? ["roleId"] : ["proposalId", "roleId"];
  if (operation.endsWith("POLICY_CHANGE")) return operation.startsWith("PROPOSE_") ? ["policyId"] : ["proposalId", "policyId"];
  if (operation.endsWith("TEAM_SCOPE_CHANGE")) return operation.startsWith("PROPOSE_") ? ["teamId"] : ["proposalId", "teamId"];
  if (operation.includes("SOURCE_GOVERNANCE")) return operation.startsWith("PROPOSE_")
    ? []
    : ["proposalId", "sourceRegistryEntryId"];
  return operation.startsWith("PROPOSE_")
    ? []
    : ["proposalId", "publicationTargetId"];
}

function queryIdentityKey(operation: AdministrationApiQueryOperation): string | undefined {
  if (operation === "READ_ROLE_ASSIGNMENT") return "roleAssignmentId";
  if (operation === "READ_ROLE") return "roleId";
  if (operation === "READ_POLICY") return "policyId";
  if (operation === "READ_TEAM_SCOPE") return "teamId";
  if (operation === "READ_SOURCE_GOVERNANCE") return "sourceRegistryEntryId";
  if (operation === "READ_PUBLICATION_TARGET_GOVERNANCE") return "publicationTargetId";
  if (operation === "READ_ADMINISTRATION_DECISION") return "decisionId";
  return undefined;
}

function queryStatuses(operation: AdministrationApiQueryOperation): readonly string[] {
  if (operation === "LIST_ROLE_ASSIGNMENTS") return ["PROPOSED", "ACTIVE", "REVOKED"];
  if (operation === "LIST_ROLES") return ["ACTIVE", "RETIRED"];
  if (operation === "LIST_POLICIES") return ["PROPOSED", "ACTIVE", "REJECTED", "REVOKED"];
  if (operation === "LIST_TEAM_SCOPES") return ["PROPOSED", "ACTIVE", "REVOKED"];
  if (operation === "LIST_SOURCE_GOVERNANCE") return ["DRAFT", "UNDER_REVIEW", "ACTIVE", "PAUSED", "BLOCKED", "RETIRED"];
  if (operation === "LIST_PUBLICATION_TARGET_GOVERNANCE") return ["PROPOSED", "ACTIVE", "PAUSED", "RETIRED"];
  if (operation === "LIST_ADMINISTRATION_PROPOSALS") return ["PROPOSED", "APPROVED", "REJECTED", "REVOKED"];
  if (operation === "LIST_ADMINISTRATION_DECISIONS") return ["APPROVED", "REJECTED", "REVOKED"];
  return [];
}

function parseScope(input: unknown, tenantId: string): AdministrationScopeReference {
  const scope = requireRecord(input);
  requireExactKeys(scope, ["tenantId", "scopeType", "scopeId"]);
  const parsed = {
    tenantId: requireCanonicalId(scope["tenantId"]),
    scopeType: requireClosedValue(scope["scopeType"], ["TENANT", "TEAM", "ORGANIZATION", "RESOURCE", "POLICY", "SOURCE", "TARGET"] as const),
    scopeId: requireCanonicalId(scope["scopeId"]),
  };
  if (parsed.tenantId !== tenantId || parsed.scopeId === "*") failValidation();
  return immutableAdministrationApiValue(parsed);
}

function parseEvidenceReferences(input: unknown, allowEmpty = false): readonly AdministrationEvidenceReference[] {
  if (!Array.isArray(input) || (!allowEmpty && input.length === 0) || input.length > 20) failValidation();
  return Object.freeze(input.map((value) => {
    const reference = requireRecord(value);
    requireExactKeys(reference, ["type", "id", "version"]);
    return Object.freeze({
      type: requireClosedValue(reference["type"], ["DECISION", "APPROVAL", "AUDIT", "CASE"] as const),
      id: requireCanonicalId(reference["id"]),
      version: requireCanonicalVersion(reference["version"]),
    });
  }));
}

function requireCanonicalIdListAllowEmpty(input: unknown): readonly string[] {
  if (!Array.isArray(input) || input.length > 20) failValidation();
  if (input.length === 0) return Object.freeze([]);
  return requireCanonicalIdList(input, 20);
}

function parseScopeWithoutEnvelope(input: unknown): AdministrationScopeReference {
  const scope = requireRecord(input);
  requireExactKeys(scope, ["tenantId", "scopeType", "scopeId"]);
  return immutableAdministrationApiValue({
    tenantId: requireCanonicalId(scope["tenantId"]),
    scopeType: requireClosedValue(scope["scopeType"], scopeTypes),
    scopeId: requireCanonicalId(scope["scopeId"]),
  });
}

function parsePagination(input: unknown): Readonly<{ limit: number; cursor?: string }> {
  const pagination = requireRecord(input);
  requireExactKeys(pagination, ["limit"], ["cursor"]);
  if (!Number.isSafeInteger(pagination["limit"]) || (pagination["limit"] as number) < 1 || (pagination["limit"] as number) > 100) failValidation();
  return Object.freeze({
    limit: pagination["limit"] as number,
    ...(pagination["cursor"] === undefined ? {} : { cursor: requireCanonicalId(pagination["cursor"]) }),
  });
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizeIntent(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeIntent).sort((left, right) => stableJson(left).localeCompare(stableJson(right)));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, normalizeIntent(child)]));
  }
  return value;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
  for (const child of Object.values(value)) deepFreeze(child);
  Object.freeze(value);
}

const roleCodes = [
  "COL", "AGT", "SAG", "REV", "AIR", "DUR", "VER", "PMR", "PUA", "MGR", "DST", "OPS", "SEC", "ADM", "SVC", "EXT",
] as const satisfies readonly RoleCode[];

const governedResourceTypes = ["ROLE_ASSIGNMENT", "ROLE", "POLICY", "TEAM_SCOPE", "SOURCE_REGISTRY", "PUBLICATION_TARGET"] as const;
const scopeTypes = ["TENANT", "TEAM", "ORGANIZATION", "RESOURCE", "POLICY", "SOURCE", "TARGET"] as const;
const readViewTypes = ["ROLE_ASSIGNMENT", "ROLE", "POLICY", "TEAM_SCOPE", "SOURCE_GOVERNANCE", "PUBLICATION_TARGET_GOVERNANCE", "ADMINISTRATION_PROPOSAL", "ADMINISTRATION_DECISION"] as const;
const readViewIdentityKeys: Readonly<Record<typeof readViewTypes[number], string>> = Object.freeze({
  ROLE_ASSIGNMENT: "roleAssignmentId", ROLE: "roleId", POLICY: "policyId", TEAM_SCOPE: "teamId",
  SOURCE_GOVERNANCE: "sourceRegistryEntryId", PUBLICATION_TARGET_GOVERNANCE: "publicationTargetId",
  ADMINISTRATION_PROPOSAL: "proposalId", ADMINISTRATION_DECISION: "decisionId",
});
const readViewStatuses: Readonly<Record<typeof readViewTypes[number], readonly string[]>> = Object.freeze({
  ROLE_ASSIGNMENT: ["PROPOSED", "ACTIVE", "REVOKED"], ROLE: ["ACTIVE", "RETIRED"],
  POLICY: ["PROPOSED", "ACTIVE", "REJECTED", "REVOKED"], TEAM_SCOPE: ["PROPOSED", "ACTIVE", "REVOKED"],
  SOURCE_GOVERNANCE: ["DRAFT", "UNDER_REVIEW", "ACTIVE", "PAUSED", "BLOCKED", "RETIRED"],
  PUBLICATION_TARGET_GOVERNANCE: ["PROPOSED", "ACTIVE", "PAUSED", "RETIRED"],
  ADMINISTRATION_PROPOSAL: ["PROPOSED", "APPROVED", "REJECTED", "REVOKED"],
  ADMINISTRATION_DECISION: ["APPROVED", "REJECTED", "REVOKED"],
});

function resourceTypeForOperation(operation: string): AdministrationOperationDescriptor["resourceType"] {
  if (operation.includes("ROLE_ASSIGNMENT")) return "ROLE_ASSIGNMENT";
  if (operation.includes("TEAM_SCOPE")) return "TEAM_SCOPE";
  if (operation.includes("SOURCE_GOVERNANCE")) return "SOURCE_REGISTRY";
  if (operation.includes("PUBLICATION_TARGET")) return "PUBLICATION_TARGET";
  if (operation.includes("POLICY")) return "POLICY";
  if (operation.includes("ADMINISTRATION_PROPOSAL")) return "ADMINISTRATION_PROPOSAL";
  if (operation.includes("ADMINISTRATION_DECISION")) return "ADMINISTRATION_DECISION";
  return "ROLE";
}

function allowedScopesForResource(resourceType: AdministrationOperationDescriptor["resourceType"]): readonly AdministrationScopeType[] {
  if (resourceType === "SOURCE_REGISTRY") return ["SOURCE"];
  if (resourceType === "PUBLICATION_TARGET") return ["TARGET"];
  if (resourceType === "POLICY") return ["POLICY", "TENANT", "ORGANIZATION"];
  if (resourceType === "TEAM_SCOPE") return ["TEAM", "ORGANIZATION"];
  if (resourceType === "ROLE_ASSIGNMENT" || resourceType === "ROLE") return ["TENANT", "TEAM", "ORGANIZATION", "RESOURCE"];
  return ["TENANT", "TEAM", "ORGANIZATION", "RESOURCE", "POLICY", "SOURCE", "TARGET"];
}

function commandDescriptor(operation: AdministrationApiCommandOperation): AdministrationOperationDescriptor {
  const resourceType = resourceTypeForOperation(operation);
  return Object.freeze({
    kind: "COMMAND", resourceType, allowedScopeTypes: Object.freeze(allowedScopesForResource(resourceType)),
    requiresHumanActor: true, requiresMfa: true, requiresReason: true, requiresExpectedVersion: true,
    requiresIdempotency: true, requiresLiveAuthorization: true, requiresCurrentPolicy: true,
    requiresIndependentProposal: !operation.startsWith("PROPOSE_"),
  });
}

function queryDescriptor(operation: AdministrationApiQueryOperation): AdministrationOperationDescriptor {
  const resourceType = resourceTypeForOperation(operation);
  return Object.freeze({
    kind: "QUERY", resourceType, allowedScopeTypes: Object.freeze(allowedScopesForResource(resourceType)),
    requiresHumanActor: false, requiresMfa: false, requiresReason: false, requiresExpectedVersion: false,
    requiresIdempotency: false, requiresLiveAuthorization: true, requiresCurrentPolicy: true,
    requiresIndependentProposal: false,
  });
}

const administrationErrorCodeMap: Readonly<Record<string, AdministrationApiErrorCode>> = Object.freeze({
  AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED",
  AUTHORIZATION_DENIED: "AUTHORIZATION_DENIED",
  ADMIN_SCOPE_DENIED: "AUTHORIZATION_DENIED",
  ROLE_ASSIGNMENT_NOT_FOUND: "NOT_FOUND",
  POLICY_NOT_FOUND: "NOT_FOUND",
  SOURCE_NOT_FOUND: "NOT_FOUND",
  VERSION_CONFLICT: "VERSION_CONFLICT",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  ASSIGNMENT_STATE_INVALID: "INVALID_STATE",
  POLICY_APPROVAL_REQUIRED: "POLICY_DENIED",
  SEPARATION_OF_DUTIES_DENIED: "SELF_APPROVAL_FORBIDDEN",
  SELF_ASSIGNMENT_PROHIBITED: "SELF_APPROVAL_FORBIDDEN",
  REAUTHENTICATION_REQUIRED: "MFA_REQUIRED",
});
