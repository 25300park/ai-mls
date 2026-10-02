import type { PostgreSqlClientPort, PostgreSqlPoolPort } from "../../identity/src/postgresql-pool.js";
import type { AsyncAdvisoryPersistence } from "./advisory-async-persistence.js";
import { canonicalAdvisoryJson, immutableAdvisoryRecord, validateAcceptedAdvisoryRecord, validateAdvisoryPromptRecord } from "./advisory-durable-persistence.js";
import { AdvisoryPersistenceError, type AcceptedAdvisoryRecord, type AdvisoryPromptRecord } from "./advisory-runtime-contracts.js";

/** Signals winner resolution after rollback; it never retries a write or provider call. */
class IdempotencyWriteRace extends Error {}

/** The supplied PG_PRODUCTION_POOL remains owned by ProductionBootstrap. */
export class PostgreSqlAdvisoryStore implements AsyncAdvisoryPersistence {
  #closed = false;
  #quarantined = false;
  #active = 0;
  #closing: Promise<void> | undefined;
  #drained: (() => void) | undefined;
  public constructor(private readonly pool: PostgreSqlPoolPort) {}

  public async registerPrompt(record: AdvisoryPromptRecord): Promise<AdvisoryPromptRecord> {
    record = immutableAdvisoryRecord(validateAdvisoryPromptRecord(record));
    return this.run(true, async (client) => {
      await client.query("INSERT INTO app_advisory.advisory_prompts (prompt_id,prompt_version,capability_id,schema_id,content_fingerprint,status,created_at,payload_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT DO NOTHING", [record.promptId,record.promptVersion,record.capabilityId,record.schemaId,record.contentFingerprint,record.status,record.createdAt,canonicalAdvisoryJson(record)]);
      const existing = await findPrompt(client, record.promptId, record.promptVersion);
      if (existing === undefined) throw unavailable();
      if (canonicalAdvisoryJson(existing) !== canonicalAdvisoryJson(record)) throw failure("PROMPT_IDENTITY_CONFLICT", "Prompt identity is immutable.");
      return existing;
    });
  }

  public async findPrompt(promptId: string, promptVersion: string): Promise<AdvisoryPromptRecord | undefined> {
    validateText(promptId, promptVersion);
    return this.run(false, (client) => findPrompt(client, promptId, promptVersion));
  }

  public async findAdvisory(tenantId: string, scopeRef: string, advisoryId: string): Promise<AcceptedAdvisoryRecord | undefined> {
    validateText(tenantId, scopeRef, advisoryId);
    return this.run(false, (client) => findAdvisory(client, tenantId, scopeRef, advisoryId));
  }

  public async findReplay(tenantId: string, scopeRef: string, idempotencyKey: string, executionFingerprint: string): Promise<AcceptedAdvisoryRecord | undefined> {
    validateText(tenantId, scopeRef, idempotencyKey, executionFingerprint);
    return this.run(false, (client) => findReplay(client, tenantId, scopeRef, idempotencyKey, executionFingerprint));
  }

  public async recordAccepted(record: AcceptedAdvisoryRecord, idempotencyKey: string): Promise<AcceptedAdvisoryRecord> {
    validateText(idempotencyKey);
    const valid = immutableAdvisoryRecord(validateAcceptedAdvisoryRecord(record));
    return this.run(true, async (client) => {
        const replay = await findReplay(client, valid.tenantId, valid.scopeRef, idempotencyKey, valid.executionFingerprint);
        if (replay !== undefined) return replay;
        const prompt = await findPrompt(client, valid.promptId, valid.promptVersion);
        if (prompt?.status !== "ACTIVE" || prompt.capabilityId !== valid.capabilityId || prompt.schemaId !== valid.schemaId) throw failure("PROMPT_SCHEMA_MISMATCH", "Accepted Advisory must bind an active compatible prompt.");
        const inserted = await client.query("INSERT INTO app_advisory.advisory_records (advisory_id,tenant_id,scope_ref,capability_id,schema_id,execution_fingerprint,payload_json) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT DO NOTHING RETURNING advisory_id", [valid.advisoryId,valid.tenantId,valid.scopeRef,valid.capabilityId,valid.schemaId,valid.executionFingerprint,canonicalAdvisoryJson(valid)]);
        if (inserted.rowCount === 0) {
          // ON CONFLICT waits for the other transaction; exact-key replay takes precedence over generated-at differences.
          const winner = await findReplay(client, valid.tenantId, valid.scopeRef, idempotencyKey, valid.executionFingerprint);
          if (winner !== undefined) return winner;
          const found = await client.query("SELECT * FROM app_advisory.advisory_records WHERE advisory_id=$1", [valid.advisoryId]);
          const existing = found.rows[0];
          if (existing === undefined) throw unavailable();
          if (canonicalAdvisoryJson(decodeAccepted(existing)) !== canonicalAdvisoryJson(valid)) throw failure("ADVISORY_IDENTITY_CONFLICT", "Advisory identity is immutable.");
        }
        const remembered = await client.query("INSERT INTO app_advisory.advisory_idempotency (tenant_id,scope_ref,idempotency_key,execution_fingerprint,advisory_id) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING advisory_id", [valid.tenantId,valid.scopeRef,idempotencyKey,valid.executionFingerprint,valid.advisoryId]);
        if (remembered.rowCount === 0) throw new IdempotencyWriteRace();
        return immutableAdvisoryRecord(valid);
    }, async (client) => {
      // The losing insert has rolled back; resolve the winner while this admitted operation still owns its client.
      const winner = await findReplay(client, valid.tenantId, valid.scopeRef, idempotencyKey, valid.executionFingerprint);
      if (winner === undefined) throw unavailable();
      return winner;
    });
  }

