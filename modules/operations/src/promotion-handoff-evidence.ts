import { createHash } from "node:crypto";
import { isSensitiveSecurityDetailKey, isUnsafeSecurityDetailValue } from "../../../packages/security-contracts/src/index.js";
import {
  assertRel001StagingCandidateArtifactIntegrity,
  type Rel001StagingCandidate,
} from "./release-candidate-artifact.js";
import type {
  ReleaseAcceptanceEvidenceRef,
  ReleaseAcceptanceManifest,
  ReleaseReadinessRef,
} from "./release-evidence-manifest.js";

export interface PromotionHandoffSourceSnapshot {
  readonly candidate: Rel001StagingCandidate;
  readonly acceptanceManifest: ReleaseAcceptanceManifest;
  readonly manifestHistory: readonly ReleaseAcceptanceManifest[];
  readonly currentReadinessRefs: readonly ReleaseReadinessRef[];
}

export interface PromotionHandoffSourceResolver {
  resolve(releaseCandidateId: string, acceptanceManifestId: string): PromotionHandoffSourceSnapshot | undefined;
}

export interface PromotionHandoffEvidenceRequest {
  readonly releaseCandidateId: string;
  readonly acceptanceManifestId: string;
}

export interface PromotionHandoffEvidence {
  readonly releaseCandidateId: string;
  readonly acceptanceManifestId: string;
  readonly manifestFingerprint: string;
  readonly logicalReleaseId: string;
  readonly sourceCommitSha: string;
  readonly artifactFingerprint: string;
  readonly targetEnvironment: string;
  readonly acceptanceResult: "ACCEPTED";
  readonly acceptedAt: string;
  readonly readinessRefs: readonly ReleaseReadinessRef[];
  readonly acceptanceActorId: string;
  readonly acceptanceAuthorityEvidenceRefs: readonly string[];
  readonly deploymentSodEvidenceRefs: readonly string[];
  readonly handoffEvidenceFingerprint: string;
}

export interface PromotionHandoffEvidenceServiceDependencies {
  readonly sourceResolver: PromotionHandoffSourceResolver;
}

