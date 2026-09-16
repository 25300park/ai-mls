import type {
  AuthorizationDecision,
  AuthorizationResource,
  LiveAssignmentResolver,
} from "../../../modules/authorization/src/authorization-service.js";
import {
  AuthenticationError,
  type AuthorizedSessionResolution,
  type ResolveAuthorizedSessionRequest,
  type SessionContext,
} from "../../../modules/identity/src/index.js";
import {
  createPublicationHttpRequest,
  createPublicationHttpResponse,
  type PublicationHttpJsonValue,
  type PublicationHttpRequest,
  type PublicationHttpResponse,
} from "../../../modules/publication/src/publication-http-contracts.js";
import type { DataClassification, RoleCode } from "../../../packages/security-contracts/src/index.js";

const MAX_SESSION_ID = 512;
const MAX_HEADER_VALUE = 128;
const MAX_SEMANTIC_STRING = 128;
const MAX_RESOURCE_ID = 512;
const MAX_BODY_BYTES = 16 * 1024;
const MAX_BODY_KEYS = 32;
const MAX_JSON_DEPTH = 6;
const MAX_ROLES = 64;
const MAX_SCOPES = 128;
const MAX_OBLIGATIONS = 64;
const MAX_ASSIGNMENT_IDS = 256;

const classifications = new Set<DataClassification>([
  "PUBLIC_APPROVED", "INTERNAL", "CONFIDENTIAL_BUSINESS", "RESTRICTED_PERSONAL", "RESTRICTED_SECURITY",
]);

export interface CurrentPrincipalScope {
  readonly tenantId: string;
  readonly teamId?: string;
}

export interface CurrentPrincipalView {
  readonly principalId: string;
  readonly principalType: SessionContext["principalType"];
  readonly roles: readonly RoleCode[];
  readonly scopes: readonly CurrentPrincipalScope[];
  readonly expiresAt: string;
}

export interface CoreTransportTrustedContext {
  readonly tenantId: string;
  readonly teamId?: string;
  readonly purpose: string;
}

interface SessionAccessPort {
  resolveAuthorizedWithDecision(request: ResolveAuthorizedSessionRequest): AuthorizedSessionResolution;
}

interface ReadinessPort {
  isReady(): boolean;
}

export interface CoreIdentityAuthorizationApplicationDependencies {
  readonly trustedContext: CoreTransportTrustedContext;
  readonly sessionAccess: SessionAccessPort;
  readonly liveAssignments: LiveAssignmentResolver;
  readonly readiness: ReadinessPort;
}

interface RequestMetadata {
  readonly sessionId: string;
  readonly correlationId: string;
  readonly requestId?: string;
}

interface EvaluateCapabilityRequest extends RequestMetadata {
  readonly action: string;
  readonly resource: AuthorizationResource;
  readonly purpose: string;
  readonly reason?: string;
}

export class CoreIdentityAuthorizationApplication {
  public constructor(private readonly dependencies: CoreIdentityAuthorizationApplicationDependencies) {
    if (!safeSemantic(dependencies.trustedContext.tenantId)
      || !safeSemantic(dependencies.trustedContext.purpose)
      || (dependencies.trustedContext.teamId !== undefined && !safeSemantic(dependencies.trustedContext.teamId))
      || typeof dependencies.sessionAccess?.resolveAuthorizedWithDecision !== "function"
      || typeof dependencies.liveAssignments?.resolveCurrentAssignments !== "function"
      || typeof dependencies.readiness?.isReady !== "function") {
      throw new CoreTransportError("DEPENDENCY_UNAVAILABLE");
    }
  }

  public status(): Readonly<{ health: "HEALTHY" | "UNHEALTHY"; readiness: "READY" | "NOT_READY" }> {
    try {
      return this.dependencies.readiness.isReady()
        ? Object.freeze({ health: "HEALTHY", readiness: "READY" })
        : Object.freeze({ health: "UNHEALTHY", readiness: "NOT_READY" });
    } catch {
      return Object.freeze({ health: "UNHEALTHY", readiness: "NOT_READY" });
    }
  }

