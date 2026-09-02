export const CONNECTOR_API_COMMAND_OPERATIONS = Object.freeze([
  "RegisterConnectorInstance",
  "SubmitCaptureBatch",
  "AdvanceCheckpoint",
  "LeaseApprovedDelivery",
  "ReportDeliveryAttempt",
  "SubmitExternalObservation",
  "ReportHealth",
] as const);

export const CONNECTOR_API_QUERY_OPERATIONS = Object.freeze(["ReadBatchStatus"] as const);
export const CONNECTOR_API_INTERNAL_OPERATIONS = Object.freeze(["AdvanceCheckpoint"] as const);
export const CONNECTOR_API_HTTP_OPERATIONS = Object.freeze([
  "RegisterConnectorInstance",
  "SubmitCaptureBatch",
  "LeaseApprovedDelivery",
  "ReportDeliveryAttempt",
  "SubmitExternalObservation",
  "ReportHealth",
  "ReadBatchStatus",
] as const);
export const CONNECTOR_API_OPERATIONS = Object.freeze([
  "RegisterConnectorInstance",
  "SubmitCaptureBatch",
  "AdvanceCheckpoint",
  "LeaseApprovedDelivery",
  "ReportDeliveryAttempt",
  "SubmitExternalObservation",
  "ReportHealth",
  "ReadBatchStatus",
] as const);

export type ConnectorApiOperation = (typeof CONNECTOR_API_OPERATIONS)[number];
export type ConnectorApiRequestKind = "COMMAND" | "QUERY" | "HTTP_COMMAND" | "HTTP_QUERY";
export type ConnectorApiRequest = Readonly<Record<string, unknown>> & Readonly<{ operation: ConnectorApiOperation }>;

export class ConnectorApiContractError extends Error {
  public readonly code = "VALIDATION_FAILED" as const;

  public constructor(message: string) {
    super(message);
    this.name = "ConnectorApiContractError";
  }
}

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,255}$/u;
const UNSAFE_TEXT = /(?:bearer\s|authorization|api[_-]?key|token|secret|password|cookie|set-cookie)/iu;
const OUTCOMES = new Set(["SUCCEEDED", "FAILED", "UNKNOWN"]);
const HEALTH_STATUSES = new Set(["HEALTHY", "DEGRADED", "RECOVERING", "FAILED"]);

const REQUIRED_FIELDS: Readonly<Record<ConnectorApiOperation, readonly string[]>> = Object.freeze({
  RegisterConnectorInstance: ["operation", "sessionId", "connectorId", "instanceId", "expectedVersion", "idempotencyKey"],
  SubmitCaptureBatch: ["operation", "sessionId", "connectorId", "sourceId", "batchId", "invocationId", "expectedVersion", "idempotencyKey", "captureItemEvidenceRefs"],
  AdvanceCheckpoint: ["operation", "sessionId", "connectorId", "sourceId", "invocationId", "priorCheckpointVersion", "checkpointCandidate", "evidenceReference"],
  LeaseApprovedDelivery: ["operation", "sessionId", "connectorId", "sourceId", "deliveryAttemptId", "expectedVersion", "idempotencyKey"],
  ReportDeliveryAttempt: ["operation", "sessionId", "connectorId", "sourceId", "deliveryAttemptId", "leaseId", "invocationId", "outcome", "idempotencyKey", "expectedVersion"],
  SubmitExternalObservation: ["operation", "sessionId", "integrationContractId", "connectorId", "sourceId", "observationId", "providerNamespace", "externalObjectId", "observationType", "normalizedFields", "observedAt", "idempotencyKey", "expectedVersion"],
  ReportHealth: ["operation", "sessionId", "connectorId", "instanceId", "observedAt", "healthStatus", "reasonCodes", "expectedVersion", "idempotencyKey"],
  ReadBatchStatus: ["operation", "sessionId", "batchId"],
});

const OPTIONAL_FIELDS: Readonly<Partial<Record<ConnectorApiOperation, readonly string[]>>> = Object.freeze({
  SubmitCaptureBatch: ["baseCheckpointReference"],
  ReportDeliveryAttempt: ["reasonCode", "safeExternalReference"],
  ReadBatchStatus: ["connectorId", "sourceId"],
});