const HEX_64 = /^[a-f0-9]{64}$/;
const SHA_40 = /^[a-f0-9]{40}$/;
const IDENTIFIER = /^[A-Z0-9][A-Z0-9_.:-]{0,127}$/i;
const REFERENCE = /^[A-Z0-9][A-Z0-9_.:#/-]{0,255}$/i;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX_ITEMS = 64;
const CANONICAL_RELEASE_CANDIDATE_ID = "1f8da015c5cd9e1ae79984066e31f217430a244627d5284fb1fa901e86f51ff1";
const CANONICAL_CANDIDATE_FINGERPRINT = "001b97569d2b56ae80b90f4a13b87822d156dc6fd18a75899c5681ebb15d427d";
const CANONICAL_ARTIFACT_FINGERPRINT = "a5de42d389b2aec27b4dd2a6362f442afced8414a7050c170f980fa4727547cd";
const CANONICAL_SOURCE_COMMIT_SHA = "ddc1604cae78ca3493c27a7add23446970e485ae";
const CANONICAL_REPOSITORY_IDENTITY = "https://github.com/25300park/ai-mls.git";
const CANONICAL_SOURCE_BRANCH = "codex/feat-024-a-release-candidate";
const REQUEST_KEYS = Object.freeze(["acceptanceManifestId", "releaseCandidateId"]);
const MANIFEST_KEYS = Object.freeze([
  "acceptanceManifestId", "acceptanceResult", "acceptedAt", "acceptedBy", "artifactFingerprint",
  "decisionEvidenceRef", "evaluatedAt", "evidenceRefs", "logicalReleaseId", "manifestFingerprint",
  "previousManifestId", "readinessRefs", "releaseCandidateId", "repositoryIdentity", "sourceBranch",
  "sourceCommitSha", "targetEnvironment",
].sort());
const EVIDENCE_KEYS = Object.freeze([
  "candidateBindingFingerprint", "evaluatedAt", "evidenceRef", "evidenceType", "safeResultSummary",
  "sourceCommitSha", "sourceFeatureOrRegistry",
].sort());
const READINESS_KEYS = Object.freeze([
  "candidateBindingFingerprint", "evaluatedAt", "evidenceRefs", "freshness", "readiness", "readinessRef",
  "readinessType", "releaseCandidateId", "safeReasonCodes", "targetEnvironment",
].sort());

export class PromotionHandoffEvidenceService {
  readonly #sourceResolver: PromotionHandoffSourceResolver;

  public constructor(dependencies: PromotionHandoffEvidenceServiceDependencies) {
    this.#sourceResolver = dependencies.sourceResolver;
  }

  public materialize(request: PromotionHandoffEvidenceRequest): PromotionHandoffEvidence | null {
    if (!hasExactKeys(request, REQUEST_KEYS)
      || !isHex64(request.releaseCandidateId)
      || !isHex64(request.acceptanceManifestId)) return null;

    let source: PromotionHandoffSourceSnapshot | undefined;
    try {
      source = this.#sourceResolver.resolve(request.releaseCandidateId, request.acceptanceManifestId);
    } catch {
      return null;
    }
    if (source === undefined || !this.#isValidSource(request, source)) return null;

    const manifest = source.acceptanceManifest;
    const readinessRefs = normalizeReadiness(source.currentReadinessRefs);
    if (readinessRefs === null) return null;
    const authorityRefs = evidenceRefs(manifest, "RELEASE_AUTHORITY");
    const deploymentSodRefs = evidenceRefs(manifest, "DEPLOYMENT_SOD_HANDOFF");
    if (authorityRefs.length === 0 || deploymentSodRefs.length === 0 || manifest.acceptedBy === null || manifest.acceptedAt === null) return null;

    const handoffEvidenceFingerprint = sha256(JSON.stringify([
      manifest.releaseCandidateId,
      manifest.acceptanceManifestId,
      manifest.manifestFingerprint,
      manifest.logicalReleaseId,
      manifest.sourceCommitSha,
      manifest.artifactFingerprint,
      manifest.targetEnvironment,
      readinessRefs.map((value) => readinessIdentity(value)),
    ]));

    return deepFreeze({
      releaseCandidateId: manifest.releaseCandidateId,
      acceptanceManifestId: manifest.acceptanceManifestId,
      manifestFingerprint: manifest.manifestFingerprint,
      logicalReleaseId: manifest.logicalReleaseId,
      sourceCommitSha: manifest.sourceCommitSha,
      artifactFingerprint: manifest.artifactFingerprint,
      targetEnvironment: manifest.targetEnvironment,
      acceptanceResult: "ACCEPTED" as const,
      acceptedAt: manifest.acceptedAt,
      readinessRefs,
      acceptanceActorId: manifest.acceptedBy,
      acceptanceAuthorityEvidenceRefs: authorityRefs,
      deploymentSodEvidenceRefs: deploymentSodRefs,
      handoffEvidenceFingerprint,
    });
  }

  #isValidSource(request: PromotionHandoffEvidenceRequest, source: PromotionHandoffSourceSnapshot): boolean {
    const { candidate, acceptanceManifest: manifest, manifestHistory } = source;
    if (!isCandidateEligible(candidate)
      || !isManifestShapeSafe(manifest)
      || manifest.acceptanceResult !== "ACCEPTED"
      || manifest.acceptedBy === null
      || manifest.acceptedAt === null
      || manifest.releaseCandidateId !== request.releaseCandidateId
      || manifest.acceptanceManifestId !== request.acceptanceManifestId
      || manifest.releaseCandidateId !== candidate.releaseCandidateId
      || manifest.logicalReleaseId !== candidate.logicalReleaseId
      || manifest.sourceCommitSha !== candidate.sourceCommitSha
      || manifest.repositoryIdentity !== candidate.repositoryIdentity
      || manifest.sourceBranch !== candidate.sourceBranch
      || manifest.artifactFingerprint !== candidate.artifactFingerprint
      || manifest.targetEnvironment !== candidate.targetEnvironment
      || manifest.evidenceRefs.some((item) => item.candidateBindingFingerprint !== candidate.candidateFingerprint
        || (item.sourceCommitSha !== null && item.sourceCommitSha !== candidate.sourceCommitSha))
      || manifestHistory.length === 0
      || manifestHistory.length > MAX_ITEMS) return false;

    if (!hasCanonicalManifestIdentity(candidate, manifest)
      || !isValidManifestHistory(candidate, manifestHistory, request.acceptanceManifestId)) return false;
    const authoritative = manifestHistory.find((item) => item.acceptanceManifestId === request.acceptanceManifestId);
    if (authoritative === undefined
      || canonical(authoritative) !== canonical(manifest)) return false;

    const manifestReadiness = normalizeReadiness(manifest.readinessRefs);
    const currentReadiness = normalizeReadiness(source.currentReadinessRefs);
    return manifestReadiness !== null
      && currentReadiness !== null
      && currentReadiness.length > 0
      && currentReadiness.every((item) => item.releaseCandidateId === candidate.releaseCandidateId
        && item.candidateBindingFingerprint === candidate.candidateFingerprint
        && item.targetEnvironment === candidate.targetEnvironment)
      && manifestReadiness.every((item) => item.releaseCandidateId === candidate.releaseCandidateId
        && item.candidateBindingFingerprint === candidate.candidateFingerprint
        && item.targetEnvironment === candidate.targetEnvironment)
      && currentReadiness.every((item) => item.readiness === "READY" && item.freshness === "FRESH")
      && JSON.stringify(currentReadiness.map(readinessIdentity)) === JSON.stringify(manifestReadiness.map(readinessIdentity));
  }
}

function isCandidateEligible(candidate: Rel001StagingCandidate): boolean {
  try {
    assertRel001StagingCandidateArtifactIntegrity(candidate);
  } catch {
    return false;
  }
  const artifact = candidate.artifactManifest;
  return candidate.logicalReleaseId === "REL-001"
    && candidate.targetEnvironment === "Staging"
    && candidate.releaseCandidateId === CANONICAL_RELEASE_CANDIDATE_ID
    && candidate.candidateFingerprint === CANONICAL_CANDIDATE_FINGERPRINT
    && candidate.artifactFingerprint === CANONICAL_ARTIFACT_FINGERPRINT
    && candidate.sourceCommitSha === CANONICAL_SOURCE_COMMIT_SHA
    && candidate.repositoryIdentity === CANONICAL_REPOSITORY_IDENTITY
    && candidate.sourceBranch === CANONICAL_SOURCE_BRANCH
    && isHex64(candidate.releaseCandidateId)
    && isHex64(candidate.candidateFingerprint)
    && isHex64(candidate.artifactFingerprint)
    && SHA_40.test(candidate.sourceCommitSha)
    && artifact.logicalReleaseId === candidate.logicalReleaseId
    && artifact.targetEnvironment === candidate.targetEnvironment
    && artifact.sourceCommitSha === candidate.sourceCommitSha
    && artifact.repositoryIdentity === candidate.repositoryIdentity
    && artifact.artifactFingerprint === candidate.artifactFingerprint
    && candidate.releaseScopeCoverage.length > 0
    && candidate.releaseScopeCoverage.every((row) => !row.requiredByReleaseScope
      || (row.executableRuntimeAvailable && row.artifactIncluded && row.gapDisposition === "INCLUDED"));
}

function isManifestShapeSafe(manifest: ReleaseAcceptanceManifest): boolean {
  const rawEvidenceRefs: unknown = manifest.evidenceRefs;
  const hasValidDecisionProvenance = manifest.acceptanceResult === "ACCEPTED"
    ? isSafeIdentifier(manifest.acceptedBy) && isTimestamp(manifest.acceptedAt)
    : (manifest.acceptanceResult === "REJECTED" || manifest.acceptanceResult === "INCOMPLETE")
      && manifest.acceptedBy === null
      && manifest.acceptedAt === null;
  if (!hasExactKeys(manifest, MANIFEST_KEYS)
    || !isHex64(manifest.acceptanceManifestId)
    || !isHex64(manifest.manifestFingerprint)
    || !hasValidDecisionProvenance
    || !isTimestamp(manifest.evaluatedAt)
    || !isSafeReference(manifest.decisionEvidenceRef)
    || (manifest.previousManifestId !== null && !isHex64(manifest.previousManifestId))
    || !Array.isArray(rawEvidenceRefs)
    || rawEvidenceRefs.length === 0
    || rawEvidenceRefs.length > MAX_ITEMS) return false;

  return (rawEvidenceRefs as readonly unknown[]).every(isEvidenceRefSafe);
}

function hasCanonicalManifestIdentity(candidate: Rel001StagingCandidate, manifest: ReleaseAcceptanceManifest): boolean {
  const readinessRefs = normalizeReadiness(manifest.readinessRefs);
  if (readinessRefs === null) return false;
  const normalizedEvidence = manifest.evidenceRefs
    .map((value) => evidenceIdentity(value))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right), "en"));
  const manifestFingerprint = sha256(JSON.stringify([
    candidate.releaseCandidateId,
    candidate.logicalReleaseId,
    candidate.sourceCommitSha,
    candidate.repositoryIdentity,
    candidate.sourceBranch,
    candidate.artifactFingerprint,
    candidate.candidateFingerprint,
    candidate.targetEnvironment,
    normalizedEvidence,
    readinessRefs.map((value) => readinessIdentity(value)),
    manifest.acceptanceResult,
    manifest.acceptedBy,
    manifest.decisionEvidenceRef,
    manifest.previousManifestId,
  ]));
  return manifest.manifestFingerprint === manifestFingerprint
    && manifest.acceptanceManifestId === sha256(`release-acceptance-manifest\0${manifestFingerprint}`);
}

