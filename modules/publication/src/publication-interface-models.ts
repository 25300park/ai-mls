import type {
  CreatePublicationApplicationCommand,
  ModifyPublicationApplicationCommand,
  PublicationExecutionContext,
} from "./publication-application-contracts.js";

export interface CreatePublicationInterfaceRequest {
  readonly operation: "CREATE_PUBLICATION";
  readonly context: PublicationExecutionContext;
  readonly input: CreatePublicationApplicationCommand["input"];
}

export interface ModifyPublicationInterfaceRequest {
  readonly operation: "MODIFY_PUBLICATION";
  readonly context: PublicationExecutionContext;
  readonly identity: ModifyPublicationApplicationCommand["identity"];
  readonly input: ModifyPublicationApplicationCommand["input"];
}

export type PublicationInterfaceRequest = CreatePublicationInterfaceRequest | ModifyPublicationInterfaceRequest;

export interface PublicationInterfaceSuccessResponse {
  readonly operationResult: "SUCCEEDED";
  readonly publicationId: string;
  readonly version: number;
  readonly replayed: boolean;
}

export interface PublicationInterfaceFailureResponse {
  readonly operationResult: "FAILED";
  readonly failureCode: string;
}

export type PublicationInterfaceResponse = PublicationInterfaceSuccessResponse | PublicationInterfaceFailureResponse;

export function createPublicationInterfaceRequest<Request extends PublicationInterfaceRequest>(request: Request): Request {
  return immutableInterfaceValue(request);
}

export function immutableInterfaceValue<Value>(value: Value): Value {
  if (!isJsonInterfaceValue(value)) throw new TypeError("Interface values must be serialisable data.");
  const copy = structuredClone(value);
  deepFreeze(copy);
  return copy;
}

export function isJsonInterfaceValue(value: unknown, ancestors: WeakSet<object> = new WeakSet<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object") return false;
  if (ancestors.has(value)) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;
  if (Array.isArray(value) && Object.keys(value).length !== value.length) return false;
  ancestors.add(value);
  const valid = Array.isArray(value)
    ? value.every((item) => isJsonInterfaceValue(item, ancestors))
    : Object.values(value).every((item) => isJsonInterfaceValue(item, ancestors));
  ancestors.delete(value);
  return valid;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return;
  for (const child of Object.values(value)) deepFreeze(child);
  Object.freeze(value);
}