  public async close(): Promise<void> {
    this.#closed = true;
    if (this.#active === 0) return;
    await (this.#closing ??= new Promise<void>((resolve) => { this.#drained = resolve; }));
  }

  private async run<T>(mutation: boolean, work: (client: PostgreSqlClientPort) => Promise<T>, afterRollback?: (client: PostgreSqlClientPort) => Promise<T>): Promise<T> {
    if (this.#closed || this.#quarantined) throw unavailable();
    this.#active++;
    let client: PostgreSqlClientPort | undefined;
    let open = false;
    let commitStarted = false;
    let destroy = false;
    try {
      client = await this.pool.connect();
      if (this.#quarantined) throw unavailable();
      if (mutation) { await client.query("BEGIN"); open = true; }
      const value = await work(client);
      if (this.#quarantined) throw unavailable();
      if (mutation) { commitStarted = true; await client.query("COMMIT"); open = false; }
      return value;
    } catch (error) {
      if (commitStarted) { this.#quarantined = true; destroy = true; }
      else if (open && client !== undefined) {
        try { await client.query("ROLLBACK"); open = false; }
        catch { this.#quarantined = true; destroy = true; }
      }
      if (!commitStarted && !destroy && error instanceof IdempotencyWriteRace && client !== undefined && afterRollback !== undefined) {
        try {
          if (this.#quarantined) throw unavailable();
          const winner = await afterRollback(client);
          if (this.#quarantined) throw unavailable();
          return winner;
        } catch (resolutionError) {
          if (resolutionError instanceof AdvisoryPersistenceError) throw resolutionError;
          throw unavailable();
        }
      }
      if (!commitStarted && !destroy && error instanceof AdvisoryPersistenceError) throw error;
      throw unavailable();
    } finally {
      try { client?.release(destroy); }
      finally { this.#active--; if (this.#active === 0) this.#drained?.(); }
    }
  }
}

async function findPrompt(client: PostgreSqlClientPort, promptId: string, promptVersion: string): Promise<AdvisoryPromptRecord | undefined> {
  const result = await client.query("SELECT * FROM app_advisory.advisory_prompts WHERE prompt_id=$1 AND prompt_version=$2", [promptId, promptVersion]);
  const row = result.rows[0];
  if (row === undefined) return undefined;
  const prompt = validateAdvisoryPromptRecord(row["payload_json"] as AdvisoryPromptRecord);
  for (const [column, value] of [["prompt_id",prompt.promptId],["prompt_version",prompt.promptVersion],["capability_id",prompt.capabilityId],["schema_id",prompt.schemaId],["content_fingerprint",prompt.contentFingerprint],["status",prompt.status]] as const) if (row[column] !== value) throw unavailable();
  const created = row["created_at"];
  if (!(created instanceof Date) || !Number.isFinite(created.getTime()) || created.getTime() !== Date.parse(prompt.createdAt)) throw unavailable();
  return immutableAdvisoryRecord(prompt);
}

async function findAdvisory(client: PostgreSqlClientPort, tenantId: string, scopeRef: string, advisoryId: string): Promise<AcceptedAdvisoryRecord | undefined> {
  const result = await client.query("SELECT * FROM app_advisory.advisory_records WHERE tenant_id=$1 AND scope_ref=$2 AND advisory_id=$3", [tenantId,scopeRef,advisoryId]);
  return result.rows[0] === undefined ? undefined : decodeAccepted(result.rows[0]);
}

async function findReplay(client: PostgreSqlClientPort, tenantId: string, scopeRef: string, key: string, fingerprint: string): Promise<AcceptedAdvisoryRecord | undefined> {
  const result = await client.query("SELECT execution_fingerprint,advisory_id FROM app_advisory.advisory_idempotency WHERE tenant_id=$1 AND scope_ref=$2 AND idempotency_key=$3", [tenantId,scopeRef,key]);
  const binding = result.rows[0];
  if (binding === undefined) return undefined;
  if (binding["execution_fingerprint"] !== fingerprint) throw failure("IDEMPOTENCY_CONFLICT", "Idempotency key is already bound to different input.");
  const advisoryId = binding["advisory_id"];
  if (typeof advisoryId !== "string") throw unavailable();
  const advisory = await findAdvisory(client, tenantId, scopeRef, advisoryId);
  if (advisory?.executionFingerprint !== fingerprint) throw unavailable();
  return advisory;
}

function decodeAccepted(row: Readonly<Record<string, unknown>>): AcceptedAdvisoryRecord {
  const record = validateAcceptedAdvisoryRecord(row["payload_json"] as AcceptedAdvisoryRecord);
  for (const [column,value] of [["advisory_id",record.advisoryId],["tenant_id",record.tenantId],["scope_ref",record.scopeRef],["capability_id",record.capabilityId],["schema_id",record.schemaId],["execution_fingerprint",record.executionFingerprint]] as const) if (row[column] !== value) throw unavailable();
  return immutableAdvisoryRecord(record);
}
function validateText(...values: readonly string[]): void { if (values.some((value) => typeof value !== "string" || value.trim().length === 0)) throw failure("PERSISTENCE_INPUT_INVALID", "Persistence input is invalid."); }
function failure(code: ConstructorParameters<typeof AdvisoryPersistenceError>[0], message: string): AdvisoryPersistenceError { return new AdvisoryPersistenceError(code, message); }
function unavailable(): AdvisoryPersistenceError { return failure("PERSISTENCE_UNAVAILABLE", "Advisory persistence is unavailable."); }
