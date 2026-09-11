# FEAT-024-B Release Evidence Manifest Contract Gap Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-144 |
| Version | v0.1 |
| Status | IN REVIEW |
| Owner | Architecture Owner / Release Owner |
| Baseline | `e11f9bdc6e624ea9c8df3fc2670dace467d252f8` |
| Branch | `codex/feat-024-b-release-evidence-manifest-contracts` |
| Production changes | `0` |

## 1. Objective

FEAT-024-A candidate/artifact evidence와 기존 FEAT-023 readiness/security contracts를 기준으로 immutable acceptance manifest contract의 현재 gap을 식별한다. 이 문서는 contract 설계를 제안하지만 acceptance persistence, authority, deployment execution 또는 public API를 구현하지 않는다.

## 2. Canonical sources inspected

- Architecture Owner-authorized FEAT-024-B Brief
- [REL-001 / Staging candidate manifest](../implementation/FEAT024_REL001_STAGING_PARTIAL_RUNTIME_CANDIDATE_MANIFEST.json)
- [FEAT-024-A candidate report](FEAT024_A_REL001_STAGING_CANDIDATE_IMPLEMENTATION_REPORT.md)
- `modules/operations/src/release-candidate-artifact.ts:42-61,103-128`
- `modules/operations/src/operational-readiness-evidence.ts:36-83,164-215`
- `modules/operations/src/operational-status-projection.ts:9-10,47-48`
- `modules/security/src/privacy-controls.ts:92-112`
- `docs/book-12/14_RELEASE_REGISTRY.md:25`
- `docs/book-12/15_IMPLEMENTATION_REGISTRY.md:25-48`

## 3. Contract gap matrix

| Item | Current evidence | Required contract | Gap | Proposed bounded disposition |
|---|---|---|---|---|
| `releaseCandidateId` | FEAT-024-A immutable SHA-256 identity | exact candidate binding | No reusable acceptance validator | Require exact equality with supplied candidate; include in fingerprint |
| `logicalReleaseId` | literal `REL-001` | immutable manifest field | No acceptance contract | Preserve exact candidate value; mismatch is conflict |
| `sourceCommitSha` | exact 40-hex SHA | immutable manifest field and evidence provenance | No cross-object binding | Validate format and exact candidate equality; mismatch is conflict |
| `repositoryIdentity` | exact repository URL | immutable manifest field | Not listed in minimum fingerprint inputs | Include in fingerprint to prevent repository rebinding |
| `sourceBranch` | exact candidate branch | immutable manifest field | Not listed in minimum fingerprint inputs | Include in fingerprint to prevent branch provenance rebinding |
| `artifactFingerprint` | FEAT-024-A SHA-256 | immutable manifest field | No cross-object binding | Require exact candidate equality; mismatch is conflict |
| `candidateFingerprint` | FEAT-024-A SHA-256 | exact evidence/readiness binding | No reusable validator | Validate the supplied candidate and every nested binding; do not add it as a top-level manifest field |
| `targetEnvironment` | literal `Staging` | immutable manifest/readiness binding | No acceptance contract | Preserve exact candidate value; mismatch is conflict |
| `evidenceRefs[]` | FEAT-024-A has coverage evidence, not acceptance refs | bounded provenance record | Missing | Add strict immutable `ReleaseAcceptanceEvidenceRef`; reject unknown fields, duplicate logical refs, raw payloads and unbound evidence |
| `readinessRefs[]` | FEAT-023 projection has candidate/environment binding, readiness, freshness, safe reason/evidence refs | bounded candidate/environment readiness reference | No release-specific safe reference | Add strict immutable `ReleaseReadinessRef`; reuse exact readiness/freshness vocabularies and safe references only |
| `acceptanceResult` | current candidate literal `INCOMPLETE` | `ACCEPTED | REJECTED | INCOMPLETE` | General contract absent | Exact enum only; current REL-001 with five mandatory gaps can only be `INCOMPLETE` |
| `decision provenance` | no FEAT-024 acceptance decision contract | `acceptedBy`, `decisionEvidenceRef`, times | Missing | Apply approved nullable acceptance provenance rule in Section 8 |
| `previousManifestId` | absent | nullable immutable predecessor linkage | Missing | Nullable strict manifest reference; included in fingerprint when present |
| `manifestFingerprint` | absent | deterministic canonical SHA-256 | Missing | Hash all immutable binding/decision content except timestamps after canonical sorting |
| `acceptanceManifestId` | absent | deterministic logical decision identity | Missing | Derive from `manifestFingerprint` with stable domain separation; different canonical content cannot reuse ID |
| Replay/idempotency | FEAT-024-A generator is deterministic | same request reuses logical result; duplicate append 0 | No acceptance replay classifier; durability deferred | Pure `REPLAY | NEW | CONFLICT` comparison contract in B; durable enforcement belongs to C |
| Conflict behavior | FEAT-024-A input validation only | candidate/manifest identity mismatch fails closed | Missing | One stable contract error type with bounded `INVALID | CANDIDATE_CONFLICT | MANIFEST_IDENTITY_CONFLICT` codes |
| Append-only semantics | no acceptance store | immutable/no update-in-place | Persistence intentionally deferred | Deep-freeze returned contract; expose no update/delete API; durable append-only guarantee belongs to C |
| Secret/PII sanitization | security sanitizer and safe operational refs exist | raw secret/PII/scanner/log/provider/prompt/CoT/SQL/path prohibited | No release-manifest validator | Reject unsafe keys/values and unbounded summaries; never copy raw payloads; do not silently store redacted raw evidence |
| Tenant binding | candidate manifest has no tenant field | tenant binding where applicable | Adding tenant would exceed canonical manifest fields | No tenant field in B; authoritative source evidence remains tenant/scope protected outside the manifest |
| Environment/release binding | candidate has `REL-001` and `Staging` | exact nested binding | Nested contracts absent | Evidence binds `candidateFingerprint`; readiness additionally binds `releaseCandidateId` and `targetEnvironment` |

