import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { materializeRel001StagingCandidate } from "./release-candidate-artifact.js";

const SOURCE_SHA = "7e9747a50c643152532e06fb443bbb1b5d945350";
const PHASE7_SOURCE_SHA = "cd620b273c8e7672ffc1e015380ce36d486d9a9a";
const BLOCKER1C_SOURCE_SHA = "97a3522fb301fea197d3fa2defc7bc2826c2d719";
const BLOCKER2C_SOURCE_SHA = "b7d2a864b8dbed9c6b1f0c7874481035159af886";

async function withFixture(
  files: Readonly<Record<string, string>>,
  run: (distRoot: string) => Promise<void>,
): Promise<void> {
  const distRoot = await mkdtemp(join(tmpdir(), "feat024-artifact-"));
  try {
    for (const [relativePath, contents] of Object.entries(files)) {
      const absolutePath = join(distRoot, ...relativePath.split("/"));
      await mkdir(join(absolutePath, ".."), { recursive: true });
      await writeFile(absolutePath, contents, "utf8");
    }
    await run(distRoot);
  } finally {
    await rm(distRoot, { recursive: true, force: true });
  }
}

function fixtureFiles(runtimeValue = "api015"): Readonly<Record<string, string>> {
  return {
    ...phase7FixtureFiles(runtimeValue),
    "apps/api/src/administration-production-composition.js": [
      'import { administration } from "../../../modules/administration/src/runtime.js";',
      'import configuration from "./runtime-config.json" with { type: "json" };',
      `export const api015 = administration + configuration.mode + "${runtimeValue}";`,
    ].join("\n"),
    "apps/api/src/runtime-config.json": '{"mode":"staging"}',
    "modules/administration/src/runtime.js": [
      'export { authorize } from "../../authorization/src/runtime.js";',
      'export const administration = "administration";',
    ].join("\n"),
    "modules/authorization/src/runtime.js": 'export const authorize = "authorize";',
    "apps/admin-console/src/main.js": 'export const developmentOnly = true;',
    "apps/api/src/composition.test.js": 'throw new Error("test output");',
    "apps/api/src/composition.js.map": "{}",
    "apps/api/src/composition.d.ts": "export {};",
    "apps/api/src/composition.d.ts.map": "{}",
    ".tsbuildinfo": "{}",
    "apps/api/src/source.ts": "export {};",
    "modules/audit/src/audit-log.js": "export class AuditLog {}",
    "modules/jobs/src/job-service.js": "export class JobService {}",
  };
}

function phase7FixtureFiles(runtimeValue = "phase7"): Readonly<Record<string, string>> {
  const roots = [
    "apps/api/src/staging-admin-console-bootstrap.js",
    "apps/api/src/staging-session-composition.js",
    "apps/api/src/administration-production-composition.js",
    "apps/api/src/api016-production-composition.js",
    "modules/jobs/src/job-staging-composition.js",
    "modules/ai/src/advisory-readiness-composition.js",
    "modules/ai/src/advisory-production-composition.js",
    "apps/api/src/staging-integrated-runtime-verification.js",
    "modules/source/src/source-registry-durable-persistence.js",
    "modules/intake/src/intake-durable-persistence.js",
    "modules/property/src/property-durable-persistence.js",
    "modules/listing/src/listing-durable-persistence.js",
    "modules/contact/src/contact-durable-persistence.js",
    "modules/client/src/client-requirement-durable-persistence.js",
    "modules/matching/src/matching-durable-persistence.js",
    "modules/operations/src/security-privacy-operational-controls.js",
    "modules/operations/src/operational-readiness-evidence.js",
    "modules/operations/src/durable-operational-evidence-store.js",
  ] as const;
  return Object.fromEntries(roots.map((path) => [path, `export const runtime = "${path}:${runtimeValue}";`]));
}

