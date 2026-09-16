import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";

export type ReleaseScopeGapDisposition = "INCLUDED" | "INCOMPLETE_RUNTIME_SURFACE" | "OUT_OF_SCOPE";

export interface ReleaseScopeCoverageEvidence {
  readonly artifactComponentId: string;
  readonly requiredByReleaseScope: boolean;
  readonly executableRuntimeAvailable: boolean;
  readonly artifactIncluded: boolean;
  readonly implementationRuntimeEvidenceRef: string;
  readonly gapDisposition: ReleaseScopeGapDisposition;
}

export interface RuntimeArtifactFile {
  readonly path: string;
  readonly fileSize: number;
  readonly fileSha256: string;
}

export interface RuntimeArtifactComponent {
  readonly artifactComponentId: Rel001RuntimeArtifactComponentId;
  readonly runtimeEntryPoint: string;
  readonly includedFiles: readonly RuntimeArtifactFile[];
  readonly componentFingerprint: string;
}

export type Rel001RuntimeArtifactComponentId =
  | "ADMIN_CONSOLE_STAGING"
  | "API-015_ADMINISTRATION_HTTP"
  | "API-016_AUDIT_RUNTIME"
  | "API-017_JOB_RUNTIME"
  | "CORE_CLIENT_REQUIREMENT_STORE"
  | "CORE_CONTACT_STORE"
  | "CORE_API_001_002_HTTP"
  | "CORE_INTAKE_STORE"
  | "CORE_LISTING_STORE"
  | "CORE_MATCHING_STORE"
  | "CORE_PROPERTY_STORE"
  | "CORE_SOURCE_REGISTRY_STORE"
  | "FEAT-022_ADVISORY_DURABLE_RUNTIME"
  | "FEAT-022_PROVIDER_INDEPENDENT"
  | "OPERATIONAL_EVIDENCE_STORE"
  | "OPERATIONAL_READINESS_EVIDENCE"
  | "OPERATIONAL_SECURITY_CONTROLS"
  | "SESSION_AUTH"
  | "STAGING_INTEGRATED_COMPOSITION";

export interface RuntimeArtifactManifest {
  readonly artifactManifestVersion: "1";
  readonly logicalReleaseId: "REL-001";
  readonly targetEnvironment: "Staging";
  readonly sourceCommitSha: string;
  readonly repositoryIdentity: string;
  readonly runtimeComponents: readonly RuntimeArtifactComponent[];
  readonly includedFilePaths: readonly string[];
  readonly excludedClassPolicy: readonly string[];
  readonly artifactFingerprint: string;
  readonly generatedAt: string;
}

export interface Rel001StagingCandidateInput {
  readonly distRoot: string;
  readonly sourceCommitSha: string;
  readonly repositoryIdentity: string;
  readonly sourceBranch: string;
  readonly generatedAt: string;
}

export interface Rel001StagingCandidate {
  readonly releaseCandidateId: string;
  readonly logicalReleaseId: "REL-001";
  readonly sourceCommitSha: string;
  readonly repositoryIdentity: string;
  readonly sourceBranch: string;
  readonly artifactFingerprint: string;
  readonly targetEnvironment: "Staging";
  readonly generatedAt: string;
  readonly candidateFingerprint: string;
  readonly acceptanceResult: "INCOMPLETE";
  readonly releaseScopeCoverage: readonly ReleaseScopeCoverageEvidence[];
  readonly artifactManifest: RuntimeArtifactManifest;
}