## 4. Explicit fingerprint decision

Recommended canonical serialization uses UTF-8 JSON of a fixed tuple, not object property enumeration:

```text
releaseCandidateId
logicalReleaseId
sourceCommitSha
repositoryIdentity
sourceBranch
artifactFingerprint
candidateFingerprint
targetEnvironment
canonical ordered evidenceRefs
canonical ordered readinessRefs
acceptanceResult
acceptedBy
decisionEvidenceRef
previousManifestId
```

`evaluatedAt` and `acceptedAt` are immutable provenance fields but are excluded from `manifestFingerprint` and `acceptanceManifestId`. Therefore timestamp-only changes cannot create a duplicate logical manifest. Evidence and readiness arrays are normalized by complete canonical tuples and duplicate identities are rejected; caller order never changes identity.

`candidateFingerprint` participates as an internal exact binding input and is carried by each evidence/readiness reference. It is deliberately not emitted as an extra top-level acceptance manifest field because the canonical manifest field list does not contain it.

## 5. Proposed contract shape

### Evidence reference

```text
evidenceType
evidenceRef
sourceFeatureOrRegistry
sourceCommitSha nullable when the authoritative source is not commit-bound
candidateBindingFingerprint
evaluatedAt
safeResultSummary
```

`evidenceType` and `sourceFeatureOrRegistry` receive strict syntactic bounds rather than a new business enum. `safeResultSummary` is a short bounded scalar summary; raw/nested evidence content is rejected.

### Readiness reference

```text
readinessType = BACKUP | DEPLOYMENT | ROLLBACK
readinessRef
releaseCandidateId
candidateBindingFingerprint
targetEnvironment
readiness = READY | NOT_READY | DEGRADED | UNKNOWN
freshness = FRESH | STALE | UNKNOWN
evaluatedAt
safeReasonCodes[]
evidenceRefs[]
```

The release contract consumes FEAT-023 truth verbatim. `UNKNOWN`, `NOT_READY`, `STALE`, missing candidate binding, or mismatched environment cannot support `ACCEPTED`.

### Manifest and replay

- Factory validates the exact FEAT-024-A candidate, canonicalizes nested arrays, derives fingerprint/ID, deep-freezes the result, and enforces current `INCOMPLETE` coverage.
- Replay classifier compares an existing immutable manifest with a proposed canonical manifest: exact content is `REPLAY`; unused identity is `NEW`; same candidate/manifest identity with different canonical content is `CONFLICT`.
- The classifier makes no persistence claim. Restart durability, atomic append and duplicate append `0` are FEAT-024-C responsibilities.

## 6. Alternatives considered

| Option | Assessment |
|---|---|
| A. Dedicated pure contract/factory in existing `modules/operations` | **Recommended.** Minimal, testable, immutable, no persistence/API/authority expansion |
| B. Store full FEAT-023 projections or scanner payloads in the manifest | Rejected. Couples mutable/raw evidence and violates bounded privacy rules |
| C. Implement durable acceptance repository in B | Rejected. Explicitly belongs to FEAT-024-C |

## 7. Current REL-001 truth

| Field | Value |
|---|---|
| `releaseCandidateId` | `1f8da015c5cd9e1ae79984066e31f217430a244627d5284fb1fa901e86f51ff1` |
| `candidateFingerprint` | `001b97569d2b56ae80b90f4a13b87822d156dc6fd18a75899c5681ebb15d427d` |
| `artifactFingerprint` | `a5de42d389b2aec27b4dd2a6362f442afced8414a7050c170f980fa4727547cd` |
| Mandatory scope rows represented | `6/6` |
| `INCOMPLETE_RUNTIME_SURFACE` | `5` |
| Permitted result in current evidence state | `INCOMPLETE` only |

## 8. Approved decision F24-B-OD-001

Architecture Owner approval resolves acceptance provenance nullability as follows:

```text
acceptedBy: string | null
acceptedAt: string | null

ACCEPTED   => both non-null
REJECTED   => both null
INCOMPLETE => both null
```

`decisionEvidenceRef` remains required for all three results and identifies the bounded evaluation evidence without granting executable authority.

Additional invariants:

- `acceptedBy` and `acceptedAt` must either both be non-null or both be null.
- Only `ACCEPTED` permits and requires the non-null pair.
- `REJECTED` and `INCOMPLETE` require the null pair.
- `acceptedBy` is decision identity input but does not grant authority; `acceptedAt` is excluded from deterministic logical replay identity.
- `evaluatedAt` remains evaluation provenance and is not acceptance provenance.

## 9. Stop status

The design blocker is resolved. Production changes remain `0` before the RED test step; no new API, role/capability, persistence subsystem, acceptance/deployment authority, dependency or lifecycle state has been introduced.