async function materializePhase7(distRoot: string, generatedAt = "2026-09-16T00:00:00.000Z") {
  return materializeRel001StagingCandidate({
    distRoot,
    sourceCommitSha: PHASE7_SOURCE_SHA,
    repositoryIdentity: "https://github.com/25300park/ai-mls.git",
    sourceBranch: "main",
    generatedAt,
  });
}

async function materializeBlocker1C(distRoot: string, generatedAt = "2026-09-16T12:00:00.000Z") {
  return materializeRel001StagingCandidate({
    distRoot,
    sourceCommitSha: BLOCKER1C_SOURCE_SHA,
    repositoryIdentity: "https://github.com/25300park/ai-mls.git",
    sourceBranch: "main",
    generatedAt,
  });
}

async function materializeBlocker2C(distRoot: string, generatedAt = "2026-09-16T15:00:00.000Z") {
  return materializeRel001StagingCandidate({
    distRoot,
    sourceCommitSha: BLOCKER2C_SOURCE_SHA,
    repositoryIdentity: "https://github.com/25300park/ai-mls.git",
    sourceBranch: "main",
    generatedAt,
  });
}

test("REL-001 Blocker 2C rebuilds the exact post-UI-006 candidate without mutating Blocker 1C", async () => {
  await withFixture({
    ...phase7FixtureFiles("blocker2c"),
    "apps/api/src/core-identity-authorization-composition.js": 'export const coreApi001002 = "bounded";',
  }, async (distRoot) => {
    const current = await materializeBlocker2C(distRoot);
    const historical = await materializeBlocker1C(distRoot);

    assert.equal(current.sourceCommitSha, BLOCKER2C_SOURCE_SHA);
    assert.equal(current.artifactManifest.runtimeComponents.length, 19);
    assert.equal(current.artifactManifest.runtimeComponents.some((component) =>
      String(component.artifactComponentId) === "CORE_API_001_002_HTTP"), true);
    assert.deepEqual(current.releaseScopeCoverage.find((row) =>
      row.artifactComponentId === "UI_006_CORE_DATA"), {
      artifactComponentId: "UI_006_CORE_DATA",
      requiredByReleaseScope: true,
      executableRuntimeAvailable: true,
      artifactIncluded: true,
      implementationRuntimeEvidenceRef: "apps/admin-console/src/core-identity-console-read-adapter.ts#CoreIdentityConsoleReadAdapter",
      gapDisposition: "INCLUDED",
    });
    assert.equal(current.releaseScopeCoverage.filter((row) => row.requiredByReleaseScope && !row.artifactIncluded).length, 1);
    assert.equal(current.acceptanceResult, "INCOMPLETE");

    assert.equal(historical.sourceCommitSha, BLOCKER1C_SOURCE_SHA);
    assert.equal(historical.artifactManifest.runtimeComponents.length, 19);
    assert.equal(historical.releaseScopeCoverage.filter((row) => row.requiredByReleaseScope && !row.artifactIncluded).length, 2);
  });
});

test("REL-001 Blocker 2C identity is timestamp-independent and changes with an included runtime byte", async () => {
  let first: Awaited<ReturnType<typeof materializeRel001StagingCandidate>> | undefined;
  let replay: Awaited<ReturnType<typeof materializeRel001StagingCandidate>> | undefined;
  let changed: Awaited<ReturnType<typeof materializeRel001StagingCandidate>> | undefined;
  await withFixture({
    ...phase7FixtureFiles("blocker2c"),
    "apps/api/src/core-identity-authorization-composition.js": 'export const coreApi001002 = "bounded";',
  }, async (distRoot) => {
    first = await materializeBlocker2C(distRoot, "2026-09-16T15:00:00.000Z");
    replay = await materializeBlocker2C(distRoot, "2026-09-17T15:00:00.000Z");
  });
  await withFixture({
    ...phase7FixtureFiles("blocker2c-changed"),
    "apps/api/src/core-identity-authorization-composition.js": 'export const coreApi001002 = "bounded";',
  }, async (distRoot) => {
    changed = await materializeBlocker2C(distRoot, "2026-09-16T15:00:00.000Z");
  });

  assert.ok(first && replay && changed);
  assert.equal(first.artifactFingerprint, replay.artifactFingerprint);
  assert.equal(first.releaseCandidateId, replay.releaseCandidateId);
  assert.equal(first.candidateFingerprint, replay.candidateFingerprint);
  assert.notEqual(first.artifactFingerprint, changed.artifactFingerprint);
  assert.notEqual(first.releaseCandidateId, changed.releaseCandidateId);
  assert.notEqual(first.candidateFingerprint, changed.candidateFingerprint);
});