function isValidManifestHistory(
  candidate: Rel001StagingCandidate,
  history: readonly ReleaseAcceptanceManifest[],
  selectedManifestId: string,
): boolean {
  const byId = new Map<string, ReleaseAcceptanceManifest>();
  const successorById = new Map<string, string>();
  for (const item of history) {
    if (!isManifestShapeSafe(item)
      || !hasCanonicalManifestIdentity(candidate, item)
      || item.releaseCandidateId !== candidate.releaseCandidateId
      || byId.has(item.acceptanceManifestId)) return false;
    byId.set(item.acceptanceManifestId, item);
  }

  const roots: string[] = [];
  for (const item of history) {
    if (item.previousManifestId === null) {
      roots.push(item.acceptanceManifestId);
      continue;
    }
    if (!byId.has(item.previousManifestId) || successorById.has(item.previousManifestId)) return false;
    successorById.set(item.previousManifestId, item.acceptanceManifestId);
  }
  if (roots.length !== 1) return false;

  const visited = new Set<string>();
  let current: string | undefined = roots[0];
  while (current !== undefined && !visited.has(current)) {
    visited.add(current);
    current = successorById.get(current);
  }
  return current === undefined
    && visited.size === history.length
    && !successorById.has(selectedManifestId);
}

function isEvidenceRefSafe(value: unknown): value is ReleaseAcceptanceEvidenceRef {
  if (!hasExactKeys(value, EVIDENCE_KEYS)) return false;
  const record = value as Readonly<Record<string, unknown>>;
  const sourceCommitSha = record["sourceCommitSha"];
  return isSafeIdentifier(record["evidenceType"])
    && isSafeReference(record["evidenceRef"])
    && isSafeIdentifier(record["sourceFeatureOrRegistry"])
    && (sourceCommitSha === null || (typeof sourceCommitSha === "string" && SHA_40.test(sourceCommitSha)))
    && isHex64(record["candidateBindingFingerprint"])
    && isTimestamp(record["evaluatedAt"])
    && isSafeSummary(record["safeResultSummary"]);
}