const RUNTIME_COMPONENT_ROOTS: Readonly<Partial<Record<Rel001RuntimeArtifactComponentId, string>>> = Object.freeze({
  ADMIN_CONSOLE_STAGING: "apps/api/src/staging-admin-console-bootstrap.js",
  "API-015_ADMINISTRATION_HTTP": "apps/api/src/administration-production-composition.js",
  "API-016_AUDIT_RUNTIME": "apps/api/src/api016-production-composition.js",
  "API-017_JOB_RUNTIME": "modules/jobs/src/job-staging-composition.js",
  CORE_CLIENT_REQUIREMENT_STORE: "modules/client/src/client-requirement-durable-persistence.js",
  CORE_CONTACT_STORE: "modules/contact/src/contact-durable-persistence.js",
  CORE_INTAKE_STORE: "modules/intake/src/intake-durable-persistence.js",
  CORE_LISTING_STORE: "modules/listing/src/listing-durable-persistence.js",
  CORE_MATCHING_STORE: "modules/matching/src/matching-durable-persistence.js",
  CORE_PROPERTY_STORE: "modules/property/src/property-durable-persistence.js",
  CORE_SOURCE_REGISTRY_STORE: "modules/source/src/source-registry-durable-persistence.js",
  "FEAT-022_ADVISORY_DURABLE_RUNTIME": "modules/ai/src/advisory-production-composition.js",
  "FEAT-022_PROVIDER_INDEPENDENT": "modules/ai/src/advisory-readiness-composition.js",
  OPERATIONAL_EVIDENCE_STORE: "modules/operations/src/durable-operational-evidence-store.js",
  OPERATIONAL_READINESS_EVIDENCE: "modules/operations/src/operational-readiness-evidence.js",
  OPERATIONAL_SECURITY_CONTROLS: "modules/operations/src/security-privacy-operational-controls.js",
  SESSION_AUTH: "apps/api/src/staging-session-composition.js",
  STAGING_INTEGRATED_COMPOSITION: "apps/api/src/staging-integrated-runtime-verification.js",
});
const LEGACY_RUNTIME_COMPONENT_ROOTS: Readonly<Partial<Record<Rel001RuntimeArtifactComponentId, string>>> = Object.freeze({
  "API-015_ADMINISTRATION_HTTP": "apps/api/src/administration-production-composition.js",
});
const PHASE7_SOURCE_COMMIT_SHA = "cd620b273c8e7672ffc1e015380ce36d486d9a9a";
const BLOCKER1C_SOURCE_COMMIT_SHA = "97a3522fb301fea197d3fa2defc7bc2826c2d719";
const BLOCKER2C_SOURCE_COMMIT_SHA = "b7d2a864b8dbed9c6b1f0c7874481035159af886";
const BLOCKER1C_RUNTIME_COMPONENT_ROOTS: Readonly<Partial<Record<Rel001RuntimeArtifactComponentId, string>>> = Object.freeze({
  ...RUNTIME_COMPONENT_ROOTS,
  CORE_API_001_002_HTTP: "apps/api/src/core-identity-authorization-composition.js",
});
const REPOSITORY_IDENTITY = "https://github.com/25300park/ai-mls.git" as const;
const RUNTIME_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".json"]);
const EXCLUDED_PATH = /(?:^|\/)(?:tests?|__tests__|fixtures?|mocks?|coverage|docs?|reviews?|reports?|logs?|temp|tmp|cache|backups?)(?:\/|$)|\.(?:test|spec)\.[^.]+$|\.map$|\.d\.ts$|\.tsbuildinfo$|\.(?:ts|tsx)$/i;
const IMPORT_SPECIFIER = /\b(?:import|export)\s+(?:[^"'()\r\n]*?\s+from\s+)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const SECRET_KEY = /(?:secret|token|password|credential|authorization|api.?key|private.?key|access.?key)/i;
const SECRET_VALUE = /(?:\bBearer\s+[A-Za-z0-9._~+\/-]+=*|-----BEGIN [A-Z ]+PRIVATE KEY-----|\b(?:sk|ghp|github_pat)_[A-Za-z0-9_-]{8,})/i;
const SAFE_SOURCE_BRANCH = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,254}$/u;
const UNSAFE_SOURCE_BRANCH_VALUE = /(?:^|[/._-])(?:sk|ghp|github_pat)[_-][A-Za-z0-9_-]{8,}|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\d(?:[ ().-]*\d){6,}|chain[-_ ]?of[-_ ]?thought|stack[-_ ]?trace|sqlite_(?:error|constraint|busy|corrupt)|\bBearer\s+/iu;

const EXCLUDED_CLASS_POLICY = Object.freeze([
  "test/spec/fixture/mock output",
  "source map and TypeScript declaration metadata",
  "TypeScript source and build metadata",
  "documentation, reports, logs, temp, cache, and backups",
  "local databases, environment values, credentials, and secrets",
  "unreachable dist output",
]);

const PHASE7_RELEASE_SCOPE_COVERAGE: readonly ReleaseScopeCoverageEvidence[] = deepFreeze([
  coverage("API-015_ADMINISTRATION_HTTP", true, true, true, "apps/api/src/administration-production-composition.ts#composeProductionAdministrationApi015NodeHttpServer", "INCLUDED"),
  coverage("ADMIN_CONSOLE_STAGING", true, true, true, "apps/api/src/staging-admin-console-bootstrap.ts#createStagingAdminConsoleBootstrap", "INCLUDED"),
  coverage("CORE_DURABLE_STORES", true, true, true, "docs/implementation/REL001_PHASE1G_PERSISTENCE_TRACEABILITY_MATRIX.md", "INCLUDED"),
  coverage("AUDIT_API_016", true, true, true, "apps/api/src/api016-production-composition.ts#createStagingApi016AuditRuntime", "INCLUDED"),
  coverage("JOBS_API_017", true, true, true, "modules/jobs/src/job-staging-composition.ts#createStagingJobExecutionRuntime", "INCLUDED"),
  coverage("AI_ADVISORY_PROVIDER_INDEPENDENT", true, true, true, "modules/ai/src/advisory-readiness-composition.ts#composeAdvisoryProviderReadiness", "INCLUDED"),
  coverage("SESSION_AUTH", true, true, true, "apps/api/src/staging-session-composition.ts#createStagingSessionComposition", "INCLUDED"),
  coverage("STAGING_INTEGRATED_COMPOSITION", true, true, true, "apps/api/src/staging-integrated-runtime-verification.ts#createIntegratedStagingRuntimeVerification", "INCLUDED"),
  coverage("OPERATIONAL_SECURITY_READINESS", true, true, true, "modules/operations/src/security-privacy-operational-controls.ts#SecurityPrivacyOperationalControlService", "INCLUDED"),
  coverage("LIVE_AI_PROVIDER_EXECUTION", true, false, false, "docs/implementation/REL001_PHASE4D8_EXTERNAL_PROVIDER_DEPENDENCY_HOLD.md", "INCOMPLETE_RUNTIME_SURFACE"),
  coverage("CORE_API_001_002_PUBLIC_TRANSPORT", true, false, false, "docs/implementation/REL001_PHASE6_COMPONENT_RUNTIME_TRACEABILITY.md", "INCOMPLETE_RUNTIME_SURFACE"),
  coverage("UI_006_CORE_DATA", true, false, false, "docs/implementation/REL001_PHASE5_ADMIN_CONSOLE_FINAL_TRACEABILITY_MATRIX.md", "INCOMPLETE_RUNTIME_SURFACE"),
  coverage("PUBLICATION_API_014", false, true, false, "apps/api/src/composition.ts#composeProductionPublicationApi014NodeHttpServer", "OUT_OF_SCOPE"),
  coverage("CONNECTOR_API_018_019", false, true, false, "apps/api/src/connector-production-composition.ts#createProductionConnectorApi018Composition", "OUT_OF_SCOPE"),
]);
const BLOCKER1C_RELEASE_SCOPE_COVERAGE: readonly ReleaseScopeCoverageEvidence[] = deepFreeze([
  ...PHASE7_RELEASE_SCOPE_COVERAGE.map((row) => row.artifactComponentId === "CORE_API_001_002_PUBLIC_TRANSPORT"
    ? coverage("CORE_API_001_002_PUBLIC_TRANSPORT", true, true, true, "apps/api/src/core-identity-authorization-composition.ts#composeCoreApi001002NodeHttpServer", "INCLUDED")
    : row),
]);
const BLOCKER2C_RELEASE_SCOPE_COVERAGE: readonly ReleaseScopeCoverageEvidence[] = deepFreeze([
  ...BLOCKER1C_RELEASE_SCOPE_COVERAGE.map((row) => row.artifactComponentId === "UI_006_CORE_DATA"
    ? coverage("UI_006_CORE_DATA", true, true, true, "apps/admin-console/src/core-identity-console-read-adapter.ts#CoreIdentityConsoleReadAdapter", "INCLUDED")
    : row),
]);
const LEGACY_RELEASE_SCOPE_COVERAGE: readonly ReleaseScopeCoverageEvidence[] = deepFreeze([
  coverage("API-015_ADMINISTRATION_HTTP", true, true, true, "apps/api/src/administration-production-composition.ts#composeProductionAdministrationApi015NodeHttpServer", "INCLUDED"),
  coverage("ADMIN_CONSOLE", true, false, false, "apps/admin-console/src/main.ts#composeDevelopmentAdminConsole", "INCOMPLETE_RUNTIME_SURFACE"),
  coverage("CORE_APIS_FEAT_001_011", true, false, false, "apps/api/src/composition.ts#composeApiModules", "INCOMPLETE_RUNTIME_SURFACE"),
  coverage("AUDIT_API_016", true, false, false, "modules/audit/src/audit-log.ts#AuditLog", "INCOMPLETE_RUNTIME_SURFACE"),
  coverage("JOBS_API_017", true, false, false, "modules/jobs/src/job-service.ts#JobService", "INCOMPLETE_RUNTIME_SURFACE"),
  coverage("AI_ADVISORY_FEAT_022", true, false, false, "modules/ai/src/advisory-production-composition.ts#createProductionAdvisoryRuntime", "INCOMPLETE_RUNTIME_SURFACE"),
  coverage("PUBLICATION_API_014", false, true, false, "apps/api/src/composition.ts#composeProductionPublicationApi014NodeHttpServer", "OUT_OF_SCOPE"),
  coverage("CONNECTOR_API_018_019", false, true, false, "apps/api/src/connector-production-composition.ts#createProductionConnectorApi018Composition", "OUT_OF_SCOPE"),
]);

export async function materializeRel001StagingCandidate(input: Rel001StagingCandidateInput): Promise<Rel001StagingCandidate> {
  validateCandidateInput(input);
  const definition = candidateDefinition(input.sourceCommitSha);
  const runtimeComponents = await Promise.all(Object.entries(definition.roots)
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(async ([artifactComponentId, runtimeEntryPoint]): Promise<RuntimeArtifactComponent> => {
      const includedFiles = await deriveRuntimeClosure(input.distRoot, runtimeEntryPoint);
      const componentFingerprint = fingerprintFiles(includedFiles);
      return deepFreeze({ artifactComponentId: artifactComponentId as Rel001RuntimeArtifactComponentId, runtimeEntryPoint, includedFiles, componentFingerprint });
    }));
  const includedFilePaths = [...new Set(runtimeComponents.flatMap((component) => component.includedFiles.map((file) => file.path)))]
    .sort((left, right) => left.localeCompare(right, "en"));
  const artifactFingerprint = fingerprintArtifact(input.sourceCommitSha, runtimeComponents);
  const releaseCandidateId = sha256(["REL-001", input.sourceCommitSha, input.repositoryIdentity, input.sourceBranch, artifactFingerprint, "Staging"].join("\0"));
  const candidateFingerprint = sha256([releaseCandidateId, "REL-001", input.sourceCommitSha, input.repositoryIdentity, input.sourceBranch, artifactFingerprint, "Staging"].join("\0"));
  const artifactManifest = deepFreeze({
    artifactManifestVersion: "1" as const,
    logicalReleaseId: "REL-001" as const,
    targetEnvironment: "Staging" as const,
    sourceCommitSha: input.sourceCommitSha,
    repositoryIdentity: input.repositoryIdentity,
    runtimeComponents,
    includedFilePaths,
    excludedClassPolicy: EXCLUDED_CLASS_POLICY,
    artifactFingerprint,
    generatedAt: input.generatedAt,
  });
  const candidate = deepFreeze({
    releaseCandidateId,
    logicalReleaseId: "REL-001" as const,
    sourceCommitSha: input.sourceCommitSha,
    repositoryIdentity: input.repositoryIdentity,
    sourceBranch: input.sourceBranch,
    artifactFingerprint,
    targetEnvironment: "Staging" as const,
    generatedAt: input.generatedAt,
    candidateFingerprint,
    acceptanceResult: "INCOMPLETE" as const,
    releaseScopeCoverage: definition.coverage,
    artifactManifest,
  });
  assertRel001StagingCandidateIntegrity(candidate);
  return candidate;
}

export function assertRel001StagingCandidateIntegrity(candidate: Rel001StagingCandidate): void {
  assertRel001StagingCandidateArtifactIntegrity(candidate);
  if (!sameCanonicalRows(candidate.releaseScopeCoverage, candidateDefinition(candidate.sourceCommitSha).coverage)) invalidCandidate();
}

export function assertRel001StagingCandidateArtifactIntegrity(candidate: Rel001StagingCandidate): void {
  const artifact = candidate.artifactManifest;
  if (candidate.repositoryIdentity !== REPOSITORY_IDENTITY || !isSafeSourceBranch(candidate.sourceBranch)) invalidCandidate();
  const expectedComponents = Object.entries(candidateDefinition(candidate.sourceCommitSha).roots).sort(([left], [right]) => left.localeCompare(right, "en"));
  if (artifact.runtimeComponents.length !== expectedComponents.length) invalidCandidate();
  for (const [index, component] of artifact.runtimeComponents.entries()) {
    const expected = expectedComponents[index]!;
    const includedPaths = component.includedFiles.map((file) => file.path);
    if (component.artifactComponentId !== expected[0]
      || component.runtimeEntryPoint !== expected[1]
      || component.includedFiles.length === 0
      || component.componentFingerprint !== fingerprintFiles(component.includedFiles)
      || new Set(includedPaths).size !== includedPaths.length
      || includedPaths.some((path, pathIndex) => pathIndex > 0 && includedPaths[pathIndex - 1]!.localeCompare(path, "en") >= 0)) invalidCandidate();
  }
  const includedPaths = [...new Set(artifact.runtimeComponents.flatMap((component) => component.includedFiles.map((file) => file.path)))]
    .sort((left, right) => left.localeCompare(right, "en"));
  if (!sameOrderedValues(artifact.includedFilePaths, includedPaths)) invalidCandidate();

  const artifactFingerprint = fingerprintArtifact(candidate.sourceCommitSha, artifact.runtimeComponents);
  const releaseCandidateId = sha256(["REL-001", candidate.sourceCommitSha, candidate.repositoryIdentity, candidate.sourceBranch, artifactFingerprint, "Staging"].join("\0"));
  const candidateFingerprint = sha256([releaseCandidateId, "REL-001", candidate.sourceCommitSha, candidate.repositoryIdentity, candidate.sourceBranch, artifactFingerprint, "Staging"].join("\0"));

  if (candidate.artifactFingerprint !== artifactFingerprint
    || artifact.artifactFingerprint !== artifactFingerprint
    || candidate.releaseCandidateId !== releaseCandidateId
    || candidate.candidateFingerprint !== candidateFingerprint
    || !sameOrderedValues(artifact.excludedClassPolicy, EXCLUDED_CLASS_POLICY)) invalidCandidate();
}

function candidateDefinition(sourceCommitSha: string): Readonly<{
  roots: Readonly<Partial<Record<Rel001RuntimeArtifactComponentId, string>>>;
  coverage: readonly ReleaseScopeCoverageEvidence[];
}> {
  if (sourceCommitSha === BLOCKER2C_SOURCE_COMMIT_SHA) {
    return { roots: BLOCKER1C_RUNTIME_COMPONENT_ROOTS, coverage: BLOCKER2C_RELEASE_SCOPE_COVERAGE };
  }
  if (sourceCommitSha === BLOCKER1C_SOURCE_COMMIT_SHA) {
    return { roots: BLOCKER1C_RUNTIME_COMPONENT_ROOTS, coverage: BLOCKER1C_RELEASE_SCOPE_COVERAGE };
  }
  if (sourceCommitSha === PHASE7_SOURCE_COMMIT_SHA) {
    return { roots: RUNTIME_COMPONENT_ROOTS, coverage: PHASE7_RELEASE_SCOPE_COVERAGE };
  }
  return { roots: LEGACY_RUNTIME_COMPONENT_ROOTS, coverage: LEGACY_RELEASE_SCOPE_COVERAGE };
}

function fingerprintFiles(files: readonly RuntimeArtifactFile[]): string {
  return sha256(files.map((file) => `${file.path}\0${file.fileSha256}\0${file.fileSize}`).join("\n"));
}

function fingerprintArtifact(sourceCommitSha: string, components: readonly RuntimeArtifactComponent[]): string {
  return sha256(["REL-001", "Staging", sourceCommitSha, ...components.map((component) => `${component.artifactComponentId}:${component.componentFingerprint}`)].join("\0"));
}

function coverage(
  artifactComponentId: string,
  requiredByReleaseScope: boolean,
  executableRuntimeAvailable: boolean,
  artifactIncluded: boolean,
  implementationRuntimeEvidenceRef: string,
  gapDisposition: ReleaseScopeGapDisposition,
): ReleaseScopeCoverageEvidence {
  return { artifactComponentId, requiredByReleaseScope, executableRuntimeAvailable, artifactIncluded, implementationRuntimeEvidenceRef, gapDisposition };
}

async function deriveRuntimeClosure(distRootInput: string, entryPoint: string): Promise<readonly RuntimeArtifactFile[]> {
  const distRoot = resolve(distRootInput);
  const pending = [entryPoint];
  const visited = new Set<string>();
  const records: RuntimeArtifactFile[] = [];

  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined || visited.has(current)) continue;
    visited.add(current);
    assertAllowedRuntimePath(current);
    const absolutePath = withinDistRoot(distRoot, current);
    let contents: Buffer;
    try {
      contents = await readFile(absolutePath);
      await stat(absolutePath);
    } catch {
      throw new Error(`Runtime dependency is missing: ${current}`);
    }
    if (extname(current).toLowerCase() === ".json") assertSafeRuntimeConfiguration(current, contents);
    records.push({ path: current, fileSize: contents.byteLength, fileSha256: sha256(contents) });

    if ([".js", ".mjs", ".cjs"].includes(extname(current).toLowerCase())) {
      const source = contents.toString("utf8");
      for (const specifier of importSpecifiers(source)) {
        if (!specifier.startsWith(".")) continue;
        const dependencyAbsolute = resolve(dirname(absolutePath), specifier);
        const dependencyRelative = normalizeRelativePath(distRoot, dependencyAbsolute);
        pending.push(dependencyRelative);
      }
    }
  }
  records.sort((left, right) => left.path.localeCompare(right.path, "en"));
  return deepFreeze(records);
}

