import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test, { afterEach } from "node:test";

import {
  materializeRel001StagingCandidate,
  type Rel001StagingCandidate,
} from "./release-candidate-artifact.js";
import {
  createReleaseAcceptanceManifest,
  type ReleaseAcceptanceManifestInput,
} from "./release-evidence-manifest.js";
import {
  DurableReleaseAcceptanceManifestStore,
  ReleaseAcceptancePersistenceError,
} from "./durable-release-acceptance-manifest-store.js";

const fixtureDirectories: string[] = [];

afterEach(() => {
  while (fixtureDirectories.length > 0) rmSync(fixtureDirectories.pop()!, { recursive: true, force: true });
});

function fixtureDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "feat024-c-"));
  fixtureDirectories.push(directory);
  return join(directory, "release-evidence.sqlite");
}

const candidate = JSON.parse(readFileSync(
  "docs/implementation/FEAT024_REL001_STAGING_PARTIAL_RUNTIME_CANDIDATE_MANIFEST.json",
  "utf8",
)) as Rel001StagingCandidate;

function manifestInput(forCandidate: Rel001StagingCandidate, overrides: Partial<ReleaseAcceptanceManifestInput> = {}): ReleaseAcceptanceManifestInput {
  return {
    evidenceRefs: [{
      evidenceType: "TEST_RESULT",
      evidenceRef: "evidence:feat024-c-tests",
      sourceFeatureOrRegistry: "FEAT-024",
      sourceCommitSha: forCandidate.sourceCommitSha,
      candidateBindingFingerprint: forCandidate.candidateFingerprint,
      evaluatedAt: "2026-09-11T01:00:00.000Z",
      safeResultSummary: "Durability validation passed",
    }],
    readinessRefs: [{
      readinessType: "DEPLOYMENT",
      readinessRef: "readiness-projection:rel001-staging",
      releaseCandidateId: forCandidate.releaseCandidateId,
      candidateBindingFingerprint: forCandidate.candidateFingerprint,
      targetEnvironment: forCandidate.targetEnvironment,
      readiness: "UNKNOWN",
      freshness: "UNKNOWN",
      evaluatedAt: "2026-09-11T01:00:00.000Z",
      safeReasonCodes: ["MISSING_RUNTIME_SURFACES"],
      evidenceRefs: ["evidence:feat024-a-candidate"],
    }],
    acceptanceResult: "INCOMPLETE",
    acceptedBy: null,
    evaluatedAt: "2026-09-11T02:00:00.000Z",
    acceptedAt: null,
    decisionEvidenceRef: "evidence:rel001-incomplete-evaluation",
    previousManifestId: null,
    ...overrides,
  };
}

function manifest(overrides: Partial<ReleaseAcceptanceManifestInput> = {}) {
  return manifestFor(candidate, overrides);
}

function manifestFor(forCandidate: Rel001StagingCandidate, overrides: Partial<ReleaseAcceptanceManifestInput> = {}) {
  return createReleaseAcceptanceManifest(forCandidate, manifestInput(forCandidate, overrides));
}