function normalizeReadiness(values: unknown): readonly ReleaseReadinessRef[] | null {
  if (!Array.isArray(values) || values.length === 0 || values.length > MAX_ITEMS) return null;
  const identities = new Set<string>();
  const normalized: ReleaseReadinessRef[] = [];
  for (const rawValue of values as readonly unknown[]) {
    if (!hasExactKeys(rawValue, READINESS_KEYS)) return null;
    const record = rawValue as Readonly<Record<string, unknown>>;
    const readinessType = record["readinessType"];
    const readiness = record["readiness"];
    const freshness = record["freshness"];
    if (typeof readinessType !== "string" || !(["BACKUP", "DEPLOYMENT", "ROLLBACK"] as readonly string[]).includes(readinessType)
      || typeof readiness !== "string" || !(["READY", "NOT_READY", "DEGRADED", "UNKNOWN"] as readonly string[]).includes(readiness)
      || typeof freshness !== "string" || !(["FRESH", "STALE", "UNKNOWN"] as readonly string[]).includes(freshness)
      || !isSafeReference(record["readinessRef"])
      || !isHex64(record["releaseCandidateId"])
      || !isHex64(record["candidateBindingFingerprint"])
      || !isSafeIdentifier(record["targetEnvironment"])
      || !isTimestamp(record["evaluatedAt"])) return null;
    const safeReasonCodes = normalizeStrings(record["safeReasonCodes"], isSafeIdentifier);
    const refs = normalizeStrings(record["evidenceRefs"], isSafeReference);
    if (safeReasonCodes === null || refs === null) return null;
    const copy: ReleaseReadinessRef = deepFreeze({
      readinessType: readinessType as ReleaseReadinessRef["readinessType"],
      readinessRef: record["readinessRef"],
      releaseCandidateId: record["releaseCandidateId"],
      candidateBindingFingerprint: record["candidateBindingFingerprint"],
      targetEnvironment: record["targetEnvironment"],
      readiness: readiness as ReleaseReadinessRef["readiness"],
      freshness: freshness as ReleaseReadinessRef["freshness"],
      evaluatedAt: record["evaluatedAt"],
      safeReasonCodes,
      evidenceRefs: refs,
    });
    const identity = JSON.stringify(readinessIdentity(copy));
    if (identities.has(identity)) return null;
    identities.add(identity);
    normalized.push(copy);
  }
  normalized.sort((left, right) => left.readinessType.localeCompare(right.readinessType, "en"));
  return deepFreeze(normalized);
}