function importSpecifiers(source: string): readonly string[] {
  const specifiers: string[] = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER)) {
    const specifier = match[1] ?? match[2];
    if (specifier !== undefined) specifiers.push(specifier);
  }
  return specifiers;
}

function withinDistRoot(distRoot: string, relativePath: string): string {
  const absolutePath = resolve(distRoot, ...relativePath.split("/"));
  normalizeRelativePath(distRoot, absolutePath);
  return absolutePath;
}

function normalizeRelativePath(distRoot: string, absolutePath: string): string {
  const candidate = relative(distRoot, absolutePath);
  if (candidate === "" || candidate === ".." || candidate.startsWith(`..${sep}`) || isAbsolute(candidate)) {
    throw new Error("Runtime dependency escapes dist root.");
  }
  return candidate.split(sep).join("/");
}

function assertAllowedRuntimePath(relativePath: string): void {
  if (EXCLUDED_PATH.test(relativePath) || !RUNTIME_EXTENSIONS.has(extname(relativePath).toLowerCase())) {
    throw new Error(`Excluded output cannot be a runtime dependency: ${relativePath}`);
  }
}

function assertSafeRuntimeConfiguration(path: string, contents: Buffer): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents.toString("utf8"));
  } catch {
    throw new Error(`Unsafe runtime configuration: ${path}`);
  }
  const inspect = (value: unknown, key = ""): void => {
    if (SECRET_KEY.test(key)) throw new Error(`Unsafe runtime configuration: ${path}`);
    if (typeof value === "string" && SECRET_VALUE.test(value)) throw new Error(`Unsafe runtime configuration: ${path}`);
    if (Array.isArray(value)) value.forEach((entry) => inspect(entry));
    else if (value !== null && typeof value === "object") {
      for (const [childKey, childValue] of Object.entries(value)) inspect(childValue, childKey);
    }
  };
  inspect(parsed);
}

