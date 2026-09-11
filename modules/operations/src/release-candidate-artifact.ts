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
  readonly artifactComponentId: "API-015_ADMINISTRATION_HTTP";
  readonly runtimeEntryPoint: "apps/api/src/administration-production-composition.js";
  readonly includedFiles: readonly RuntimeArtifactFile[];
  readonly componentFingerprint: string;
}

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

const RUNTIME_ENTRY_POINT = "apps/api/src/administration-production-composition.js" as const;
const RUNTIME_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".json"]);
const EXCLUDED_PATH = /(?:^|\/)(?:tests?|__tests__|fixtures?|mocks?|coverage|docs?|reviews?|reports?|logs?|temp|tmp|cache|backups?)(?:\/|$)|\.(?:test|spec)\.[^.]+$|\.map$|\.d\.ts$|\.tsbuildinfo$|\.(?:ts|tsx)$/i;
const IMPORT_SPECIFIER = /\b(?:import|export)\s+(?:[^"'()\r\n]*?\s+from\s+)?["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
const SECRET_KEY = /(?:secret|token|password|credential|authorization|api.?key|private.?key|access.?key)/i;
const SECRET_VALUE = /(?:\bBearer\s+[A-Za-z0-9._~+\/-]+=*|-----BEGIN [A-Z ]+PRIVATE KEY-----|\b(?:sk|ghp|github_pat)_[A-Za-z0-9_-]{8,})/i;

const EXCLUDED_CLASS_POLICY = Object.freeze([
  "test/spec/fixture/mock output",
  "source map and TypeScript declaration metadata",
  "TypeScript source and build metadata",
  "documentation, reports, logs, temp, cache, and backups",
  "local databases, environment values, credentials, and secrets",
  "unreachable dist output",
]);

const RELEASE_SCOPE_COVERAGE: readonly ReleaseScopeCoverageEvidence[] = deepFreeze([
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
  const files = await deriveRuntimeClosure(input.distRoot, RUNTIME_ENTRY_POINT);
  const componentFingerprint = sha256(files.map((file) => `${file.path}\0${file.fileSha256}\0${file.fileSize}`).join("\n"));
  const runtimeComponent = deepFreeze({
    artifactComponentId: "API-015_ADMINISTRATION_HTTP" as const,
    runtimeEntryPoint: RUNTIME_ENTRY_POINT,
    includedFiles: files,
    componentFingerprint,
  });
  const artifactFingerprint = sha256(["REL-001", "Staging", input.sourceCommitSha, `API-015_ADMINISTRATION_HTTP:${componentFingerprint}`].join("\0"));
  const releaseCandidateId = sha256(["REL-001", input.sourceCommitSha, input.repositoryIdentity, input.sourceBranch, artifactFingerprint, "Staging"].join("\0"));
  const candidateFingerprint = sha256([releaseCandidateId, "REL-001", input.sourceCommitSha, input.repositoryIdentity, input.sourceBranch, artifactFingerprint, "Staging"].join("\0"));
  const artifactManifest = deepFreeze({
    artifactManifestVersion: "1" as const,
    logicalReleaseId: "REL-001" as const,
    targetEnvironment: "Staging" as const,
    sourceCommitSha: input.sourceCommitSha,
    repositoryIdentity: input.repositoryIdentity,
    runtimeComponents: [runtimeComponent],
    includedFilePaths: files.map((file) => file.path),
    excludedClassPolicy: EXCLUDED_CLASS_POLICY,
    artifactFingerprint,
    generatedAt: input.generatedAt,
  });
  return deepFreeze({
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
    releaseScopeCoverage: RELEASE_SCOPE_COVERAGE,
    artifactManifest,
  });
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
  if (input.repositoryIdentity.trim() === "" || input.sourceBranch.trim() === "") throw new TypeError("Repository and branch identity are required.");
  if (!Number.isFinite(Date.parse(input.generatedAt))) throw new TypeError("A valid generatedAt timestamp is required.");
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