  public readCurrentPrincipal(metadata: RequestMetadata): CurrentPrincipalView {
    this.#assertReady();
    const trusted = this.dependencies.trustedContext;
    const resolution = this.dependencies.sessionAccess.resolveAuthorizedWithDecision({
      ...metadata,
      action: "resource.view",
      resource: Object.freeze({
        type: "IdentitySession",
        id: "current",
        tenantId: trusted.tenantId,
        ...(trusted.teamId === undefined ? {} : { teamId: trusted.teamId }),
      }),
      purpose: trusted.purpose,
    });
    if (resolution.session.state !== "ACTIVE") throw new CoreTransportError("DEPENDENCY_UNAVAILABLE");
    const assignments = this.dependencies.liveAssignments.resolveCurrentAssignments({
      subjectPrincipalId: resolution.session.principalId,
      subjectPrincipalType: resolution.session.principalType,
      tenantId: trusted.tenantId,
      resourceType: "IdentitySession",
      ...(trusted.teamId === undefined ? {} : { teamId: trusted.teamId }),
      purpose: trusted.purpose,
    });
    if (assignments.some((assignment) => assignment.tenantId !== trusted.tenantId
      || assignment.principalId !== resolution.session.principalId
      || assignment.subjectPrincipalType !== resolution.session.principalType
      || assignment.status !== "ACTIVE")) {
      throw new CoreTransportError("DEPENDENCY_UNAVAILABLE");
    }
    const roles = unique(assignments.map((assignment) => assignment.role));
    const scopes = uniqueScopes(assignments.flatMap((assignment) => assignment.teamIds.length === 0
      ? [Object.freeze({ tenantId: assignment.tenantId })]
      : assignment.teamIds.map((teamId) => Object.freeze({ tenantId: assignment.tenantId, teamId }))));
    if (roles.length > MAX_ROLES || scopes.length > MAX_SCOPES
      || roles.some((role) => !safeSemantic(role))
      || scopes.some((scope) => !safeIdentifier(scope.tenantId)
        || (scope.teamId !== undefined && !safeIdentifier(scope.teamId)))) {
      throw new CoreTransportError("DEPENDENCY_UNAVAILABLE");
    }
    return immutablePrincipal({
      principalId: resolution.session.principalId,
      principalType: resolution.session.principalType,
      roles,
      scopes,
      expiresAt: resolution.session.expiresAt,
    });
  }

  public evaluateCapability(input: EvaluateCapabilityRequest): AuthorizationDecision {
    this.#assertReady();
    if (input.resource.tenantId !== undefined
      && input.resource.tenantId !== this.dependencies.trustedContext.tenantId) {
      throw new CoreTransportError("AUTHORIZATION_DENIED");
    }
    const resource = Object.freeze({
      ...input.resource,
      tenantId: this.dependencies.trustedContext.tenantId,
    });
    const resolution = this.dependencies.sessionAccess.resolveAuthorizedWithDecision({
      sessionId: input.sessionId,
      correlationId: input.correlationId,
      ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
      action: input.action,
      resource,
      purpose: input.purpose,
      ...(input.reason === undefined ? {} : { reason: input.reason }),
    });
    if (resolution.session.state !== "ACTIVE") throw new CoreTransportError("DEPENDENCY_UNAVAILABLE");
    return boundedDecision(resolution.decision);
  }

  #assertReady(): void {
    if (this.status().readiness !== "READY") throw new CoreTransportError("DEPENDENCY_UNAVAILABLE");
  }
}

export interface CoreIdentityAuthorizationHttpHandler {
  handle(input: unknown): Promise<PublicationHttpResponse>;
  status(): ReturnType<CoreIdentityAuthorizationApplication["status"]>;
}

export function createCoreIdentityAuthorizationHttpHandler(
  application: CoreIdentityAuthorizationApplication,
): CoreIdentityAuthorizationHttpHandler {
  return Object.freeze({
    handle: (input: unknown): Promise<PublicationHttpResponse> => Promise.resolve(handle(application, input)),
    status: (): ReturnType<CoreIdentityAuthorizationApplication["status"]> => application.status(),
  });
}

