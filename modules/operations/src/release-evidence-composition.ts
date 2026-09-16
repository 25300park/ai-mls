import { createHash } from "node:crypto";
import { isSensitiveSecurityDetailKey, isUnsafeSecurityDetailValue } from "../../../packages/security-contracts/src/index.js";
import {
  assertRel001StagingCandidateIntegrity,
  type Rel001StagingCandidate,
} from "./release-candidate-artifact.js";
import type { ReleaseAcceptanceResult, ReleaseReadinessRef } from "./release-evidence-manifest.js";
import type { EvidenceFreshness } from "./operational-status-projection.js";

export type ReleaseEvidenceDisposition = "SATISFIED" | "MISSING" | "BLOCKING" | "NOT_APPLICABLE";

export type ReleaseEvidenceRequirementId =
  | "FULL_REGRESSION"
  | "FOCUSED_TESTS"
  | "LINT"
  | "TYPECHECK"
  | "BUILD"
  | "VERIFY"
  | "ARCHITECTURE_CHECKSUM"
  | "GITLEAKS"
  | "DEPENDENCY_AUDIT"
  | "DEPLOYMENT_READINESS"
  | "BACKUP_READINESS"
  | "ROLLBACK_READINESS"
  | "PRODUCTION_CONFIGURATION"
  | "DOCUMENT_VALIDATION"
  | "INDEPENDENT_REVIEW"
  | "REGISTRY_STATE"
  | "ACCEPTANCE_AUTHORITY"
  | "CANDIDATE_PRODUCER";

export interface CandidateBoundVerificationEvidence {
  readonly requirementId: Exclude<ReleaseEvidenceRequirementId, "DEPLOYMENT_READINESS" | "BACKUP_READINESS" | "ROLLBACK_READINESS">;
  readonly evidenceRef: string;
  readonly sourceFeatureOrRegistry: string;
  readonly sourceCommitSha: string | null;
  readonly releaseCandidateId: string;
  readonly candidateBindingFingerprint: string;
  readonly targetEnvironment: string;
  readonly evaluatedAt: string;
  readonly safeResultSummary: string;
  readonly outcome: Exclude<ReleaseEvidenceDisposition, "MISSING">;
  readonly freshness: EvidenceFreshness;
}

export interface ReleaseEvidenceCompositionInput {
  readonly evaluatedAt: string;
  readonly authoritativeEvidence: readonly CandidateBoundVerificationEvidence[];
  readonly readinessRefs: readonly ReleaseReadinessRef[];
}

export interface ResolvedReleaseEvidenceSourceSet {
  readonly authoritativeEvidence: readonly CandidateBoundVerificationEvidence[];
  readonly readinessRefs: readonly ReleaseReadinessRef[];
}

export interface ReleaseEvidenceSourceResolver {
  resolve(candidate: Rel001StagingCandidate): ResolvedReleaseEvidenceSourceSet;
}

export interface ReleaseEvidenceCompositionRequest {
  readonly evaluatedAt: string;
}

export interface ReleaseEvidenceRequirementResult {
  readonly requirementId: ReleaseEvidenceRequirementId;
  readonly disposition: ReleaseEvidenceDisposition;
  readonly evidenceRef: string | null;
}

export interface ReleaseEvidenceComposition {
  readonly releaseCandidateId: string;
  readonly logicalReleaseId: string;
  readonly sourceCommitSha: string;
  readonly artifactFingerprint: string;
  readonly candidateBindingFingerprint: string;
  readonly targetEnvironment: string;
  readonly evaluatedAt: string;
  readonly acceptanceResult: ReleaseAcceptanceResult;
  readonly authoritativeEvidence: readonly CandidateBoundVerificationEvidence[];
  readonly readinessRefs: readonly ReleaseReadinessRef[];
  readonly requirementResults: readonly ReleaseEvidenceRequirementResult[];
  readonly runtimeGapComponentIds: readonly string[];
  readonly compositionFingerprint: string;
}

export type ReleaseEvidenceCompositionErrorCode = "INVALID" | "UNSAFE" | "CANDIDATE_CONFLICT";

export class ReleaseEvidenceCompositionError extends Error {
  public constructor(public readonly code: ReleaseEvidenceCompositionErrorCode) {
    super(code);
    this.name = "ReleaseEvidenceCompositionError";
  }
}