function evidenceRefs(manifest: ReleaseAcceptanceManifest, type: string): readonly string[] {
  return deepFreeze(manifest.evidenceRefs
    .filter((item) => item.evidenceType === type)
    .map((item) => item.evidenceRef)
    .sort((left, right) => left.localeCompare(right, "en")));
}

function evidenceIdentity(value: ReleaseAcceptanceEvidenceRef): readonly unknown[] {
  return [
    value.evidenceType,
    value.evidenceRef,
    value.sourceFeatureOrRegistry,
    value.sourceCommitSha,
    value.candidateBindingFingerprint,
    value.safeResultSummary,
  ];
}

function readinessIdentity(value: ReleaseReadinessRef): readonly unknown[] {
  return [
    value.readinessType,
    value.readinessRef,
    value.releaseCandidateId,
    value.candidateBindingFingerprint,
    value.targetEnvironment,
    value.readiness,
    value.freshness,
    [...value.safeReasonCodes].sort((left, right) => left.localeCompare(right, "en")),
    [...value.evidenceRefs].sort((left, right) => left.localeCompare(right, "en")),
  ];
}

function normalizeStrings(values: unknown, validator: (value: unknown) => value is string): readonly string[] | null {
  if (!Array.isArray(values) || values.length > 16 || !(values as readonly unknown[]).every(validator)) return null;
  const normalized = [...values as readonly string[]].sort((left, right) => left.localeCompare(right, "en"));
  return new Set(normalized).size === normalized.length ? deepFreeze(normalized) : null;
}

function hasExactKeys(value: unknown, expected: readonly string[]): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isHex64(value: unknown): value is string {
  return typeof value === "string" && HEX_64.test(value);
}

function isSafeIdentifier(value: unknown): value is string {
  return typeof value === "string"
    && IDENTIFIER.test(value)
    && !isSensitiveSecurityDetailKey(value)
    && !isUnsafeSecurityDetailValue(value);
}

function isSafeReference(value: unknown): value is string {
  return typeof value === "string"
    && REFERENCE.test(value)
    && !isSensitiveSecurityDetailKey(value)
    && !isUnsafeSecurityDetailValue(value);
}

function isSafeSummary(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 256
    && !/[\r\n]/u.test(value)
    && !isUnsafeSecurityDetailValue(value);
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !TIMESTAMP.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function canonical(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Readonly<Record<string, unknown>>)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, item]) => [key, sortValue(item)]));
  }
  return value;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