function handle(application: CoreIdentityAuthorizationApplication, input: unknown): PublicationHttpResponse {
  let requestId = safeRequestId(input);
  try {
    const request = createPublicationHttpRequest(input);
    requestId = request.requestId;
    const route = routeFor(request);
    if (route === "NOT_FOUND") return failure(requestId, 404, "NOT_FOUND", "Resource not found.");
    if (route === "METHOD_NOT_ALLOWED") return failure(requestId, 405, "VALIDATION_FAILED", "Request validation failed.");
    const metadata = metadataFor(request);
    const data = route === "CURRENT_PRINCIPAL"
      ? currentPrincipal(application, request, metadata)
      : authorizationDecision(application, request, metadata);
    return createPublicationHttpResponse({
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: { success: true, data: data as unknown as PublicationHttpJsonValue },
      requestId,
    });
  } catch (error: unknown) {
    return safeFailure(requestId, error);
  }
}

function currentPrincipal(
  application: CoreIdentityAuthorizationApplication,
  request: PublicationHttpRequest,
  metadata: RequestMetadata,
): CurrentPrincipalView {
  if (!emptyBody(request.body) || Object.keys(request.query).length !== 0
    || Object.keys(request.pathParameters).length !== 0) throw new CoreTransportError("VALIDATION_FAILED");
  return application.readCurrentPrincipal(metadata);
}

function emptyBody(value: PublicationHttpJsonValue): boolean {
  return value === null || (record(value) && Object.keys(value).length === 0);
}

function authorizationDecision(
  application: CoreIdentityAuthorizationApplication,
  request: PublicationHttpRequest,
  metadata: RequestMetadata,
): AuthorizationDecision {
  if (Object.keys(request.query).length !== 0 || Object.keys(request.pathParameters).length !== 0
    || bodyBytes(request.body) > MAX_BODY_BYTES) throw new CoreTransportError("VALIDATION_FAILED");
  const metrics = jsonMetrics(request.body);
  if (metrics.keys > MAX_BODY_KEYS || metrics.depth > MAX_JSON_DEPTH) {
    throw new CoreTransportError("VALIDATION_FAILED");
  }
  const parsed = parseAuthorizationBody(request.body);
  return application.evaluateCapability({ ...metadata, ...parsed });
}

function metadataFor(request: PublicationHttpRequest): RequestMetadata {
  const sessionId = request.headers["x-session-id"];
  const correlationId = request.headers["x-correlation-id"];
  const headerRequestId = request.headers["x-request-id"];
  if (!safeHeader(sessionId, MAX_SESSION_ID)) throw new AuthenticationError("AUTHENTICATION_REQUIRED", "Authentication required.");
  if (!safeHeader(correlationId, MAX_HEADER_VALUE)
    || !safeHeader(request.requestId, MAX_HEADER_VALUE)
    || (headerRequestId !== undefined && (!safeHeader(headerRequestId, MAX_HEADER_VALUE)
      || headerRequestId !== request.requestId))) {
    throw new CoreTransportError("VALIDATION_FAILED");
  }
  return Object.freeze({
    sessionId,
    correlationId,
    ...(headerRequestId === undefined ? {} : { requestId: headerRequestId }),
  });
}

