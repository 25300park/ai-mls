import { DatabaseSync, type SQLOutputValue } from "node:sqlite";

import {
  assertRel001StagingCandidateIntegrity,
  type Rel001StagingCandidate,
} from "./release-candidate-artifact.js";
import {
  ReleaseAcceptanceManifestError,
  classifyReleaseAcceptanceManifestReplay,
  validateReleaseAcceptanceManifest,
  type ReleaseAcceptanceManifest,
} from "./release-evidence-manifest.js";

export type ReleaseAcceptancePersistenceErrorCode =
  | "PERSISTENCE_INPUT_INVALID"
  | "PERSISTENCE_UNAVAILABLE"
  | "CANDIDATE_CONFLICT"
  | "MANIFEST_IDENTITY_CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "LINEAGE_CONFLICT";

export class ReleaseAcceptancePersistenceError extends Error {
  public constructor(public readonly code: ReleaseAcceptancePersistenceErrorCode) {
    super(code);
    this.name = "ReleaseAcceptancePersistenceError";
  }
}

export interface DurableReleaseAcceptanceManifestStoreOptions {
  readonly databasePath: string;
  readonly beforeReplayBindingWrite?: () => void;
}

export class DurableReleaseAcceptanceManifestStore {
  readonly #database: DatabaseSync;
  readonly #beforeReplayBindingWrite: (() => void) | undefined;
  #closed = false;

  public constructor(options: DurableReleaseAcceptanceManifestStoreOptions) {
    if (!isFileDatabasePath(options.databasePath)) throw failure("PERSISTENCE_INPUT_INVALID");
    let database: DatabaseSync | undefined;
    try {
      database = new DatabaseSync(options.databasePath);
      database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA busy_timeout = 5000;");
      const existingObjects = Number(database.prepare(`SELECT COUNT(*) AS count FROM sqlite_schema
        WHERE name LIKE 'release_%'`).get()?.["count"] ?? 0);
      if (existingObjects === 0) database.exec(SCHEMA);
      else validateSchema(database);
      validateSchema(database);
      const integrity = database.prepare("PRAGMA integrity_check").get();
      const foreignKeys = database.prepare("PRAGMA foreign_key_check").all();
      if (integrity?.["integrity_check"] !== "ok" || foreignKeys.length !== 0) throw new Error("integrity failure");
      this.#database = database;
      this.#beforeReplayBindingWrite = options.beforeReplayBindingWrite;
      this.#validateStoredState();
    } catch (error) {
      try { database?.close(); } catch { /* preserve fail-closed startup */ }
      if (error instanceof ReleaseAcceptancePersistenceError) throw error;
      throw failure("PERSISTENCE_UNAVAILABLE");
    }
  }

