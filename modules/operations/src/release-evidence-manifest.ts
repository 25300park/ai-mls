import { createHash } from "node:crypto";
import { isSensitiveSecurityDetailKey, isUnsafeSecurityDetailValue } from "../../../packages/security-contracts/src/index.js";
import type { Rel001StagingCandidate } from "./release-candidate-artifact.js";
import type { EvidenceFreshness, OperationalReadiness } from "./operational-status-projection.js";

export type ReleaseAcceptanceResult = "ACCEPTED" | "REJECTED" | "INCOMPLETE";
export type ReleaseManifestReplayDisposition = "REPLAY" | "NEW" | "CONFLICT";

export interface ReleaseAcceptanceEvidenceRef {
  readonly evidenceType: string;
  readonly evidenceRef: string;
  readonly sourceFeatureOrRegistry: string;
  readonly sourceCommitSha: string | null;
  readonly candidateBindingFingerprint: string;
  readonly evaluatedAt: string;
  readonly safeResultSummary: string;
}

export interface ReleaseReadinessRef {
  readonly readinessType: "BACKUP" | "DEPLOYMENT" | "ROLLBACK";
  readonly readinessRef: string;
  readonly releaseCandidateId: string;
  readonly candidateBindingFingerprint: string;
  readonly targetEnvironment: string;
  readonly readiness: OperationalReadiness;
  readonly freshness: EvidenceFreshness;
  readonly evaluatedAt: string;
  readonly safeReasonCodes: readonly string[];
  readonly evidenceRefs: readonly string[];
}

export interface ReleaseAcceptanceManifestInput {
  readonly evidenceRefs: readonly ReleaseAcceptanceEvidenceRef[];
  readonly readinessRefs: readonly ReleaseReadinessRef[];
  readonly acceptanceResult: ReleaseAcceptanceResult;
  readonly acceptedBy: string | null;
  readonly evaluatedAt: string;
  readonly acceptedAt: string | null;
  readonly decisionEvidenceRef: string;
  readonly previousManifestId: string | null;
}

export interface ReleaseAcceptanceManifest extends ReleaseAcceptanceManifestInput {
  readonly acceptanceManifestId: string;
  readonly releaseCandidateId: string;
  readonly logicalReleaseId: string;
  readonly sourceCommitSha: string;
  readonly repositoryIdentity: string;
  readonly sourceBranch: string;
  readonly artifactFingerprint: string;
  readonly targetEnvironment: string;
  readonly manifestFingerprint: string;
}

export type ReleaseAcceptanceManifestErrorCode = "INVALID" | "UNSAFE" | "CANDIDATE_CONFLICT" | "MANIFEST_IDENTITY_CONFLICT";

export class ReleaseAcceptanceManifestError extends Error {
  public constructor(public readonly code: ReleaseAcceptanceManifestErrorCode) {
    super(code);
    this.name = "ReleaseAcceptanceManifestError";
  }
}