function parseAuthorizationBody(value: PublicationHttpJsonValue): Omit<EvaluateCapabilityRequest, keyof RequestMetadata> {
  if (!record(value) || !exactKeys(value, ["action", "resource", "purpose"], ["reason"]) || !record(value["resource"])) {
    throw new CoreTransportError("VALIDATION_FAILED");
  }
  const resource = value["resource"];
  const allowedResourceKeys = [
    "type", "id", "tenantId", "version", "teamId", "classification", "privacyScope",
    "purpose", "consentOrLegalBasis", "audienceRestriction",
  ];
  if (Object.keys(resource).some((key) => !allowedResourceKeys.includes(key))
    || !safeSemantic(value["action"]) || !safeSemantic(value["purpose"])
    || (value["reason"] !== undefined && !safeSemantic(value["reason"]))
    || !safeSemantic(resource["type"]) || !safeIdentifier(resource["id"])) {
    throw new CoreTransportError("VALIDATION_FAILED");
  }
  for (const key of ["tenantId", "teamId", "privacyScope", "purpose", "consentOrLegalBasis", "audienceRestriction"] as const) {
    if (resource[key] !== undefined && !safeSemantic(resource[key])) throw new CoreTransportError("VALIDATION_FAILED");
  }
  if (resource["version"] !== undefined
    && (!Number.isSafeInteger(resource["version"]) || (resource["version"] as number) < 1)) {
    throw new CoreTransportError("VALIDATION_FAILED");
  }
  if (resource["classification"] !== undefined
    && (typeof resource["classification"] !== "string"
      || !classifications.has(resource["classification"] as DataClassification))) {
    throw new CoreTransportError("VALIDATION_FAILED");
  }
  const normalized: AuthorizationResource = Object.freeze({
    type: resource["type"],
    id: resource["id"],
    ...(resource["tenantId"] === undefined ? {} : { tenantId: resource["tenantId"] as string }),
    ...(resource["version"] === undefined ? {} : { version: resource["version"] as number }),
    ...(resource["teamId"] === undefined ? {} : { teamId: resource["teamId"] as string }),
    ...(resource["classification"] === undefined ? {} : { classification: resource["classification"] as DataClassification }),
    ...(resource["privacyScope"] === undefined ? {} : { privacyScope: resource["privacyScope"] as string }),
    ...(resource["purpose"] === undefined ? {} : { purpose: resource["purpose"] as string }),
    ...(resource["consentOrLegalBasis"] === undefined ? {} : { consentOrLegalBasis: resource["consentOrLegalBasis"] as string }),
    ...(resource["audienceRestriction"] === undefined ? {} : { audienceRestriction: resource["audienceRestriction"] as string }),
  });
  return Object.freeze({
    action: value["action"],
    resource: normalized,
    purpose: value["purpose"],
    ...(value["reason"] === undefined ? {} : { reason: value["reason"] }),
  });
}

function boundedDecision(decision: AuthorizationDecision): AuthorizationDecision {
  if (!["ALLOW", "DENY"].includes(decision.effect)
    || !safeSemantic(decision.reasonCode) || !safeSemantic(decision.policyVersion)
    || decision.obligations.length > MAX_OBLIGATIONS || decision.assignmentIds.length > MAX_ASSIGNMENT_IDS
    || decision.obligations.some((item) => !["AUDIT", "MFA", "REASON"].includes(item))
    || decision.assignmentIds.some((item) => !safeIdentifier(item))
    || (decision.expiresAt !== undefined && !validTimestamp(decision.expiresAt))) {
    throw new CoreTransportError("DEPENDENCY_UNAVAILABLE");
  }
  const obligations = Object.freeze([...decision.obligations]);
  const assignmentIds = Object.freeze([...decision.assignmentIds]);
  return Object.freeze({
    effect: decision.effect,
    reasonCode: decision.reasonCode,
    policyVersion: decision.policyVersion,
    obligations,
    assignmentIds,
    ...(decision.expiresAt === undefined ? {} : { expiresAt: decision.expiresAt }),
  });
}

function routeFor(request: PublicationHttpRequest): "CURRENT_PRINCIPAL" | "AUTHORIZATION_DECISION" | "NOT_FOUND" | "METHOD_NOT_ALLOWED" {
  if (request.path === "/v1/me") return request.method === "GET" ? "CURRENT_PRINCIPAL" : "METHOD_NOT_ALLOWED";
  if (request.path === "/v1/authorization-decisions") return request.method === "POST" ? "AUTHORIZATION_DECISION" : "METHOD_NOT_ALLOWED";
  return "NOT_FOUND";
}