function fail(message: string): never {
  throw new ConnectorApiContractError(message);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function requireSafeReference(value: unknown, field: string): string {
  if (typeof value !== "string" || !IDENTIFIER.test(value) || UNSAFE_TEXT.test(value)) fail(`${field} is invalid`);
  return value;
}

function requireVersion(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail(`${field} is invalid`);
  return value as number;
}

function requireTimestamp(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length > 64 || Number.isNaN(Date.parse(value))) fail(`${field} is invalid`);
  return value;
}

function requireReferences(value: unknown, field: string, maximum: number): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximum) fail(`${field} is invalid`);
  return Object.freeze(value.map((item) => requireSafeReference(item, field)));
}

function validateClassification(kind: ConnectorApiRequestKind, operation: ConnectorApiOperation): void {
  const command = CONNECTOR_API_COMMAND_OPERATIONS.includes(operation as never);
  const query = CONNECTOR_API_QUERY_OPERATIONS.includes(operation as never);
  const http = CONNECTOR_API_HTTP_OPERATIONS.includes(operation as never);
  if ((kind === "COMMAND" && !command) || (kind === "QUERY" && !query)) fail("operation classification is invalid");
  if ((kind === "HTTP_COMMAND" && (!command || !http)) || (kind === "HTTP_QUERY" && (!query || !http))) fail("HTTP operation classification is invalid");
}

export function parseConnectorApiRequest(kind: ConnectorApiRequestKind, input: unknown): ConnectorApiRequest {
  if (!isPlainRecord(input) || typeof input["operation"] !== "string" || !CONNECTOR_API_OPERATIONS.includes(input["operation"] as ConnectorApiOperation)) {
    return fail("operation is invalid");
  }
  const operation = input["operation"] as ConnectorApiOperation;
  validateClassification(kind, operation);
  const required = REQUIRED_FIELDS[operation];
  const allowed = new Set([...required, ...(OPTIONAL_FIELDS[operation] ?? [])]);
  if (Object.keys(input).some((field) => !allowed.has(field))) fail("request contains an unknown field");
  if (required.some((field) => !(field in input))) fail("request is missing a required field");

  const parsed: Record<string, unknown> = { operation };
  for (const field of required) {
    if (field === "operation") continue;
    const value = input[field];
    if (field === "expectedVersion" || field === "priorCheckpointVersion") parsed[field] = requireVersion(value, field);
    else if (field === "observedAt") parsed[field] = requireTimestamp(value, field);
    else if (field === "normalizedFields") parsed[field] = requireNormalizedFields(value);
    else if (field === "captureItemEvidenceRefs") parsed[field] = requireReferences(value, field, 64);
    else if (field === "reasonCodes") parsed[field] = requireReferences(value, field, 16);
    else parsed[field] = requireSafeReference(value, field);
  }
  for (const field of OPTIONAL_FIELDS[operation] ?? []) {
    if (input[field] !== undefined) parsed[field] = requireSafeReference(input[field], field);
  }
  if (operation === "ReportDeliveryAttempt" && !OUTCOMES.has(parsed["outcome"] as string)) fail("outcome is invalid");
  if (operation === "ReportHealth" && !HEALTH_STATUSES.has(parsed["healthStatus"] as string)) fail("healthStatus is invalid");
  return Object.freeze(parsed) as ConnectorApiRequest;
}

function requireNormalizedFields(value: unknown): Readonly<Record<string, string | number | boolean | null>> {
  if (!isPlainRecord(value) || Object.keys(value).length > 32) fail("normalizedFields is invalid");
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u.test(key) || (item !== null && !["string", "number", "boolean"].includes(typeof item))) fail("normalizedFields is invalid");
    if (typeof item === "string" && (item.length > 2048 || UNSAFE_TEXT.test(item))) fail("normalizedFields is invalid");
    if (typeof item === "number" && !Number.isFinite(item)) fail("normalizedFields is invalid");
    result[key] = item as string | number | boolean | null;
  }
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > 16_384) fail("normalizedFields is invalid");
  return Object.freeze(result);
}
