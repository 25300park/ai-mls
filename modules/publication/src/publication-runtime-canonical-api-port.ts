export interface PublicationCanonicalApiExecutionPort {
  readonly operations: readonly string[];
  execute(request: unknown): unknown;
}

export function canonicalApiOperations(port: PublicationCanonicalApiExecutionPort | undefined): readonly string[] {
  if (port === undefined) return Object.freeze([]);
  const registered: readonly unknown[] = port.operations;
  if (typeof port.execute !== "function" || !Array.isArray(registered)
    || Object.keys(registered).length !== registered.length
    || registered.some((operation) => typeof operation !== "string" || operation.trim().length === 0)
    || new Set(registered).size !== registered.length) {
    throw new TypeError("Canonical API execution port is invalid.");
  }
  return Object.freeze(registered.map((operation) => String(operation)));
}