function safeFailure(requestId: string, error: unknown): PublicationHttpResponse {
  if (error instanceof AuthenticationError) {
    const status = error.code === "AUTHENTICATION_REQUIRED" || error.code === "REAUTHENTICATION_REQUIRED" ? 401 : 404;
    return failure(requestId, status, error.code, status === 401 ? "Authentication required." : "Resource not found.");
  }
  if (error instanceof CoreTransportError) {
    if (error.code === "VALIDATION_FAILED") return failure(requestId, 400, error.code, "Request validation failed.");
    if (error.code === "AUTHORIZATION_DENIED") return failure(requestId, 404, "NOT_FOUND", "Resource not found.");
    if (error.code === "DEPENDENCY_UNAVAILABLE") return failure(requestId, 503, error.code, "Service unavailable.");
  }
  return failure(requestId, 500, "INTERNAL_ERROR", "Request could not be completed.");
}

function failure(requestId: string, statusCode: number, code: string, message: string): PublicationHttpResponse {
  return createPublicationHttpResponse({
    statusCode,
    headers: { "content-type": "application/json" },
    body: { success: false, error: { code, message } },
    requestId: safeHeader(requestId, MAX_HEADER_VALUE) ? requestId : "unavailable",
  });
}

class CoreTransportError extends Error {
  public constructor(public readonly code: "VALIDATION_FAILED" | "AUTHORIZATION_DENIED" | "DEPENDENCY_UNAVAILABLE") {
    super(code);
    this.name = "CoreTransportError";
  }
}

function immutablePrincipal(input: CurrentPrincipalView): CurrentPrincipalView {
  const snapshot = structuredClone(input);
  Object.freeze(snapshot.roles);
  for (const scope of snapshot.scopes) Object.freeze(scope);
  Object.freeze(snapshot.scopes);
  return Object.freeze(snapshot);
}

function unique<Value extends string>(values: readonly Value[]): readonly Value[] {
  return Object.freeze([...new Set(values)].sort((left, right) => left.localeCompare(right)));
}

function uniqueScopes(values: readonly CurrentPrincipalScope[]): readonly CurrentPrincipalScope[] {
  const entries = new Map<string, CurrentPrincipalScope>();
  for (const value of values) entries.set(`${value.tenantId}\u0000${value.teamId ?? ""}`, value);
  return Object.freeze([...entries.values()].sort((left, right) =>
    `${left.tenantId}:${left.teamId ?? ""}`.localeCompare(`${right.tenantId}:${right.teamId ?? ""}`)));
}

function safeHeader(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum
    && value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value);
}

function safeSemantic(value: unknown): value is string {
  return safeHeader(value, MAX_SEMANTIC_STRING);
}

function safeIdentifier(value: unknown): value is string {
  return safeHeader(value, MAX_RESOURCE_ID);
}

function validTimestamp(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function record(value: unknown): value is Readonly<Record<string, PublicationHttpJsonValue>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: Readonly<Record<string, unknown>>, required: readonly string[], optional: readonly string[]): boolean {
  const keys = Object.keys(value);
  return required.every((key) => Object.hasOwn(value, key))
    && keys.every((key) => required.includes(key) || optional.includes(key));
}

function bodyBytes(value: PublicationHttpJsonValue): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function jsonMetrics(value: PublicationHttpJsonValue, depth = 1): Readonly<{ keys: number; depth: number }> {
  if (value === null || typeof value !== "object") return Object.freeze({ keys: 0, depth });
  const children: readonly PublicationHttpJsonValue[] = Array.isArray(value) ? value : Object.values(value);
  let keys = Array.isArray(value) ? 0 : Object.keys(value).length;
  let maximumDepth = depth;
  for (const child of children) {
    const nested = jsonMetrics(child, depth + 1);
    keys += nested.keys;
    maximumDepth = Math.max(maximumDepth, nested.depth);
  }
  return Object.freeze({ keys, depth: maximumDepth });
}

function safeRequestId(input: unknown): string {
  if (record(input) && safeHeader(input["requestId"], MAX_HEADER_VALUE)) return input["requestId"];
  return "unavailable";
}