function validateCandidateInput(input: Rel001StagingCandidateInput): void {
  if (!/^[a-f0-9]{40}$/.test(input.sourceCommitSha)) throw new TypeError("Exact source commit SHA is required.");
  if (input.repositoryIdentity !== REPOSITORY_IDENTITY || !isSafeSourceBranch(input.sourceBranch)) throw new TypeError("Repository and branch identity are invalid.");
  if (!Number.isFinite(Date.parse(input.generatedAt))) throw new TypeError("A valid generatedAt timestamp is required.");
}

function isSafeSourceBranch(value: string): boolean {
  return SAFE_SOURCE_BRANCH.test(value)
    && !value.includes("..")
    && !value.includes("//")
    && !value.endsWith("/")
    && !value.endsWith(".")
    && !value.endsWith(".lock")
    && !UNSAFE_SOURCE_BRANCH_VALUE.test(value);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function sameOrderedValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameCanonicalRows(left: readonly ReleaseScopeCoverageEvidence[], right: readonly ReleaseScopeCoverageEvidence[]): boolean {
  return left.length === right.length && left.every((value, index) => {
    const expected = right[index]!;
    return value.artifactComponentId === expected.artifactComponentId
      && value.requiredByReleaseScope === expected.requiredByReleaseScope
      && value.executableRuntimeAvailable === expected.executableRuntimeAvailable
      && value.artifactIncluded === expected.artifactIncluded
      && value.implementationRuntimeEvidenceRef === expected.implementationRuntimeEvidenceRef
      && value.gapDisposition === expected.gapDisposition;
  });
}

function invalidCandidate(): never {
  throw new TypeError("REL-001 candidate integrity is invalid.");
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