test("REL-001 Blocker 1C rebuilds the exact post-transport candidate without mutating Phase 7", async () => {
  await withFixture({
    ...phase7FixtureFiles("blocker1c"),
    "apps/api/src/core-identity-authorization-composition.js": 'export const coreApi001002 = "bounded";',
  }, async (distRoot) => {
    const current = await materializeBlocker1C(distRoot);
    const historical = await materializePhase7(distRoot);

    assert.equal(current.sourceCommitSha, BLOCKER1C_SOURCE_SHA);
    assert.equal(current.artifactManifest.runtimeComponents.length, 19);
    assert.equal(current.artifactManifest.runtimeComponents.some((component) =>
      String(component.artifactComponentId) === "CORE_API_001_002_HTTP"
      && component.runtimeEntryPoint === "apps/api/src/core-identity-authorization-composition.js"), true);
    assert.deepEqual(current.releaseScopeCoverage.find((row) =>
      row.artifactComponentId === "CORE_API_001_002_PUBLIC_TRANSPORT"), {
      artifactComponentId: "CORE_API_001_002_PUBLIC_TRANSPORT",
      requiredByReleaseScope: true,
      executableRuntimeAvailable: true,
      artifactIncluded: true,
      implementationRuntimeEvidenceRef: "apps/api/src/core-identity-authorization-composition.ts#composeCoreApi001002NodeHttpServer",
      gapDisposition: "INCLUDED",
    });
    assert.equal(current.releaseScopeCoverage.filter((row) => row.requiredByReleaseScope && !row.artifactIncluded).length, 2);
    assert.equal(current.acceptanceResult, "INCOMPLETE");

    assert.equal(historical.sourceCommitSha, PHASE7_SOURCE_SHA);
    assert.equal(historical.artifactManifest.runtimeComponents.length, 18);
    assert.equal(historical.releaseScopeCoverage.filter((row) => row.requiredByReleaseScope && !row.artifactIncluded).length, 3);
  });
});

test("REL-001 Phase 7 rebuilds the exact authorized multi-component Staging candidate", async () => {
  await withFixture(phase7FixtureFiles(), async (distRoot) => {
    const candidate = await materializePhase7(distRoot);

    assert.equal(candidate.sourceCommitSha, PHASE7_SOURCE_SHA);
    assert.equal(candidate.targetEnvironment, "Staging");
    assert.deepEqual(candidate.artifactManifest.runtimeComponents.map((component) => component.artifactComponentId), [
      "ADMIN_CONSOLE_STAGING",
      "API-015_ADMINISTRATION_HTTP",
      "API-016_AUDIT_RUNTIME",
      "API-017_JOB_RUNTIME",
      "CORE_CLIENT_REQUIREMENT_STORE",
      "CORE_CONTACT_STORE",
      "CORE_INTAKE_STORE",
      "CORE_LISTING_STORE",
      "CORE_MATCHING_STORE",
      "CORE_PROPERTY_STORE",
      "CORE_SOURCE_REGISTRY_STORE",
      "FEAT-022_ADVISORY_DURABLE_RUNTIME",
      "FEAT-022_PROVIDER_INDEPENDENT",
      "OPERATIONAL_EVIDENCE_STORE",
      "OPERATIONAL_READINESS_EVIDENCE",
      "OPERATIONAL_SECURITY_CONTROLS",
      "SESSION_AUTH",
      "STAGING_INTEGRATED_COMPOSITION",
    ]);
    assert.equal(candidate.releaseScopeCoverage.filter((row) => row.requiredByReleaseScope && !row.artifactIncluded).length, 3);
    assert.equal(candidate.acceptanceResult, "INCOMPLETE");
  });
});