function alternateCandidate(
  sourceBranch = "codex/alternate-release-candidate",
  repositoryIdentity = candidate.repositoryIdentity,
): Rel001StagingCandidate {
  const sourceCommitSha = "a".repeat(40);
  const runtimeComponents = candidate.artifactManifest.runtimeComponents.map((component) => ({
    ...component,
    includedFiles: component.includedFiles.map((file) => ({ ...file })),
  }));
  const componentFingerprint = sha256(runtimeComponents[0]!.includedFiles
    .map((file) => `${file.path}\0${file.fileSha256}\0${file.fileSize}`).join("\n"));
  runtimeComponents[0] = { ...runtimeComponents[0]!, componentFingerprint };
  const artifactFingerprint = sha256(["REL-001", "Staging", sourceCommitSha, `API-015_ADMINISTRATION_HTTP:${componentFingerprint}`].join("\0"));
  const releaseCandidateId = sha256(["REL-001", sourceCommitSha, repositoryIdentity, sourceBranch, artifactFingerprint, "Staging"].join("\0"));
  const candidateFingerprint = sha256([releaseCandidateId, "REL-001", sourceCommitSha, repositoryIdentity, sourceBranch, artifactFingerprint, "Staging"].join("\0"));
  return {
    ...candidate,
    releaseCandidateId,
    sourceCommitSha,
    repositoryIdentity,
    sourceBranch,
    artifactFingerprint,
    candidateFingerprint,
    artifactManifest: {
      ...candidate.artifactManifest,
      sourceCommitSha,
      repositoryIdentity,
      artifactFingerprint,
      runtimeComponents,
    },
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function expectPersistenceCode(run: () => unknown, code: string): void {
  assert.throws(run, (error: unknown) => error instanceof ReleaseAcceptancePersistenceError && error.code === code);
}

function rowCounts(databasePath: string): Readonly<Record<string, number>> {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const tables = ["release_candidates", "release_acceptance_manifests", "release_manifest_replay", "release_manifest_evidence_links"];
    return Object.fromEntries(tables.map((table) => {
      const row = database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get();
      return [table, Number(row?.["count"] ?? 0)];
    }));
  } finally {
    database.close();
  }
}

function restoreAppendOnlyTriggers(database: DatabaseSync, table: string): void {
  database.exec(`CREATE TRIGGER IF NOT EXISTS ${table}_no_update BEFORE UPDATE ON ${table} BEGIN SELECT RAISE(ABORT, 'append-only'); END`);
  database.exec(`CREATE TRIGGER IF NOT EXISTS ${table}_no_delete BEFORE DELETE ON ${table} BEGIN SELECT RAISE(ABORT, 'append-only'); END`);
}

test("FEAT-024-C persists a validated candidate and manifest across reopen", () => {
  const databasePath = fixtureDatabasePath();
  let store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  const stored = store.append(candidate, manifest(), "2026-09-11T03:00:00.000Z");
  store.close();

  store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  assert.deepEqual(store.findManifest(stored.acceptanceManifestId), stored);
  assert.deepEqual(store.findCandidate(candidate.releaseCandidateId), candidate);
  store.close();
});

test("REL-001 Staging reevaluation durably persists the exact Phase 7 candidate across reopen", async () => {
  const exactCandidate = await materializeRel001StagingCandidate({
    distRoot: "dist",
    sourceCommitSha: "cd620b273c8e7672ffc1e015380ce36d486d9a9a",
    repositoryIdentity: "https://github.com/25300park/ai-mls.git",
    sourceBranch: "main",
    generatedAt: "2026-09-16T06:00:00.000Z",
  });
  const exactManifest = manifestFor(exactCandidate, {
    evaluatedAt: "2026-09-16T07:10:38.468Z",
    decisionEvidenceRef: "staging-reevaluation:decision:incomplete",
  });
  assert.equal(exactManifest.acceptanceManifestId, "0d7d498dc2d31805bc81b1f626ee0a20a22925d53c8ef0e4d819174dca370c7b");
  assert.equal(exactManifest.manifestFingerprint, "f5ff455dae9f544b2aa2f1c918d7941ef0e40e4d6d53973d85bf402f09d830b7");
  assert.equal(exactManifest.acceptanceResult, "INCOMPLETE");
  assert.equal(exactManifest.acceptedBy, null);
  assert.equal(exactManifest.acceptedAt, null);
  const databasePath = fixtureDatabasePath();
  let store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  store.append(exactCandidate, exactManifest, "2026-09-16T07:11:00.000Z");
  store.close();

  store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  assert.deepEqual(store.findCandidate(exactCandidate.releaseCandidateId), exactCandidate);
  assert.deepEqual(store.findManifest(exactManifest.acceptanceManifestId), exactManifest);
  store.close();
});

test("FEAT-024-C exact replay returns the durable result without duplicate rows", () => {
  const databasePath = fixtureDatabasePath();
  let store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  const first = store.append(candidate, manifest(), "2026-09-11T03:00:00.000Z");
  store.close();

  store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  const replay = store.append(candidate, manifest(), "2026-09-12T03:00:00.000Z");
  store.close();

  assert.deepEqual(replay, first);
  assert.deepEqual(rowCounts(databasePath), {
    release_candidates: 1,
    release_acceptance_manifests: 1,
    release_manifest_replay: 1,
    release_manifest_evidence_links: 2,
  });
});

test("FEAT-024-C timestamp-only replay preserves the first authoritative manifest", () => {
  const databasePath = fixtureDatabasePath();
  const store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  const first = store.append(candidate, manifest(), "2026-09-11T03:00:00.000Z");
  const replay = store.append(candidate, manifest({ evaluatedAt: "2026-09-12T02:00:00.000Z" }), "2026-09-12T03:00:00.000Z");
  store.close();

  assert.equal(replay.evaluatedAt, first.evaluatedAt);
  assert.equal(rowCounts(databasePath)["release_acceptance_manifests"], 1);
});

test("FEAT-024-C rejects candidate identity rebinding without mutation", () => {
  const databasePath = fixtureDatabasePath();
  const store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  store.append(candidate, manifest(), "2026-09-11T03:00:00.000Z");

  expectPersistenceCode(() => store.append({ ...candidate, sourceBranch: "main" }, manifest(), "2026-09-12T03:00:00.000Z"), "CANDIDATE_CONFLICT");
  store.close();
  assert.equal(rowCounts(databasePath)["release_candidates"], 1);
});

test("FEAT-024-C rejects a manifest identity rebound to different content", () => {
  const databasePath = fixtureDatabasePath();
  const store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  const first = store.append(candidate, manifest(), "2026-09-11T03:00:00.000Z");
  const forged = {
    ...first,
    evidenceRefs: [{ ...first.evidenceRefs[0]!, safeResultSummary: "Changed evidence" }],
  };

  expectPersistenceCode(() => store.append(candidate, forged, "2026-09-12T03:00:00.000Z"), "MANIFEST_IDENTITY_CONFLICT");
  store.close();
  assert.equal(rowCounts(databasePath)["release_acceptance_manifests"], 1);
});

test("FEAT-024-C rolls back candidate, manifest, links and replay when the transaction fails", () => {
  const databasePath = fixtureDatabasePath();
  const store = new DurableReleaseAcceptanceManifestStore({
    databasePath,
    beforeReplayBindingWrite: () => { throw new Error("injected transaction failure"); },
  });

  expectPersistenceCode(() => store.append(candidate, manifest(), "2026-09-11T03:00:00.000Z"), "PERSISTENCE_UNAVAILABLE");
  store.close();
  assert.deepEqual(rowCounts(databasePath), {
    release_candidates: 0,
    release_acceptance_manifests: 0,
    release_manifest_replay: 0,
    release_manifest_evidence_links: 0,
  });
});

test("FEAT-024-C appends changed evidence as immutable same-candidate history", () => {
  const databasePath = fixtureDatabasePath();
  const store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  const first = store.append(candidate, manifest(), "2026-09-11T03:00:00.000Z");
  const changed = manifest({
    evidenceRefs: [{ ...manifestInput(candidate).evidenceRefs[0]!, safeResultSummary: "Affected regression passed" }],
    previousManifestId: first.acceptanceManifestId,
  });
  const second = store.append(candidate, changed, "2026-09-12T03:00:00.000Z");

  assert.notEqual(second.acceptanceManifestId, first.acceptanceManifestId);
  assert.deepEqual(store.findManifest(first.acceptanceManifestId), first);
  assert.deepEqual(store.listManifestHistory(candidate.releaseCandidateId), [first, second]);
  store.close();
});

test("FEAT-024-C rejects a missing predecessor without partial writes", () => {
  const databasePath = fixtureDatabasePath();
  const store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  const child = manifest({ previousManifestId: "f".repeat(64) });

  expectPersistenceCode(() => store.append(candidate, child, "2026-09-11T03:00:00.000Z"), "LINEAGE_CONFLICT");
  store.close();
  assert.deepEqual(rowCounts(databasePath), {
    release_candidates: 0,
    release_acceptance_manifests: 0,
    release_manifest_replay: 0,
    release_manifest_evidence_links: 0,
  });
});

test("FEAT-024-C rejects a cross-candidate predecessor", () => {
  const databasePath = fixtureDatabasePath();
  const store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  const first = store.append(candidate, manifest(), "2026-09-11T03:00:00.000Z");
  const otherCandidate = alternateCandidate();
  const otherManifest = manifestFor(otherCandidate, { previousManifestId: first.acceptanceManifestId });

  expectPersistenceCode(() => store.append(otherCandidate, otherManifest, "2026-09-12T03:00:00.000Z"), "LINEAGE_CONFLICT");
  assert.equal(store.findCandidate(otherCandidate.releaseCandidateId), undefined);
  store.close();
});

test("FEAT-024-C rejects unsafe evidence and REL-001 acceptance elevation before persistence", () => {
  const unsafe = {
    ...manifest(),
    evidenceRefs: [{ ...manifest().evidenceRefs[0]!, safeResultSummary: "Authorization: Bearer unsafe-test-value" }],
  };
  const elevated = {
    ...manifest(),
    acceptanceResult: "ACCEPTED" as const,
    acceptedBy: "actor:release-owner",
    acceptedAt: "2026-09-11T03:00:00.000Z",
  };
  for (const proposed of [unsafe, elevated]) {
    const databasePath = fixtureDatabasePath();
    const store = new DurableReleaseAcceptanceManifestStore({ databasePath });
    assert.throws(() => store.append(candidate, proposed, "2026-09-11T04:00:00.000Z"));
    store.close();
    assert.equal(rowCounts(databasePath)["release_acceptance_manifests"], 0);
  }
});

test("FEAT-024-C database triggers prevent update and delete of every partition", () => {
  const databasePath = fixtureDatabasePath();
  const store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  store.append(candidate, manifest(), "2026-09-11T03:00:00.000Z");
  store.close();

  const database = new DatabaseSync(databasePath);
  try {
    for (const [table, column] of [
      ["release_candidates", "created_at"],
      ["release_acceptance_manifests", "created_at"],
      ["release_manifest_replay", "created_at"],
      ["release_manifest_evidence_links", "reference_id"],
    ] as const) {
      assert.throws(() => database.exec(`UPDATE ${table} SET ${column} = 'changed'`));
      assert.throws(() => database.exec(`DELETE FROM ${table}`));
    }
  } finally {
    database.close();
  }
});

test("FEAT-024-C fails closed when persisted lineage is cyclic or inconsistent", () => {
  const databasePath = fixtureDatabasePath();
  const store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  const first = store.append(candidate, manifest(), "2026-09-11T03:00:00.000Z");
  const second = store.append(candidate, manifest({
    evidenceRefs: [{ ...manifestInput(candidate).evidenceRefs[0]!, safeResultSummary: "Changed result" }],
    previousManifestId: first.acceptanceManifestId,
  }), "2026-09-12T03:00:00.000Z");
  store.close();

  const database = new DatabaseSync(databasePath);
  database.exec("DROP TRIGGER release_acceptance_manifests_no_update");
  database.prepare("UPDATE release_acceptance_manifests SET previous_manifest_id = ? WHERE acceptance_manifest_id = ?")
    .run(second.acceptanceManifestId, first.acceptanceManifestId);
  restoreAppendOnlyTriggers(database, "release_acceptance_manifests");
  database.close();

  expectPersistenceCode(() => new DurableReleaseAcceptanceManifestStore({ databasePath }), "PERSISTENCE_UNAVAILABLE");
});

test("FEAT-024-C fails closed when a replay binding is rebound after persistence", () => {
  const databasePath = fixtureDatabasePath();
  const store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  const first = store.append(candidate, manifest(), "2026-09-11T03:00:00.000Z");
  const second = store.append(candidate, manifest({
    evidenceRefs: [{ ...manifestInput(candidate).evidenceRefs[0]!, safeResultSummary: "Changed result" }],
    previousManifestId: first.acceptanceManifestId,
  }), "2026-09-12T03:00:00.000Z");
  store.close();

  const database = new DatabaseSync(databasePath);
  database.exec("DROP TRIGGER release_manifest_replay_no_update");
  database.exec("DROP TRIGGER release_manifest_replay_no_delete");
  database.prepare("DELETE FROM release_manifest_replay WHERE manifest_fingerprint = ?").run(second.manifestFingerprint);
  database.prepare("UPDATE release_manifest_replay SET acceptance_manifest_id = ? WHERE manifest_fingerprint = ?")
    .run(second.acceptanceManifestId, first.manifestFingerprint);
  restoreAppendOnlyTriggers(database, "release_manifest_replay");
  database.close();

  expectPersistenceCode(() => new DurableReleaseAcceptanceManifestStore({ databasePath }), "PERSISTENCE_UNAVAILABLE");
});

test("FEAT-024-C fails closed when durable evidence linkage no longer matches the manifest", () => {
  const databasePath = fixtureDatabasePath();
  const store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  const stored = store.append(candidate, manifest(), "2026-09-11T03:00:00.000Z");
  store.close();

  const database = new DatabaseSync(databasePath);
  database.exec("DROP TRIGGER release_manifest_evidence_links_no_update");
  database.prepare(`UPDATE release_manifest_evidence_links SET reference_id = 'evidence:unbound'
    WHERE acceptance_manifest_id = ? AND link_kind = 'EVIDENCE'`).run(stored.acceptanceManifestId);
  restoreAppendOnlyTriggers(database, "release_manifest_evidence_links");
  database.close();

  expectPersistenceCode(() => new DurableReleaseAcceptanceManifestStore({ databasePath }), "PERSISTENCE_UNAVAILABLE");
});

test("FEAT-024-C fails closed when append-only schema protection is missing", () => {
  const databasePath = fixtureDatabasePath();
  const store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  store.append(candidate, manifest(), "2026-09-11T03:00:00.000Z");
  store.close();

  const database = new DatabaseSync(databasePath);
  database.exec("DROP TRIGGER release_candidates_no_update");
  database.close();

  expectPersistenceCode(() => new DurableReleaseAcceptanceManifestStore({ databasePath }), "PERSISTENCE_UNAVAILABLE");
});

test("FEAT-024-C rejects non-canonical candidate fields before persistence", () => {
  const databasePath = fixtureDatabasePath();
  const store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  const candidateWithRawEvidence = {
    ...candidate,
    rawScannerPayload: { result: "not canonical" },
  } as Rel001StagingCandidate;

  expectPersistenceCode(() => store.append(candidateWithRawEvidence, manifest(), "2026-09-11T03:00:00.000Z"), "PERSISTENCE_INPUT_INVALID");
  store.close();
  assert.equal(rowCounts(databasePath)["release_candidates"], 0);
});

test("FEAT-024-C persists the exact approved REL-001 candidate artifact", () => {
  const exactCandidate = JSON.parse(readFileSync(
    "docs/implementation/FEAT024_REL001_STAGING_PARTIAL_RUNTIME_CANDIDATE_MANIFEST.json",
    "utf8",
  )) as Rel001StagingCandidate;
  const databasePath = fixtureDatabasePath();
  const store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  const exactManifest = manifestFor(exactCandidate);

  store.append(exactCandidate, exactManifest, "2026-09-11T04:00:00.000Z");
  assert.deepEqual(store.findCandidate(exactCandidate.releaseCandidateId), exactCandidate);
  store.close();
});

test("FEAT-024-C rejects unsafe absolute paths hidden in canonical candidate fields", () => {
  const databasePath = fixtureDatabasePath();
  const store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  const unsafeCandidate = {
    ...candidate,
    artifactManifest: {
      ...candidate.artifactManifest,
      includedFilePaths: ["C:\\private\\release-evidence.json"],
    },
  };

  expectPersistenceCode(() => store.append(unsafeCandidate, manifest(), "2026-09-11T04:00:00.000Z"), "PERSISTENCE_INPUT_INVALID");
  store.close();
  assert.equal(rowCounts(databasePath)["release_candidates"], 0);
});

test("FEAT-024-C rejects safely-shaped candidate artifact and scope tampering", () => {
  const databasePath = fixtureDatabasePath();
  const store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  const component = candidate.artifactManifest.runtimeComponents[0]!;
  const tamperedCandidates: Rel001StagingCandidate[] = [
    {
      ...candidate,
      artifactManifest: {
        ...candidate.artifactManifest,
        runtimeComponents: [{
          ...component,
          includedFiles: [{ ...component.includedFiles[0]!, fileSize: component.includedFiles[0]!.fileSize + 1 }, ...component.includedFiles.slice(1)],
        }],
      },
    },
    { ...candidate, releaseScopeCoverage: [{ ...candidate.releaseScopeCoverage[0]!, implementationRuntimeEvidenceRef: "apps/api/src/main.ts#alternate" }, ...candidate.releaseScopeCoverage.slice(1)] },
    { ...candidate, artifactManifest: { ...candidate.artifactManifest, excludedClassPolicy: [...candidate.artifactManifest.excludedClassPolicy, "alternate safe policy"] } },
    { ...candidate, artifactManifest: { ...candidate.artifactManifest, includedFilePaths: candidate.artifactManifest.includedFilePaths.slice(1) } },
    { ...candidate, artifactManifest: { ...candidate.artifactManifest, runtimeComponents: [] } },
  ];

  for (const tamperedCandidate of tamperedCandidates) {
    expectPersistenceCode(() => store.append(tamperedCandidate, manifest(), "2026-09-11T04:00:00.000Z"), "PERSISTENCE_INPUT_INVALID");
  }
  store.close();
  assert.equal(rowCounts(databasePath)["release_candidates"], 0);
});

test("FEAT-024-C rejects calendar-invalid candidate timestamps", () => {
  const databasePath = fixtureDatabasePath();
  const store = new DurableReleaseAcceptanceManifestStore({ databasePath });
  const invalidTimestamp = "2026-02-30T00:00:00.1234567Z";
  const invalidCandidate = {
    ...candidate,
    generatedAt: invalidTimestamp,
    artifactManifest: { ...candidate.artifactManifest, generatedAt: invalidTimestamp },
  };

  expectPersistenceCode(() => store.append(invalidCandidate, manifest(), "2026-09-11T04:00:00.000Z"), "PERSISTENCE_INPUT_INVALID");
  store.close();
  assert.equal(rowCounts(databasePath)["release_candidates"], 0);
});

test("FEAT-024-C rejects unsafe values hidden in candidate identity fields", () => {
  const unsafeCandidates = [
    alternateCandidate("feature/sk_unsafecredential123"),
    alternateCandidate("user@example.com"),
    alternateCandidate("feature/chain-of-thought"),
    alternateCandidate("codex/safe-branch", "C:\\private\\release.sqlite"),
    alternateCandidate("codex/safe-branch", "Bearer unsafe-test-value"),
  ];

  for (const unsafeCandidate of unsafeCandidates) {
    const databasePath = fixtureDatabasePath();
    const store = new DurableReleaseAcceptanceManifestStore({ databasePath });
    expectPersistenceCode(
      () => store.append(unsafeCandidate, manifestFor(unsafeCandidate), "2026-09-11T04:00:00.000Z"),
      "PERSISTENCE_INPUT_INVALID",
    );
    store.close();
    assert.equal(rowCounts(databasePath)["release_candidates"], 0);
  }
});