  public append(candidate: Rel001StagingCandidate, manifest: ReleaseAcceptanceManifest, createdAt: string): ReleaseAcceptanceManifest {
    this.#assertOpen();
    assertTimestamp(createdAt);
    assertCanonicalCandidateShape(candidate);
    const valid = validateForPersistence(candidate, manifest);
    const existingCandidate = this.findCandidate(candidate.releaseCandidateId);
    if (existingCandidate !== undefined && canonicalJson(existingCandidate) !== canonicalJson(candidate)) throw failure("CANDIDATE_CONFLICT");
    assertCandidateIntegrityForPersistence(candidate);
    const replay = this.findReplay(valid.releaseCandidateId, valid.manifestFingerprint);
    if (replay !== undefined) {
      if (classifyReleaseAcceptanceManifestReplay(replay, valid) !== "REPLAY") throw failure("IDEMPOTENCY_CONFLICT");
      return replay;
    }
    const existingManifest = this.findManifest(valid.acceptanceManifestId);
    if (existingManifest !== undefined) throw failure("MANIFEST_IDENTITY_CONFLICT");
    this.#validateLineage(valid);
    try {
      this.#database.exec("BEGIN IMMEDIATE");
      const transactionCandidate = this.findCandidate(candidate.releaseCandidateId);
      if (transactionCandidate === undefined) {
        this.#database.prepare(`INSERT INTO release_candidates
          (release_candidate_id, candidate_fingerprint, logical_release_id, source_commit_sha, repository_identity, source_branch, artifact_fingerprint, target_environment, generated_at, created_at, payload_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(candidate.releaseCandidateId, candidate.candidateFingerprint, candidate.logicalReleaseId, candidate.sourceCommitSha,
            candidate.repositoryIdentity, candidate.sourceBranch, candidate.artifactFingerprint, candidate.targetEnvironment,
            candidate.generatedAt, createdAt, canonicalJson(candidate));
      } else if (canonicalJson(transactionCandidate) !== canonicalJson(candidate)) {
        throw failure("CANDIDATE_CONFLICT");
      }
      this.#validateLineage(valid);
      const transactionReplay = this.findReplay(valid.releaseCandidateId, valid.manifestFingerprint);
      if (transactionReplay !== undefined) {
        if (classifyReleaseAcceptanceManifestReplay(transactionReplay, valid) !== "REPLAY") throw failure("IDEMPOTENCY_CONFLICT");
        this.#database.exec("ROLLBACK");
        return transactionReplay;
      }
      if (this.findManifest(valid.acceptanceManifestId) !== undefined) throw failure("MANIFEST_IDENTITY_CONFLICT");
      this.#database.prepare(`INSERT INTO release_acceptance_manifests
        (acceptance_manifest_id, release_candidate_id, manifest_fingerprint, acceptance_result, accepted_by, accepted_at, evaluated_at, decision_evidence_ref, previous_manifest_id, created_at, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(valid.acceptanceManifestId, valid.releaseCandidateId, valid.manifestFingerprint, valid.acceptanceResult,
          valid.acceptedBy, valid.acceptedAt, valid.evaluatedAt, valid.decisionEvidenceRef, valid.previousManifestId,
          createdAt, canonicalJson(valid));
      valid.evidenceRefs.forEach((reference, sequence) => this.#database.prepare(`INSERT INTO release_manifest_evidence_links
        (acceptance_manifest_id, link_kind, link_sequence, reference_id, payload_json) VALUES (?, 'EVIDENCE', ?, ?, ?)`)
        .run(valid.acceptanceManifestId, sequence, reference.evidenceRef, canonicalJson(reference)));
      valid.readinessRefs.forEach((reference, sequence) => this.#database.prepare(`INSERT INTO release_manifest_evidence_links
        (acceptance_manifest_id, link_kind, link_sequence, reference_id, payload_json) VALUES (?, 'READINESS', ?, ?, ?)`)
        .run(valid.acceptanceManifestId, sequence, reference.readinessRef, canonicalJson(reference)));
      this.#beforeReplayBindingWrite?.();
      this.#database.prepare(`INSERT INTO release_manifest_replay
        (release_candidate_id, manifest_fingerprint, acceptance_manifest_id, created_at) VALUES (?, ?, ?, ?)`)
        .run(valid.releaseCandidateId, valid.manifestFingerprint, valid.acceptanceManifestId, createdAt);
      this.#database.exec("COMMIT");
      return immutable(valid);
    } catch (error) {
      try { this.#database.exec("ROLLBACK"); } catch { /* original transaction failure remains authoritative */ }
      if (error instanceof ReleaseAcceptancePersistenceError) throw error;
      throw failure("PERSISTENCE_UNAVAILABLE");
    }
  }

  public findCandidate(releaseCandidateId: string): Rel001StagingCandidate | undefined {
    this.#assertOpen();
    assertIdentity(releaseCandidateId);
    const row = this.#database.prepare("SELECT payload_json FROM release_candidates WHERE release_candidate_id = ?").get(releaseCandidateId);
    return row === undefined ? undefined : immutable(parse<Rel001StagingCandidate>(text(row["payload_json"])));
  }

  public findManifest(acceptanceManifestId: string): ReleaseAcceptanceManifest | undefined {
    this.#assertOpen();
    assertIdentity(acceptanceManifestId);
    const row = this.#database.prepare("SELECT release_candidate_id, payload_json FROM release_acceptance_manifests WHERE acceptance_manifest_id = ?").get(acceptanceManifestId);
    if (row === undefined) return undefined;
    const candidate = this.findCandidate(text(row["release_candidate_id"]));
    if (candidate === undefined) throw failure("PERSISTENCE_UNAVAILABLE");
    return immutable(validateReleaseAcceptanceManifest(candidate, parse<ReleaseAcceptanceManifest>(text(row["payload_json"]))));
  }

  public findReplay(releaseCandidateId: string, manifestFingerprint: string): ReleaseAcceptanceManifest | undefined {
    this.#assertOpen();
    assertIdentity(releaseCandidateId);
    assertIdentity(manifestFingerprint);
    const row = this.#database.prepare(`SELECT acceptance_manifest_id FROM release_manifest_replay
      WHERE release_candidate_id = ? AND manifest_fingerprint = ?`).get(releaseCandidateId, manifestFingerprint);
    return row === undefined ? undefined : this.findManifest(text(row["acceptance_manifest_id"]));
  }

  public listManifestHistory(releaseCandidateId: string): readonly ReleaseAcceptanceManifest[] {
    this.#assertOpen();
    assertIdentity(releaseCandidateId);
    return deepFreeze(this.#database.prepare(`SELECT acceptance_manifest_id FROM release_acceptance_manifests
      WHERE release_candidate_id = ? ORDER BY created_at ASC, acceptance_manifest_id ASC`).all(releaseCandidateId)
      .map((row) => {
        const manifest = this.findManifest(text(row["acceptance_manifest_id"]));
        if (manifest === undefined) throw failure("PERSISTENCE_UNAVAILABLE");
        return manifest;
      }));
  }

  public close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#database.close();
  }

  #assertOpen(): void {
    if (this.#closed) throw failure("PERSISTENCE_UNAVAILABLE");
  }

  #validateStoredState(): void {
    for (const row of this.#database.prepare(`SELECT release_candidate_id, candidate_fingerprint, logical_release_id,
      source_commit_sha, repository_identity, source_branch, artifact_fingerprint, target_environment, generated_at, payload_json
      FROM release_candidates`).all()) {
      const storedCandidate = parse<Rel001StagingCandidate>(text(row["payload_json"]));
      try {
        assertCanonicalCandidateShape(storedCandidate);
        assertRel001StagingCandidateIntegrity(storedCandidate);
      } catch { throw failure("PERSISTENCE_UNAVAILABLE"); }
      if (storedCandidate.releaseCandidateId !== text(row["release_candidate_id"])
        || storedCandidate.candidateFingerprint !== text(row["candidate_fingerprint"])
        || storedCandidate.logicalReleaseId !== text(row["logical_release_id"])
        || storedCandidate.sourceCommitSha !== text(row["source_commit_sha"])
        || storedCandidate.repositoryIdentity !== text(row["repository_identity"])
        || storedCandidate.sourceBranch !== text(row["source_branch"])
        || storedCandidate.artifactFingerprint !== text(row["artifact_fingerprint"])
        || storedCandidate.targetEnvironment !== text(row["target_environment"])
        || storedCandidate.generatedAt !== text(row["generated_at"])) throw failure("PERSISTENCE_UNAVAILABLE");
    }
    for (const row of this.#database.prepare(`SELECT acceptance_manifest_id, release_candidate_id, manifest_fingerprint,
      acceptance_result, accepted_by, accepted_at, evaluated_at, decision_evidence_ref, previous_manifest_id
      FROM release_acceptance_manifests`).all()) {
      const manifest = this.findManifest(text(row["acceptance_manifest_id"]));
      if (manifest?.releaseCandidateId !== text(row["release_candidate_id"])
        || manifest.manifestFingerprint !== text(row["manifest_fingerprint"])
        || manifest.acceptanceResult !== text(row["acceptance_result"])
        || manifest.acceptedBy !== nullableText(row["accepted_by"])
        || manifest.acceptedAt !== nullableText(row["accepted_at"])
        || manifest.evaluatedAt !== text(row["evaluated_at"])
        || manifest.decisionEvidenceRef !== text(row["decision_evidence_ref"])
        || manifest.previousManifestId !== nullableText(row["previous_manifest_id"])) throw failure("PERSISTENCE_UNAVAILABLE");
      try { this.#validateLineage(manifest); } catch { throw failure("PERSISTENCE_UNAVAILABLE"); }
      this.#validateLinks(manifest);
    }
    for (const row of this.#database.prepare(`SELECT release_candidate_id, manifest_fingerprint, acceptance_manifest_id
      FROM release_manifest_replay`).all()) {
      const manifest = this.findManifest(text(row["acceptance_manifest_id"]));
      if (manifest?.releaseCandidateId !== text(row["release_candidate_id"])
        || manifest.manifestFingerprint !== text(row["manifest_fingerprint"])) throw failure("PERSISTENCE_UNAVAILABLE");
    }
    const missingReplay = this.#database.prepare(`SELECT COUNT(*) AS count FROM release_acceptance_manifests AS m
      LEFT JOIN release_manifest_replay AS r ON r.acceptance_manifest_id = m.acceptance_manifest_id
      WHERE r.acceptance_manifest_id IS NULL`).get();
    if (Number(missingReplay?.["count"] ?? 0) !== 0) throw failure("PERSISTENCE_UNAVAILABLE");
    const orphan = this.#database.prepare(`SELECT COUNT(*) AS count FROM release_candidates AS c
      LEFT JOIN release_acceptance_manifests AS m ON m.release_candidate_id = c.release_candidate_id
      WHERE m.acceptance_manifest_id IS NULL`).get();
    if (Number(orphan?.["count"] ?? 0) !== 0) throw failure("PERSISTENCE_UNAVAILABLE");
  }

  #validateLinks(manifest: ReleaseAcceptanceManifest): void {
    const rows = this.#database.prepare(`SELECT link_kind, link_sequence, reference_id, payload_json
      FROM release_manifest_evidence_links WHERE acceptance_manifest_id = ?
      ORDER BY link_kind ASC, link_sequence ASC`).all(manifest.acceptanceManifestId);
    const expected = [
      ...manifest.evidenceRefs.map((reference, sequence) => ({ kind: "EVIDENCE", sequence, referenceId: reference.evidenceRef, payload: canonicalJson(reference) })),
      ...manifest.readinessRefs.map((reference, sequence) => ({ kind: "READINESS", sequence, referenceId: reference.readinessRef, payload: canonicalJson(reference) })),
    ].sort((left, right) => left.kind.localeCompare(right.kind, "en") || left.sequence - right.sequence);
    if (rows.length !== expected.length) throw failure("PERSISTENCE_UNAVAILABLE");
    rows.forEach((row, index) => {
      const wanted = expected[index]!;
      if (text(row["link_kind"]) !== wanted.kind
        || Number(row["link_sequence"]) !== wanted.sequence
        || text(row["reference_id"]) !== wanted.referenceId
        || text(row["payload_json"]) !== wanted.payload) throw failure("PERSISTENCE_UNAVAILABLE");
    });
  }

  #validateLineage(manifest: ReleaseAcceptanceManifest): void {
    let predecessorId = manifest.previousManifestId;
    if (predecessorId === null) return;
    const visited = new Set<string>([manifest.acceptanceManifestId]);
    while (predecessorId !== null) {
      if (visited.has(predecessorId)) throw failure("LINEAGE_CONFLICT");
      visited.add(predecessorId);
      const predecessor = this.findManifest(predecessorId);
      if (predecessor?.releaseCandidateId !== manifest.releaseCandidateId) throw failure("LINEAGE_CONFLICT");
      predecessorId = predecessor.previousManifestId;
    }
  }
}

const APPEND_ONLY_TABLES = ["release_candidates", "release_acceptance_manifests", "release_manifest_replay", "release_manifest_evidence_links"] as const;
const APPEND_ONLY_TRIGGER_SQL = APPEND_ONLY_TABLES.flatMap((table) => [
  `CREATE TRIGGER IF NOT EXISTS ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT, 'append-only'); END`,
  `CREATE TRIGGER IF NOT EXISTS ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT, 'append-only'); END`,
]);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS release_candidates (
  release_candidate_id TEXT PRIMARY KEY,
  candidate_fingerprint TEXT NOT NULL UNIQUE,
  logical_release_id TEXT NOT NULL,
  source_commit_sha TEXT NOT NULL,
  repository_identity TEXT NOT NULL,
  source_branch TEXT NOT NULL,
  artifact_fingerprint TEXT NOT NULL,
  target_environment TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json))
);
CREATE TABLE IF NOT EXISTS release_acceptance_manifests (
  acceptance_manifest_id TEXT PRIMARY KEY,
  release_candidate_id TEXT NOT NULL REFERENCES release_candidates(release_candidate_id),
  manifest_fingerprint TEXT NOT NULL,
  acceptance_result TEXT NOT NULL CHECK(acceptance_result IN ('ACCEPTED','REJECTED','INCOMPLETE')),
  accepted_by TEXT,
  accepted_at TEXT,
  evaluated_at TEXT NOT NULL,
  decision_evidence_ref TEXT NOT NULL,
  previous_manifest_id TEXT REFERENCES release_acceptance_manifests(acceptance_manifest_id),
  created_at TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  UNIQUE(release_candidate_id, manifest_fingerprint)
);
CREATE TABLE IF NOT EXISTS release_manifest_replay (
  release_candidate_id TEXT NOT NULL REFERENCES release_candidates(release_candidate_id),
  manifest_fingerprint TEXT NOT NULL,
  acceptance_manifest_id TEXT NOT NULL UNIQUE REFERENCES release_acceptance_manifests(acceptance_manifest_id),
  created_at TEXT NOT NULL,
  PRIMARY KEY(release_candidate_id, manifest_fingerprint)
);
CREATE TABLE IF NOT EXISTS release_manifest_evidence_links (
  acceptance_manifest_id TEXT NOT NULL REFERENCES release_acceptance_manifests(acceptance_manifest_id),
  link_kind TEXT NOT NULL CHECK(link_kind IN ('EVIDENCE','READINESS')),
  link_sequence INTEGER NOT NULL CHECK(link_sequence >= 0),
  reference_id TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  PRIMARY KEY(acceptance_manifest_id, link_kind, link_sequence)
);
${APPEND_ONLY_TRIGGER_SQL.join(";\n")};
`;

function validateSchema(database: DatabaseSync): void {
  for (const table of APPEND_ONLY_TABLES) {
    const row = database.prepare("SELECT type FROM sqlite_schema WHERE name = ?").get(table);
    if (row?.["type"] !== "table") throw failure("PERSISTENCE_UNAVAILABLE");
  }
  for (const expected of APPEND_ONLY_TRIGGER_SQL) {
    const name = /TRIGGER IF NOT EXISTS ([a-z0-9_]+)/u.exec(expected)?.[1];
    if (name === undefined) throw failure("PERSISTENCE_UNAVAILABLE");
    const row = database.prepare("SELECT sql FROM sqlite_schema WHERE type = 'trigger' AND name = ?").get(name);
    if (normalizeSql(text(row?.["sql"])) !== normalizeSql(expected)) throw failure("PERSISTENCE_UNAVAILABLE");
  }
}

function isFileDatabasePath(value: string): boolean {
  return typeof value === "string" && value.trim().length > 0 && value !== ":memory:" && !value.startsWith("file::memory:");
}

function assertIdentity(value: string): void {
  if (!/^[a-f0-9]{64}$/u.test(value)) throw failure("PERSISTENCE_INPUT_INVALID");
}

function assertTimestamp(value: string): void {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) throw failure("PERSISTENCE_INPUT_INVALID");
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) throw failure("PERSISTENCE_INPUT_INVALID");
}

function assertCanonicalCandidateShape(value: Rel001StagingCandidate): void {
  assertExactKeys(value, ["acceptanceResult", "artifactFingerprint", "artifactManifest", "candidateFingerprint", "generatedAt", "logicalReleaseId", "releaseCandidateId", "releaseScopeCoverage", "repositoryIdentity", "sourceBranch", "sourceCommitSha", "targetEnvironment"]);
  if (value.logicalReleaseId !== "REL-001" || value.targetEnvironment !== "Staging" || value.acceptanceResult !== "INCOMPLETE") throw failure("PERSISTENCE_INPUT_INVALID");
  if (![value.releaseCandidateId, value.candidateFingerprint, value.artifactFingerprint].every((item) => typeof item === "string" && /^[a-f0-9]{64}$/u.test(item))) throw failure("PERSISTENCE_INPUT_INVALID");
  if (typeof value.sourceCommitSha !== "string" || !/^[a-f0-9]{40}$/u.test(value.sourceCommitSha)) throw failure("PERSISTENCE_INPUT_INVALID");
  if (![value.repositoryIdentity, value.sourceBranch, value.generatedAt].every((item) => typeof item === "string" && item.length > 0)) throw failure("PERSISTENCE_INPUT_INVALID");
  assertCandidateTimestamp(value.generatedAt);
  if (!Array.isArray(value.releaseScopeCoverage)) throw failure("PERSISTENCE_INPUT_INVALID");
  for (const row of value.releaseScopeCoverage) {
    assertExactKeys(row, ["artifactComponentId", "artifactIncluded", "executableRuntimeAvailable", "gapDisposition", "implementationRuntimeEvidenceRef", "requiredByReleaseScope"]);
    if (typeof row["artifactComponentId"] !== "string" || typeof row["implementationRuntimeEvidenceRef"] !== "string"
      || typeof row["requiredByReleaseScope"] !== "boolean" || typeof row["executableRuntimeAvailable"] !== "boolean" || typeof row["artifactIncluded"] !== "boolean"
      || typeof row["gapDisposition"] !== "string" || !["INCLUDED", "INCOMPLETE_RUNTIME_SURFACE", "OUT_OF_SCOPE"].includes(row["gapDisposition"])) throw failure("PERSISTENCE_INPUT_INVALID");
    assertBoundedRelativeReference(row["implementationRuntimeEvidenceRef"]);
  }
  const artifact = value.artifactManifest;
  assertExactKeys(artifact, ["artifactFingerprint", "artifactManifestVersion", "excludedClassPolicy", "generatedAt", "includedFilePaths", "logicalReleaseId", "repositoryIdentity", "runtimeComponents", "sourceCommitSha", "targetEnvironment"]);
  if (!Array.isArray(artifact.runtimeComponents) || !Array.isArray(artifact.includedFilePaths) || !Array.isArray(artifact.excludedClassPolicy)) throw failure("PERSISTENCE_INPUT_INVALID");
  if (artifact.artifactManifestVersion !== "1" || artifact.logicalReleaseId !== value.logicalReleaseId
    || artifact.targetEnvironment !== value.targetEnvironment || artifact.sourceCommitSha !== value.sourceCommitSha
    || artifact.repositoryIdentity !== value.repositoryIdentity || artifact.artifactFingerprint !== value.artifactFingerprint
    || artifact.generatedAt !== value.generatedAt) throw failure("PERSISTENCE_INPUT_INVALID");
  artifact.includedFilePaths.forEach(assertBoundedRelativePath);
  if (artifact.excludedClassPolicy.some((item) => typeof item !== "string" || item.length === 0)) throw failure("PERSISTENCE_INPUT_INVALID");
  for (const component of artifact.runtimeComponents) {
    assertExactKeys(component, ["artifactComponentId", "componentFingerprint", "includedFiles", "runtimeEntryPoint"]);
    if (component["artifactComponentId"] !== "API-015_ADMINISTRATION_HTTP"
      || component["runtimeEntryPoint"] !== "apps/api/src/administration-production-composition.js"
      || typeof component["componentFingerprint"] !== "string" || !/^[a-f0-9]{64}$/u.test(component["componentFingerprint"])) throw failure("PERSISTENCE_INPUT_INVALID");
    if (!Array.isArray(component["includedFiles"])) throw failure("PERSISTENCE_INPUT_INVALID");
    for (const file of component["includedFiles"]) {
      assertExactKeys(file, ["fileSha256", "fileSize", "path"]);
      if (typeof file["path"] !== "string" || !Number.isSafeInteger(file["fileSize"]) || (file["fileSize"] as number) < 0 || typeof file["fileSha256"] !== "string" || !/^[a-f0-9]{64}$/u.test(file["fileSha256"])) throw failure("PERSISTENCE_INPUT_INVALID");
      assertBoundedRelativePath(file["path"]);
    }
  }
}

function assertCandidateTimestamp(value: string): void {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(value)) throw failure("PERSISTENCE_INPUT_INVALID");
  if (new Date(value).toISOString().slice(0, 19) !== value.slice(0, 19)) throw failure("PERSISTENCE_INPUT_INVALID");
}

function assertCandidateIntegrityForPersistence(candidate: Rel001StagingCandidate): void {
  try {
    assertRel001StagingCandidateIntegrity(candidate);
  } catch {
    throw failure("PERSISTENCE_INPUT_INVALID");
  }
}

function assertBoundedRelativePath(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512 || value.includes("\\")
    || value.startsWith("/") || /^[A-Za-z]:/u.test(value) || value.split("/").some((part) => part === ".." || part === "")) throw failure("PERSISTENCE_INPUT_INVALID");
}