const HEX_64 = /^[a-f0-9]{64}$/;
const SHA_40 = /^[a-f0-9]{40}$/;
const IDENTIFIER = /^[A-Z0-9][A-Z0-9_.:-]{0,127}$/i;
const REFERENCE = /^[A-Z0-9][A-Z0-9_.:#/-]{0,255}$/i;
const MAX_REFERENCES = 64;
const EVIDENCE_KEYS = Object.freeze(["candidateBindingFingerprint", "evaluatedAt", "evidenceRef", "evidenceType", "safeResultSummary", "sourceCommitSha", "sourceFeatureOrRegistry"]);
const READINESS_KEYS = Object.freeze(["candidateBindingFingerprint", "evaluatedAt", "evidenceRefs", "freshness", "readiness", "readinessRef", "readinessType", "releaseCandidateId", "safeReasonCodes", "targetEnvironment"]);
const INPUT_KEYS = Object.freeze(["acceptanceResult", "acceptedAt", "acceptedBy", "decisionEvidenceRef", "evaluatedAt", "evidenceRefs", "previousManifestId", "readinessRefs"]);
const MANIFEST_KEYS = Object.freeze([...INPUT_KEYS, "acceptanceManifestId", "artifactFingerprint", "logicalReleaseId", "manifestFingerprint", "releaseCandidateId", "repositoryIdentity", "sourceBranch", "sourceCommitSha", "targetEnvironment"].sort());

export function createReleaseAcceptanceManifest(
  candidate: Rel001StagingCandidate,
  input: ReleaseAcceptanceManifestInput,
): ReleaseAcceptanceManifest {
  assertExactKeys(input, INPUT_KEYS);
  assertCandidate(candidate);
  const evidenceRefs = normalizeEvidenceRefs(input.evidenceRefs, candidate);
  const readinessRefs = normalizeReadinessRefs(input.readinessRefs, candidate);
  validateDecision(input, candidate, readinessRefs);

  const manifestFingerprint = sha256(JSON.stringify(identityTuple(candidate, input, evidenceRefs, readinessRefs)));
  const acceptanceManifestId = sha256(`release-acceptance-manifest\0${manifestFingerprint}`);
  return deepFreeze({
    acceptanceManifestId,
    releaseCandidateId: candidate.releaseCandidateId,
    logicalReleaseId: candidate.logicalReleaseId,
    sourceCommitSha: candidate.sourceCommitSha,
    repositoryIdentity: candidate.repositoryIdentity,
    sourceBranch: candidate.sourceBranch,
    artifactFingerprint: candidate.artifactFingerprint,
    targetEnvironment: candidate.targetEnvironment,
    evidenceRefs,
    readinessRefs,
    acceptanceResult: input.acceptanceResult,
    acceptedBy: input.acceptedBy,
    evaluatedAt: input.evaluatedAt,
    acceptedAt: input.acceptedAt,
    decisionEvidenceRef: input.decisionEvidenceRef,
    previousManifestId: input.previousManifestId,
    manifestFingerprint,
  });
}

export function validateReleaseAcceptanceManifest(
  candidate: Rel001StagingCandidate,
  value: unknown,
): ReleaseAcceptanceManifest {
  assertRecord(value);
  assertExactKeys(value, MANIFEST_KEYS);
  assertCandidateBinding(candidate, value);
  const rebuilt = createReleaseAcceptanceManifest(candidate, {
    evidenceRefs: value["evidenceRefs"] as readonly ReleaseAcceptanceEvidenceRef[],
    readinessRefs: value["readinessRefs"] as readonly ReleaseReadinessRef[],
    acceptanceResult: value["acceptanceResult"] as ReleaseAcceptanceResult,
    acceptedBy: value["acceptedBy"] as string | null,
    evaluatedAt: value["evaluatedAt"] as string,
    acceptedAt: value["acceptedAt"] as string | null,
    decisionEvidenceRef: value["decisionEvidenceRef"] as string,
    previousManifestId: value["previousManifestId"] as string | null,
  });
  if (value["manifestFingerprint"] !== rebuilt.manifestFingerprint || value["acceptanceManifestId"] !== rebuilt.acceptanceManifestId) {
    fail("MANIFEST_IDENTITY_CONFLICT");
  }
  return rebuilt;
}

export function classifyReleaseAcceptanceManifestReplay(
  existing: ReleaseAcceptanceManifest,
  proposed: ReleaseAcceptanceManifest,
): ReleaseManifestReplayDisposition {
  if (existing.acceptanceManifestId === proposed.acceptanceManifestId) {
    return existing.manifestFingerprint === proposed.manifestFingerprint && sameLogicalManifestContent(existing, proposed) ? "REPLAY" : "CONFLICT";
  }
  if (existing.releaseCandidateId === proposed.releaseCandidateId && !sameCandidateBinding(existing, proposed)) return "CONFLICT";
  return "NEW";
}

function normalizeEvidenceRefs(
  values: readonly ReleaseAcceptanceEvidenceRef[],
  candidate: Rel001StagingCandidate,
): readonly ReleaseAcceptanceEvidenceRef[] {
  assertArrayBounds(values);
  const identities = new Set<string>();
  const normalized = values.map((value) => {
    assertExactKeys(value, EVIDENCE_KEYS);
    assertIdentifier(value.evidenceType);
    assertReference(value.evidenceRef);
    assertIdentifier(value.sourceFeatureOrRegistry);
    if (value.sourceCommitSha !== null && !SHA_40.test(value.sourceCommitSha)) fail("INVALID");
    if (value.candidateBindingFingerprint !== candidate.candidateFingerprint) fail("CANDIDATE_CONFLICT");
    assertTimestamp(value.evaluatedAt);
    assertSafeSummary(value.safeResultSummary);
    if (identities.has(value.evidenceRef)) fail("INVALID");
    identities.add(value.evidenceRef);
    return { ...value };
  });
  normalized.sort((left, right) => canonicalEvidence(left).localeCompare(canonicalEvidence(right), "en"));
  return deepFreeze(normalized);
}

function normalizeReadinessRefs(
  values: readonly ReleaseReadinessRef[],
  candidate: Rel001StagingCandidate,
): readonly ReleaseReadinessRef[] {
  assertArrayBounds(values);
  const identities = new Set<string>();
  const normalized = values.map((value) => {
    assertExactKeys(value, READINESS_KEYS);
    if (!(["BACKUP", "DEPLOYMENT", "ROLLBACK"] as const).includes(value.readinessType)) fail("INVALID");
    assertReference(value.readinessRef);
    if (value.releaseCandidateId !== candidate.releaseCandidateId || value.candidateBindingFingerprint !== candidate.candidateFingerprint || value.targetEnvironment !== candidate.targetEnvironment) fail("CANDIDATE_CONFLICT");
    if (!(["READY", "NOT_READY", "DEGRADED", "UNKNOWN"] as const).includes(value.readiness)) fail("INVALID");
    if (!(["FRESH", "STALE", "UNKNOWN"] as const).includes(value.freshness)) fail("INVALID");
    assertTimestamp(value.evaluatedAt);
    const safeReasonCodes = normalizeSafeStrings(value.safeReasonCodes, true);
    const evidenceRefs = normalizeSafeStrings(value.evidenceRefs, false);
    if (identities.has(value.readinessRef)) fail("INVALID");
    identities.add(value.readinessRef);
    return { ...value, safeReasonCodes, evidenceRefs };
  });
  normalized.sort((left, right) => canonicalReadiness(left).localeCompare(canonicalReadiness(right), "en"));
  return deepFreeze(normalized);
}

function validateDecision(input: ReleaseAcceptanceManifestInput, candidate: Rel001StagingCandidate, readinessRefs: readonly ReleaseReadinessRef[]): void {
  if (!(["ACCEPTED", "REJECTED", "INCOMPLETE"] as const).includes(input.acceptanceResult)) fail("INVALID");
  assertTimestamp(input.evaluatedAt);
  assertReference(input.decisionEvidenceRef);
  if (input.previousManifestId !== null && !HEX_64.test(input.previousManifestId)) fail("INVALID");
  const hasActor = input.acceptedBy !== null;
  const hasTime = input.acceptedAt !== null;
  if (hasActor !== hasTime) fail("INVALID");
  if (input.acceptanceResult === "ACCEPTED") {
    if (!hasActor || !hasTime) fail("INVALID");
    assertReference(input.acceptedBy);
    assertTimestamp(input.acceptedAt);
    if (candidate.acceptanceResult === "INCOMPLETE" || candidate.releaseScopeCoverage.some((row) => row.requiredByReleaseScope && row.gapDisposition !== "INCLUDED")) fail("INVALID");
    if (readinessRefs.some((ref) => ref.readiness !== "READY" || ref.freshness !== "FRESH")) fail("INVALID");
  } else if (hasActor || hasTime) {
    fail("INVALID");
  }
}

function identityTuple(
  candidate: Rel001StagingCandidate,
  input: ReleaseAcceptanceManifestInput,
  evidenceRefs: readonly ReleaseAcceptanceEvidenceRef[],
  readinessRefs: readonly ReleaseReadinessRef[],
): readonly unknown[] {
  return [
    candidate.releaseCandidateId,
    candidate.logicalReleaseId,
    candidate.sourceCommitSha,
    candidate.repositoryIdentity,
    candidate.sourceBranch,
    candidate.artifactFingerprint,
    candidate.candidateFingerprint,
    candidate.targetEnvironment,
    evidenceRefs.map((value) => evidenceIdentity(value)),
    readinessRefs.map((value) => readinessIdentity(value)),
    input.acceptanceResult,
    input.acceptedBy,
    input.decisionEvidenceRef,
    input.previousManifestId,
  ];
}

function evidenceIdentity(value: ReleaseAcceptanceEvidenceRef): readonly unknown[] {
  return [value.evidenceType, value.evidenceRef, value.sourceFeatureOrRegistry, value.sourceCommitSha, value.candidateBindingFingerprint, value.safeResultSummary];
}

function readinessIdentity(value: ReleaseReadinessRef): readonly unknown[] {
  return [value.readinessType, value.readinessRef, value.releaseCandidateId, value.candidateBindingFingerprint, value.targetEnvironment, value.readiness, value.freshness, value.safeReasonCodes, value.evidenceRefs];
}

function canonicalEvidence(value: ReleaseAcceptanceEvidenceRef): string {
  return JSON.stringify(evidenceIdentity(value));
}

function canonicalReadiness(value: ReleaseReadinessRef): string {
  return JSON.stringify(readinessIdentity(value));
}

function normalizeSafeStrings(values: unknown, identifiers: boolean): readonly string[] {
  if (!Array.isArray(values) || values.length > 16) fail("INVALID");
  const normalized: string[] = [];
  for (const value of values as readonly unknown[]) {
    if (identifiers) assertIdentifier(value);
    else assertReference(value);
    normalized.push(value);
  }
  if (new Set(normalized).size !== normalized.length) fail("INVALID");
  normalized.sort((left, right) => left.localeCompare(right, "en"));
  return deepFreeze(normalized);
}

function assertCandidate(candidate: Rel001StagingCandidate): void {
  if (!HEX_64.test(candidate.releaseCandidateId) || !HEX_64.test(candidate.artifactFingerprint) || !HEX_64.test(candidate.candidateFingerprint) || !SHA_40.test(candidate.sourceCommitSha)) fail("INVALID");
  if (candidate.logicalReleaseId !== "REL-001" || candidate.targetEnvironment !== "Staging") fail("CANDIDATE_CONFLICT");
  const expectedReleaseCandidateId = sha256([
    candidate.logicalReleaseId,
    candidate.sourceCommitSha,
    candidate.repositoryIdentity,
    candidate.sourceBranch,
    candidate.artifactFingerprint,
    candidate.targetEnvironment,
  ].join("\0"));
  const expectedCandidateFingerprint = sha256([
    expectedReleaseCandidateId,
    candidate.logicalReleaseId,
    candidate.sourceCommitSha,
    candidate.repositoryIdentity,
    candidate.sourceBranch,
    candidate.artifactFingerprint,
    candidate.targetEnvironment,
  ].join("\0"));
  if (candidate.releaseCandidateId !== expectedReleaseCandidateId || candidate.candidateFingerprint !== expectedCandidateFingerprint) fail("CANDIDATE_CONFLICT");
  if (candidate.artifactManifest.logicalReleaseId !== candidate.logicalReleaseId
    || candidate.artifactManifest.sourceCommitSha !== candidate.sourceCommitSha
    || candidate.artifactManifest.repositoryIdentity !== candidate.repositoryIdentity
    || candidate.artifactManifest.artifactFingerprint !== candidate.artifactFingerprint
    || candidate.artifactManifest.targetEnvironment !== candidate.targetEnvironment) fail("CANDIDATE_CONFLICT");
  if (candidate.acceptanceResult !== "INCOMPLETE"
    || !candidate.releaseScopeCoverage.some((row) => row.requiredByReleaseScope && row.gapDisposition === "INCOMPLETE_RUNTIME_SURFACE")) fail("CANDIDATE_CONFLICT");
}

function assertCandidateBinding(candidate: Rel001StagingCandidate, value: Readonly<Record<string, unknown>>): void {
  const fields = ["releaseCandidateId", "logicalReleaseId", "sourceCommitSha", "repositoryIdentity", "sourceBranch", "artifactFingerprint", "targetEnvironment"] as const;
  for (const field of fields) if (value[field] !== candidate[field]) fail("CANDIDATE_CONFLICT");
}

function sameCandidateBinding(left: ReleaseAcceptanceManifest, right: ReleaseAcceptanceManifest): boolean {
  const leftNestedBinding = exactNestedCandidateBinding(left);
  const rightNestedBinding = exactNestedCandidateBinding(right);
  return leftNestedBinding !== null
    && rightNestedBinding !== null
    && leftNestedBinding === rightNestedBinding
    && left.logicalReleaseId === right.logicalReleaseId
    && left.sourceCommitSha === right.sourceCommitSha
    && left.repositoryIdentity === right.repositoryIdentity
    && left.sourceBranch === right.sourceBranch
    && left.artifactFingerprint === right.artifactFingerprint
    && left.targetEnvironment === right.targetEnvironment;
}

function exactNestedCandidateBinding(value: ReleaseAcceptanceManifest): string | null {
  const bindings = new Set([
    ...value.evidenceRefs.map((ref) => ref.candidateBindingFingerprint),
    ...value.readinessRefs.map((ref) => ref.candidateBindingFingerprint),
  ]);
  return bindings.size === 1 ? [...bindings][0]! : null;
}

function sameLogicalManifestContent(left: ReleaseAcceptanceManifest, right: ReleaseAcceptanceManifest): boolean {
  const logicalTuple = (value: ReleaseAcceptanceManifest): readonly unknown[] => [
    value.releaseCandidateId,
    value.logicalReleaseId,
    value.sourceCommitSha,
    value.repositoryIdentity,
    value.sourceBranch,
    value.artifactFingerprint,
    value.targetEnvironment,
    value.evidenceRefs.map((ref) => canonicalEvidence(ref)).sort((a, b) => a.localeCompare(b, "en")),
    value.readinessRefs.map((ref) => canonicalReadiness(ref)).sort((a, b) => a.localeCompare(b, "en")),
    value.acceptanceResult,
    value.acceptedBy,
    value.decisionEvidenceRef,
    value.previousManifestId,
  ];
  return JSON.stringify(logicalTuple(left)) === JSON.stringify(logicalTuple(right));
}

function assertExactKeys(value: unknown, expected: readonly string[]): asserts value is Readonly<Record<string, unknown>> {
  assertRecord(value);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) fail("INVALID");
}

function assertRecord(value: unknown): asserts value is Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail("INVALID");
}

function assertArrayBounds(value: unknown): asserts value is readonly unknown[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_REFERENCES) fail("INVALID");
}

function assertIdentifier(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length === 0) fail("INVALID");
  if (!IDENTIFIER.test(value) || isSensitiveSecurityDetailKey(value) || isUnsafeSecurityDetailValue(value)) fail("UNSAFE");
}

function assertReference(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length === 0) fail("INVALID");
  if (!REFERENCE.test(value) || isSensitiveSecurityDetailKey(value) || isUnsafeSecurityDetailValue(value)) fail("UNSAFE");
}

function assertSafeSummary(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 256 || /[\r\n]/u.test(value) || isUnsafeSecurityDetailValue(value)) fail("UNSAFE");
}

function assertTimestamp(value: unknown): asserts value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) fail("INVALID");
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) fail("INVALID");
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

function fail(code: ReleaseAcceptanceManifestErrorCode): never {
  throw new ReleaseAcceptanceManifestError(code);
}