const EVIDENCE_REQUIREMENTS = Object.freeze([
  "FULL_REGRESSION",
  "FOCUSED_TESTS",
  "LINT",
  "TYPECHECK",
  "BUILD",
  "VERIFY",
  "ARCHITECTURE_CHECKSUM",
  "GITLEAKS",
  "DEPENDENCY_AUDIT",
  "PRODUCTION_CONFIGURATION",
  "DOCUMENT_VALIDATION",
  "INDEPENDENT_REVIEW",
  "REGISTRY_STATE",
  "ACCEPTANCE_AUTHORITY",
  "CANDIDATE_PRODUCER",
] satisfies readonly CandidateBoundVerificationEvidence["requirementId"][]);
const ALL_REQUIREMENTS = Object.freeze([
  ...EVIDENCE_REQUIREMENTS,
  "DEPLOYMENT_READINESS",
  "BACKUP_READINESS",
  "ROLLBACK_READINESS",
] satisfies readonly ReleaseEvidenceRequirementId[]);
const EVIDENCE_KEYS = Object.freeze([
  "candidateBindingFingerprint",
  "evaluatedAt",
  "evidenceRef",
  "freshness",
  "outcome",
  "releaseCandidateId",
  "requirementId",
  "safeResultSummary",
  "sourceCommitSha",
  "sourceFeatureOrRegistry",
  "targetEnvironment",
]);
const INPUT_KEYS = Object.freeze(["authoritativeEvidence", "evaluatedAt", "readinessRefs"]);
const READINESS_KEYS = Object.freeze([
  "candidateBindingFingerprint",
  "evaluatedAt",
  "evidenceRefs",
  "freshness",
  "readiness",
  "readinessRef",
  "readinessType",
  "releaseCandidateId",
  "safeReasonCodes",
  "targetEnvironment",
]);
const REFERENCE = /^[A-Z0-9][A-Z0-9_.:#/-]{0,255}$/i;
const IDENTIFIER = /^[A-Z0-9][A-Z0-9_.:-]{0,127}$/i;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const UNSAFE_BOUNDED_EVIDENCE_VALUE = /(?:\bSQLITE_[A-Z0-9_]+\b|\bdatabase\s+is\s+locked\b|\bdatabase\s+disk\s+image\s+is\s+malformed\b|\bno\s+such\s+(?:table|column)\b|\bSQL\s+logic\s+error\b|\b(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s+(?:INTO|FROM|TABLE|DATABASE|SCHEMA|INDEX|VIEW|TRIGGER|[A-Z0-9_."'`\[])|\b(?:sk_(?:live|test)_?|ghp_|github_pat_)[A-Z0-9_-]{8,}\b|\braw\s+(?:scanner\s+output|log\s+(?:message|output|payload))\b)/iu;
const EVIDENCE_OUTCOMES = new Set<ReleaseEvidenceDisposition>(["SATISFIED", "BLOCKING", "NOT_APPLICABLE"]);
const NOT_APPLICABLE_REQUIREMENTS = new Set<CandidateBoundVerificationEvidence["requirementId"]>(["ACCEPTANCE_AUTHORITY"]);
const FRESHNESS_VALUES = new Set<EvidenceFreshness>(["FRESH", "STALE", "UNKNOWN"]);
const READINESS_VALUES = new Set(["READY", "NOT_READY", "DEGRADED", "UNKNOWN"]);
const READINESS_TYPES = new Set(["BACKUP", "DEPLOYMENT", "ROLLBACK"]);
const MAX_ITEMS = 64;

export class ReleaseEvidenceCompositionService {
  public constructor(private readonly sourceResolver: ReleaseEvidenceSourceResolver) {}

  public compose(
    candidate: Rel001StagingCandidate,
    request: ReleaseEvidenceCompositionRequest,
  ): ReleaseEvidenceComposition {
    assertExactKeys(request, ["evaluatedAt"]);
    const resolved = this.sourceResolver.resolve(candidate);
    assertExactKeys(resolved, ["authoritativeEvidence", "readinessRefs"]);
    return createReleaseEvidenceComposition(candidate, {
      evaluatedAt: request.evaluatedAt,
      authoritativeEvidence: resolved.authoritativeEvidence,
      readinessRefs: resolved.readinessRefs,
    });
  }
}

function createReleaseEvidenceComposition(
  candidate: Rel001StagingCandidate,
  input: ReleaseEvidenceCompositionInput,
): ReleaseEvidenceComposition {
  assertExactKeys(input, INPUT_KEYS);
  assertCandidate(candidate);
  assertTimestamp(input.evaluatedAt);
  if (!Array.isArray(input.authoritativeEvidence) || input.authoritativeEvidence.length > MAX_ITEMS) fail("INVALID");
  if (!Array.isArray(input.readinessRefs) || input.readinessRefs.length > MAX_ITEMS) fail("INVALID");

  const authoritativeEvidence = normalizeEvidence(input.authoritativeEvidence, candidate);
  const readinessRefs = normalizeReadiness(input.readinessRefs, candidate);
  const evidenceByRequirement = new Map(authoritativeEvidence.map((item) => [item.requirementId, item]));
  const readinessByRequirement = new Map(readinessRefs.map((item) => [readinessRequirement(item.readinessType), item]));
  const requirementResults = ALL_REQUIREMENTS.map((requirementId): ReleaseEvidenceRequirementResult => {
    const evidence = evidenceByRequirement.get(requirementId as CandidateBoundVerificationEvidence["requirementId"]);
    if (evidence !== undefined) {
      return deepFreeze({
        requirementId,
        disposition: evidence.freshness === "FRESH" ? evidence.outcome : "MISSING",
        evidenceRef: evidence.evidenceRef,
      });
    }
    const readiness = readinessByRequirement.get(requirementId);
    if (readiness !== undefined) {
      return deepFreeze({
        requirementId,
        disposition: readinessDisposition(readiness),
        evidenceRef: readiness.readinessRef,
      });
    }
    return deepFreeze({ requirementId, disposition: "MISSING", evidenceRef: null });
  }).sort((left, right) => left.requirementId.localeCompare(right.requirementId, "en"));

  const runtimeGapComponentIds = candidate.releaseScopeCoverage
    .filter((item) => item.requiredByReleaseScope && item.gapDisposition === "INCOMPLETE_RUNTIME_SURFACE")
    .map((item) => item.artifactComponentId)
    .sort((left, right) => left.localeCompare(right, "en"));

  const compositionFingerprint = sha256(JSON.stringify([
    candidate.releaseCandidateId,
    candidate.sourceCommitSha,
    candidate.artifactFingerprint,
    candidate.candidateFingerprint,
    candidate.targetEnvironment,
    candidate.acceptanceResult,
    authoritativeEvidence.map(canonicalEvidence),
    readinessRefs.map(canonicalReadiness),
    requirementResults.map((item) => [item.requirementId, item.disposition, item.evidenceRef]),
    runtimeGapComponentIds,
  ]));

  return deepFreeze({
    releaseCandidateId: candidate.releaseCandidateId,
    logicalReleaseId: candidate.logicalReleaseId,
    sourceCommitSha: candidate.sourceCommitSha,
    artifactFingerprint: candidate.artifactFingerprint,
    candidateBindingFingerprint: candidate.candidateFingerprint,
    targetEnvironment: candidate.targetEnvironment,
    evaluatedAt: input.evaluatedAt,
    acceptanceResult: candidate.acceptanceResult,
    authoritativeEvidence,
    readinessRefs,
    requirementResults,
    runtimeGapComponentIds,
    compositionFingerprint,
  });
}

function normalizeEvidence(
  values: readonly CandidateBoundVerificationEvidence[],
  candidate: Rel001StagingCandidate,
): readonly CandidateBoundVerificationEvidence[] {
  const seen = new Set<string>();
  const normalized = values.map((value) => {
    assertExactKeys(value, EVIDENCE_KEYS);
    if (!EVIDENCE_REQUIREMENTS.includes(value.requirementId)) fail("INVALID");
    if (seen.has(value.requirementId)) fail("INVALID");
    seen.add(value.requirementId);
    if (
      value.releaseCandidateId !== candidate.releaseCandidateId
      || value.candidateBindingFingerprint !== candidate.candidateFingerprint
      || value.targetEnvironment !== candidate.targetEnvironment
      || value.sourceCommitSha !== candidate.sourceCommitSha
    ) fail("CANDIDATE_CONFLICT");
    assertReference(value.evidenceRef);
    assertIdentifier(value.sourceFeatureOrRegistry);
    assertTimestamp(value.evaluatedAt);
    assertSafeSummary(value.safeResultSummary);
    if (!EVIDENCE_OUTCOMES.has(value.outcome) || !FRESHNESS_VALUES.has(value.freshness)) fail("INVALID");
    if (value.outcome === "NOT_APPLICABLE" && !NOT_APPLICABLE_REQUIREMENTS.has(value.requirementId)) fail("INVALID");
    return deepFreeze({ ...value });
  });
  return deepFreeze(normalized.sort((left, right) => left.requirementId.localeCompare(right.requirementId, "en")));
}

function normalizeReadiness(
  values: readonly ReleaseReadinessRef[],
  candidate: Rel001StagingCandidate,
): readonly ReleaseReadinessRef[] {
  const seen = new Set<string>();
  const normalized = values.map((value) => {
    assertExactKeys(value, READINESS_KEYS);
    if (!READINESS_TYPES.has(value.readinessType) || seen.has(value.readinessType)) fail("INVALID");
    seen.add(value.readinessType);
    if (
      value.releaseCandidateId !== candidate.releaseCandidateId
      || value.candidateBindingFingerprint !== candidate.candidateFingerprint
      || value.targetEnvironment !== candidate.targetEnvironment
    ) fail("CANDIDATE_CONFLICT");
    assertReference(value.readinessRef);
    assertTimestamp(value.evaluatedAt);
    if (!READINESS_VALUES.has(value.readiness) || !FRESHNESS_VALUES.has(value.freshness)) fail("INVALID");
    const safeReasonCodes = normalizeStringArray(value.safeReasonCodes, assertIdentifier);
    const evidenceRefs = normalizeStringArray(value.evidenceRefs, assertReference);
    return deepFreeze({ ...value, safeReasonCodes, evidenceRefs });
  });
  return deepFreeze(normalized.sort((left, right) => left.readinessType.localeCompare(right.readinessType, "en")));
}

function readinessRequirement(readinessType: ReleaseReadinessRef["readinessType"]): ReleaseEvidenceRequirementId {
  return `${readinessType}_READINESS` as ReleaseEvidenceRequirementId;
}

function readinessDisposition(value: ReleaseReadinessRef): ReleaseEvidenceDisposition {
  if (value.readiness === "NOT_READY") return "BLOCKING";
  if (value.readiness === "READY" && value.freshness === "FRESH") return "SATISFIED";
  return "MISSING";
}

function canonicalEvidence(value: CandidateBoundVerificationEvidence): readonly unknown[] {
  return [
    value.requirementId,
    value.evidenceRef,
    value.sourceFeatureOrRegistry,
    value.sourceCommitSha,
    value.releaseCandidateId,
    value.candidateBindingFingerprint,
    value.targetEnvironment,
    value.safeResultSummary,
    value.outcome,
    value.freshness,
  ];
}

function canonicalReadiness(value: ReleaseReadinessRef): readonly unknown[] {
  return [
    value.readinessType,
    value.readinessRef,
    value.releaseCandidateId,
    value.candidateBindingFingerprint,
    value.targetEnvironment,
    value.readiness,
    value.freshness,
    [...value.safeReasonCodes].sort((a, b) => a.localeCompare(b, "en")),
    [...value.evidenceRefs].sort((a, b) => a.localeCompare(b, "en")),
  ];
}

function assertCandidate(candidate: Rel001StagingCandidate): void {
  const artifact = candidate.artifactManifest;
  if (
    candidate.logicalReleaseId !== "REL-001"
    || candidate.targetEnvironment !== "Staging"
    || candidate.acceptanceResult !== "INCOMPLETE"
    || artifact.artifactManifestVersion !== "1"
    || artifact.logicalReleaseId !== candidate.logicalReleaseId
    || artifact.targetEnvironment !== candidate.targetEnvironment
    || artifact.sourceCommitSha !== candidate.sourceCommitSha
    || artifact.repositoryIdentity !== candidate.repositoryIdentity
    || artifact.artifactFingerprint !== candidate.artifactFingerprint
    || artifact.generatedAt !== candidate.generatedAt
  ) fail("CANDIDATE_CONFLICT");
  try {
    assertRel001StagingCandidateIntegrity(candidate);
  } catch {
    fail("CANDIDATE_CONFLICT");
  }
}

function assertExactKeys(value: unknown, expected: readonly string[]): asserts value is Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail("INVALID");
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) fail("INVALID");
}

function assertReference(value: unknown): asserts value is string {
  if (typeof value !== "string" || !REFERENCE.test(value) || isSensitiveSecurityDetailKey(value) || isUnsafeSecurityDetailValue(value)) fail("UNSAFE");
}

function assertIdentifier(value: unknown): asserts value is string {
  if (typeof value !== "string" || !IDENTIFIER.test(value) || isSensitiveSecurityDetailKey(value) || isUnsafeSecurityDetailValue(value)) fail("UNSAFE");
}

function assertSafeSummary(value: unknown): asserts value is string {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > 256
    || /[\r\n]/u.test(value)
    || isUnsafeSecurityDetailValue(value)
    || UNSAFE_BOUNDED_EVIDENCE_VALUE.test(value)
  ) fail("UNSAFE");
}

function assertTimestamp(value: unknown): asserts value is string {
  if (typeof value !== "string" || !TIMESTAMP.test(value)) fail("INVALID");
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) fail("INVALID");
}

function normalizeStringArray(
  value: unknown,
  validator: (item: unknown) => asserts item is string,
): readonly string[] {
  if (!Array.isArray(value) || value.length > MAX_ITEMS) fail("INVALID");
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const item of value as readonly unknown[]) {
    validator(item);
    if (seen.has(item)) fail("INVALID");
    seen.add(item);
    normalized.push(item);
  }
  return normalized.sort((left, right) => left.localeCompare(right, "en"));
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

function fail(code: ReleaseEvidenceCompositionErrorCode): never {
  throw new ReleaseEvidenceCompositionError(code);
}