function assertBoundedRelativeReference(value: string): void {
  const path = value.split("#", 1)[0];
  assertBoundedRelativePath(path);
}

function assertExactKeys(value: unknown, expected: readonly string[]): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw failure("PERSISTENCE_INPUT_INVALID");
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) throw failure("PERSISTENCE_INPUT_INVALID");
}

function failure(code: ReleaseAcceptancePersistenceErrorCode): ReleaseAcceptancePersistenceError {
  return new ReleaseAcceptancePersistenceError(code);
}

function validateForPersistence(candidate: Rel001StagingCandidate, manifest: ReleaseAcceptanceManifest): ReleaseAcceptanceManifest {
  try {
    return validateReleaseAcceptanceManifest(candidate, manifest);
  } catch (error) {
    if (error instanceof ReleaseAcceptanceManifestError) {
      if (error.code === "CANDIDATE_CONFLICT") throw failure("CANDIDATE_CONFLICT");
      if (error.code === "MANIFEST_IDENTITY_CONFLICT") throw failure("MANIFEST_IDENTITY_CONFLICT");
      throw failure("PERSISTENCE_INPUT_INVALID");
    }
    throw error;
  }
}

function text(value: SQLOutputValue | undefined): string {
  if (typeof value !== "string") throw failure("PERSISTENCE_UNAVAILABLE");
  return value;
}

function nullableText(value: SQLOutputValue | undefined): string | null {
  if (value === null) return null;
  return text(value);
}

function parse<T>(value: string): T {
  try { return JSON.parse(value) as T; } catch { throw failure("PERSISTENCE_UNAVAILABLE"); }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizeSql(value: string): string {
  return value.replace(/\s+/gu, " ").replace(/\s+if not exists/giu, "").replace(/;$/u, "").trim().toLowerCase();
}

function immutable<T>(value: T): T {
  return deepFreeze(structuredClone(value));
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
