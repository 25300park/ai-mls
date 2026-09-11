import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { materializeRel001StagingCandidate } from "./release-candidate-artifact.js";

const SOURCE_SHA = "7e9747a50c643152532e06fb443bbb1b5d945350";

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
    assert.deepEqual(candidate.artifactManifest.runtimeComponents.map((component) => component.artifactComponentId), ["API-015_ADMINISTRATION_HTTP"]);
  });
});

test("FEAT-024-A1 includes only the reachable API-015 runtime closure", async () => {
  await withFixture(fixtureFiles(), async (distRoot) => {
    const candidate = await materialize(distRoot);

    assert.deepEqual(candidate.artifactManifest.includedFilePaths, [
      "apps/api/src/administration-production-composition.js",
      "apps/api/src/runtime-config.json",
      "modules/administration/src/runtime.js",
      "modules/authorization/src/runtime.js",
    ]);
    assert.equal(candidate.artifactManifest.includedFilePaths.some((path) => path.includes("admin-console")), false);
    assert.equal(candidate.artifactManifest.includedFilePaths.some((path) => path.includes("audit-log")), false);
    assert.equal(candidate.artifactManifest.includedFilePaths.some((path) => path.includes("job-service")), false);
  });
});

test("FEAT-024-A uses the dedicated API-015 artifact root without unrelated API composition roots", async () => {
  const candidate = await materializeRel001StagingCandidate({
    distRoot: "dist",
    sourceCommitSha: SOURCE_SHA,
    repositoryIdentity: "https://github.com/25300park/ai-mls.git",
    sourceBranch: "main",
    generatedAt: "2026-09-11T00:00:00.000Z",
  });
  const included = candidate.artifactManifest.includedFilePaths;

  assert.equal(candidate.artifactManifest.runtimeComponents[0]?.runtimeEntryPoint, "apps/api/src/administration-production-composition.js");
  assert.equal(included.includes("apps/api/src/composition.js"), false);
  assert.equal(included.includes("apps/api/src/publication-api.js"), false);
  assert.equal(included.includes("apps/api/src/admin-audit-api.js"), false);
  assert.equal(included.includes("apps/api/src/job-api.js"), false);
  assert.equal(included.includes("apps/api/src/identity-api.js"), false);
});

test("FEAT-024-A1 rejects missing, escaping, or secret-bearing runtime dependencies", async (context) => {
  await context.test("missing import", async () => {
    await withFixture({ "apps/api/src/administration-production-composition.js": 'import "./missing.js";' }, async (distRoot) => {
      await assert.rejects(() => materialize(distRoot), /runtime dependency is missing/i);
    });
  });
  await context.test("path escape", async () => {
    await withFixture({ "apps/api/src/administration-production-composition.js": 'import "../../../../outside.js";' }, async (distRoot) => {
      await assert.rejects(() => materialize(distRoot), /escapes dist root/i);
    });
  });
  await context.test("secret config", async () => {
    await withFixture({
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
