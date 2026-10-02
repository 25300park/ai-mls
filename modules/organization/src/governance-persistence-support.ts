import type { PostgreSqlClientPort, PostgreSqlPoolPort } from "../../identity/src/postgresql-pool.js";
export type GovernanceLifecycle = "PROPOSED" | "ACTIVE" | "SUSPENDED" | "RETIRED";
export interface GovernanceEvidenceReference { readonly type: "DECISION" | "APPROVAL" | "AUDIT" | "CASE"; readonly id: string; readonly version: number }
export class GovernancePersistenceError extends Error {
  public constructor(public readonly code: "INPUT_INVALID" | "CONFLICT" | "UNAVAILABLE") { super(`Governance persistence: ${code}`); this.name = "GovernancePersistenceError"; }
}
export function requireValue(condition: unknown): asserts condition { if (!condition) throw new GovernancePersistenceError("INPUT_INVALID"); }
export function safeText(value: unknown): value is string { return typeof value === "string" && value.length > 0 && value.length <= 512 && value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value); }
export function safeVersion(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value > 0; }
export function plainRecord(value: unknown, fields: readonly string[]): asserts value is Record<string, unknown> {
  requireValue(value !== null && typeof value === "object" && !Array.isArray(value));
  requireValue(Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field)));
}
export function validInstant(value: unknown): value is string { return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value; }
export function assertChronology(record: Record<string, unknown>): void { requireValue(validInstant(record["createdAt"]) && validInstant(record["updatedAt"]) && record["updatedAt"] >= record["createdAt"]); }
export function assertEvidence(value: unknown): asserts value is readonly GovernanceEvidenceReference[] {
  requireValue(Array.isArray(value) && value.length > 0 && value.length <= 256);
  for (const item of value as unknown[]) {
    plainRecord(item, ["type", "id", "version"]);
    requireValue(["DECISION", "APPROVAL", "AUDIT", "CASE"].includes(String(item["type"])) && safeText(item["id"]) && safeVersion(item["version"]));
  }
  requireValue(new Set((value as unknown[]).map(canonicalJson)).size === value.length);
}
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${(value as unknown[]).map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a],[b]) => a.localeCompare(b)).map(([key,item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function assertFrozenMatch(a: object, b: object, mutable: readonly string[]): void {
  const frozen = (value: object): object => Object.fromEntries(Object.entries(value).filter(([key]) => !mutable.includes(key)));
  if (canonicalJson(frozen(a)) !== canonicalJson(frozen(b))) throw new GovernancePersistenceError("CONFLICT");
}
export function decodeColumns(row: Record<string, unknown>, mapping: Readonly<Record<string,string>>): unknown {
  return Object.fromEntries(Object.entries(mapping).map(([field,column]) => {
    let value = row[column];
    if (field.endsWith("Version")) value = Number(value);
    if (field === "createdAt" || field === "updatedAt") value = value instanceof Date ? value.toISOString() : value;
    return [field,value];
  }));
}
export interface PersistenceLeaseState { closed: boolean; quarantined: boolean; active: number; drain?: () => void }
export function newLeaseState(): PersistenceLeaseState { return { closed: false, quarantined: false, active: 0 }; }
export async function closeLease(state: PersistenceLeaseState): Promise<void> {
  state.closed = true;
  if (state.active > 0) await new Promise<void>(resolve => { const previous = state.drain; state.drain = (): void => { previous?.(); resolve(); }; });
}
// Client lifecycle only. Domain write authority remains in each concrete owner store.
export async function operate<T>(pool: PostgreSqlPoolPort, state: PersistenceLeaseState, write: boolean | "READ_ONLY", operation: (client: PostgreSqlClientPort) => Promise<T>): Promise<T> {
  if (state.closed || state.quarantined) throw new GovernancePersistenceError("UNAVAILABLE");
  state.active++;
  let client: PostgreSqlClientPort | undefined; let open = false; let commitStarted = false; let discard = false;
  try {
    client = await pool.connect();
    const role = await client.query("SELECT current_user AS role");
    if (role.rows[0]?.["role"] !== "ai_mls_production_runtime") throw new GovernancePersistenceError("UNAVAILABLE");
    if (write) { open = true; await client.query(write === "READ_ONLY" ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN"); }
    const result = await operation(client);
    if (write) { commitStarted = true; await client.query("COMMIT"); open = false; }
    return result;
  } catch (error) {
    if (commitStarted) { discard = true; state.quarantined = true; }
    else if (open && client) { try { await client.query("ROLLBACK"); open = false; } catch { discard = true; state.quarantined = true; } }
    if (error instanceof GovernancePersistenceError) { if (error.code === "UNAVAILABLE") discard = true; throw error; }
    const code = error !== null && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (!/^(235|55000)/u.test(code)) discard = true;
    throw new GovernancePersistenceError(/^(235|55000)/u.test(code) ? "CONFLICT" : "UNAVAILABLE");
  } finally {
    let releaseFailed=false;
    try { client?.release(discard); } catch { state.quarantined = true; releaseFailed=true; }
    state.active--; if (state.active === 0) state.drain?.();
    if (releaseFailed) throw new GovernancePersistenceError("UNAVAILABLE");
  }
}
export async function lockKeys(client: PostgreSqlClientPort, keys: readonly string[]): Promise<void> {
  for (const key of [...new Set(keys)].sort()) await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [key]);
}
export async function readBoundary<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); } catch (error) { if (error instanceof GovernancePersistenceError) throw error; throw new GovernancePersistenceError("UNAVAILABLE"); }
}