async function materialize(distRoot: string, generatedAt = "2026-09-11T00:00:00.000Z") {
  return materializeRel001StagingCandidate({
    distRoot,
    sourceCommitSha: SOURCE_SHA,
    repositoryIdentity: "https://github.com/25300park/ai-mls.git",
    sourceBranch: "main",
    generatedAt,
  });
}

test("FEAT-024-A1 preserves the full REL-001 component disposition without elevating missing runtime surfaces", async () => {
  await withFixture(fixtureFiles(), async (distRoot) => {
    const candidate = await materialize(distRoot);

    for (const row of candidate.releaseScopeCoverage) {
      assert.match(row.implementationRuntimeEvidenceRef, /^[a-z0-9_./~#-]+$/i);
    }
    assert.deepEqual(candidate.releaseScopeCoverage.map((row) => [
      row.artifactComponentId,
      row.requiredByReleaseScope,
      row.executableRuntimeAvailable,
      row.artifactIncluded,
      row.gapDisposition,
    ]), [
      ["API-015_ADMINISTRATION_HTTP", true, true, true, "INCLUDED"],
      ["ADMIN_CONSOLE", true, false, false, "INCOMPLETE_RUNTIME_SURFACE"],
      ["CORE_APIS_FEAT_001_011", true, false, false, "INCOMPLETE_RUNTIME_SURFACE"],
      ["AUDIT_API_016", true, false, false, "INCOMPLETE_RUNTIME_SURFACE"],
      ["JOBS_API_017", true, false, false, "INCOMPLETE_RUNTIME_SURFACE"],
      ["AI_ADVISORY_FEAT_022", true, false, false, "INCOMPLETE_RUNTIME_SURFACE"],
      ["PUBLICATION_API_014", false, true, false, "OUT_OF_SCOPE"],
      ["CONNECTOR_API_018_019", false, true, false, "OUT_OF_SCOPE"],
    ]);
  });
});

test("FEAT-024-A1 returns INCOMPLETE and never shrinks REL-001 to its executable subset", async () => {
  await withFixture(fixtureFiles(), async (distRoot) => {
    const candidate = await materialize(distRoot);

    assert.equal(candidate.acceptanceResult, "INCOMPLETE");
    assert.equal(candidate.releaseScopeCoverage.filter((row) => row.requiredByReleaseScope).length, 6);
    assert.equal(candidate.releaseScopeCoverage.filter((row) => row.gapDisposition === "INCOMPLETE_RUNTIME_SURFACE").length, 5);
    assert.equal(candidate.artifactManifest.runtimeComponents.length, 1);
  });
});

test("REL-001 Phase 7 computes each component from only its reachable runtime closure", async () => {
  await withFixture(fixtureFiles(), async (distRoot) => {
    const candidate = await materialize(distRoot);

    const api015 = candidate.artifactManifest.runtimeComponents.find((component) => component.artifactComponentId === "API-015_ADMINISTRATION_HTTP");
    assert.deepEqual(api015?.includedFiles.map((file) => file.path), [
      "apps/api/src/administration-production-composition.js",
      "apps/api/src/runtime-config.json",
      "modules/administration/src/runtime.js",
      "modules/authorization/src/runtime.js",
    ]);
    assert.equal(api015?.includedFiles.some((file) => file.path.includes("admin-console")), false);
    assert.equal(api015?.includedFiles.some((file) => file.path.includes("audit-log")), false);
    assert.equal(api015?.includedFiles.some((file) => file.path.includes("job-service")), false);
  });
});

test("REL-001 Phase 7 preserves the dedicated API-015 artifact root", async () => {
  const candidate = await materializeRel001StagingCandidate({
    distRoot: "dist",
    sourceCommitSha: SOURCE_SHA,
    repositoryIdentity: "https://github.com/25300park/ai-mls.git",
    sourceBranch: "main",
    generatedAt: "2026-09-11T00:00:00.000Z",
  });
  const included = candidate.artifactManifest.includedFilePaths;

  assert.equal(candidate.artifactManifest.runtimeComponents.find((component) => component.artifactComponentId === "API-015_ADMINISTRATION_HTTP")?.runtimeEntryPoint, "apps/api/src/administration-production-composition.js");
  assert.equal(included.includes("apps/api/src/composition.js"), false);
  assert.equal(included.includes("apps/api/src/publication-api.js"), false);
  assert.equal(included.includes("apps/api/src/admin-audit-api.js"), false);
  assert.equal(included.includes("apps/api/src/job-api.js"), false);
  assert.equal(included.includes("apps/api/src/identity-api.js"), false);
});

test("FEAT-024-A1 rejects missing, escaping, or secret-bearing runtime dependencies", async (context) => {
  await context.test("missing import", async () => {
    await withFixture({ ...phase7FixtureFiles(), "apps/api/src/administration-production-composition.js": 'import "./missing.js";' }, async (distRoot) => {
      await assert.rejects(() => materialize(distRoot), /runtime dependency is missing/i);
    });
  });
  await context.test("path escape", async () => {
    await withFixture({ ...phase7FixtureFiles(), "apps/api/src/administration-production-composition.js": 'import "../../../../outside.js";' }, async (distRoot) => {
      await assert.rejects(() => materialize(distRoot), /escapes dist root/i);
    });
  });
  await context.test("secret config", async () => {
    await withFixture({
      ...phase7FixtureFiles(),
      "apps/api/src/administration-production-composition.js": 'import configuration from "./runtime-config.json" with { type: "json" };',
      "apps/api/src/runtime-config.json": '{"mode":"staging","apiKey":"sk-live-not-allowed"}',
    }, async (distRoot) => {
      await assert.rejects(() => materialize(distRoot), /unsafe runtime configuration/i);
    });
  });
});

test("FEAT-024-A1 fingerprints are deterministic, temporal-independent, and byte-sensitive", async () => {
  let first: Awaited<ReturnType<typeof materializeRel001StagingCandidate>> | undefined;
  let second: Awaited<ReturnType<typeof materializeRel001StagingCandidate>> | undefined;
  let changed: Awaited<ReturnType<typeof materializeRel001StagingCandidate>> | undefined;

  await withFixture(fixtureFiles(), async (distRoot) => {
    first = await materialize(distRoot, "2026-09-11T00:00:00.000Z");
    second = await materialize(distRoot, "2026-09-12T00:00:00.000Z");
  });
  await withFixture(fixtureFiles("changed"), async (distRoot) => {
    changed = await materialize(distRoot, "2026-09-11T00:00:00.000Z");
  });

  assert.ok(first && second && changed);
  assert.equal(first.artifactManifest.artifactFingerprint, second.artifactManifest.artifactFingerprint);
  assert.equal(first.releaseCandidateId, second.releaseCandidateId);
  assert.equal(first.candidateFingerprint, second.candidateFingerprint);
  assert.notEqual(first.artifactManifest.artifactFingerprint, changed.artifactManifest.artifactFingerprint);
  assert.notEqual(first.releaseCandidateId, changed.releaseCandidateId);
  assert.match(first.artifactManifest.artifactFingerprint, /^[a-f0-9]{64}$/);
  assert.match(first.releaseCandidateId, /^[a-f0-9]{64}$/);
});
