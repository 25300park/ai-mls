# FEAT-022-A AI Advisory Capability Canonical Inventory & Gap Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-128 |
| Historical Artifact ID | FEAT-022-A-REPORT |
| Version | v0.1 |
| Status | IN REVIEW |
| Owner | Architecture Owner / AI Reviewer |
| Completion date | 2026-09-08 |
| Baseline | `c842c70f08292b2debba1b4edfd248cbe65f7453` |
| Phase result | `FEAT-022-A = COMPLETE` |
| Implementation gate | `READY_FOR_FEAT-022-B` |

## 1. Objective

Frozen `FEAT-022` identity, Book 4 AI architecture, Workflow/API/Test registries와 현재 실행 코드를 대조해 AI advisory capability의 실제 구현 범위와 차이를 확정한다. 이 단계는 inventory만 수행하며 AI business authority, provider activation 또는 Production behavior를 추가하지 않는다.

## 2. Documents read

- [Feature Breakdown](../book-12/03_FEATURE_BREAKDOWN.md), [Implementation Registry](../book-12/15_IMPLEMENTATION_REGISTRY.md), [Canonical Traceability Matrix](../00_CANONICAL_TRACEABILITY_MATRIX.md), [Test Registry](../book-10/15_TEST_REGISTRY.md).
- [AI Architecture Index](../book-4/00_AI_ARCHITECTURE_INDEX.md), [AI Overview](../book-4/01_AI_OVERVIEW.md), [AI Boundaries](../book-4/02_AI_BOUNDARIES.md), [Provider Abstraction](../book-4/03_PROVIDER_ABSTRACTION.md).
- `AI-001`~`AI-006` capability documents, [Confidence and Validation](../book-4/10_CONFIDENCE_AND_VALIDATION.md), [Human Review](../book-4/11_HUMAN_REVIEW.md), [Prompt Governance](../book-4/12_PROMPT_GOVERNANCE.md), [AI Observability](../book-4/13_AI_OBSERVABILITY.md), [AI Output Schemas](../book-4/14_AI_OUTPUT_SCHEMAS.md), [AI Prompt Library Guide](../book-4/15_AI_PROMPT_LIBRARY_GUIDE.md).
- [AI Processing Workflow](../book-5/03_AI_PROCESSING_WORKFLOW.md), [API Registry](../00_API_REGISTRY.md), [Security Registry](../00_SECURITY_REGISTRY.md), [Operations Registry](../00_OPERATIONS_REGISTRY.md).
- [FEAT-021 Final Gate](FEAT021_FINAL_GATE_REPORT.md), [FEAT-021 Traceability](../implementation/FEAT021_TRACEABILITY_MATRIX.md), [SP-003 Completion](SP-003_COMPLETION.md).
- Current `modules/ai`, `modules/jobs`, owning domain/API implementation and directly related tests.

## 3. Canonical identity and scope

| Field | Canonical value |
|---|---|
| Feature | `FEAT-022 — AI advisory capability boundary` |
| Epic / implementation / task | `EPIC-006` / `IMP-022` / `DEV-022` |
| Requirements | `REQ-CONST-001`, `002`, `005`, `008`, `011` |
| Workflows | `WF-002`~`WF-006` |
| Entities | AI Job, AI Result, Source Provenance, Requirement, Match Result |
| APIs | `API-004`~`API-006`, `API-009`, `API-010`, `API-017` |
| UI | `UI-008`, `UI-011`~`UI-018`, `UI-021`, `UI-023`, `UI-024` |
| AI / Tests | `AI-001`~`AI-007` / `TEST-007`, `013`, `015`~`019`, `039`~`045` |

`TRACE-022 = VERIFIED`는 architecture trace completeness이며 `IMP-022 = PLANNED`를 실행 완료로 바꾸지 않는다.

## 4. Capability inventory

| ID | Capability | Advisory output | Prohibited consequence |
|---|---|---|---|
| `AI-001` | Listing parsing | structured proposal/evidence/uncertainty | canonical truth 생성 |
| `AI-002` | Property normalization | candidate/alias/location suggestion | master create/merge/split |
| `AI-003` | Duplicate detection | relationship/disposition recommendation | delete/merge/split |
| `AI-004` | Requirement parsing | Requirement draft/clarification | activation/change/consent inference |
| `AI-005` | Matching/ranking | factors/rank/explanation | eligibility/shortlist/sharing authority |
| `AI-006` | Natural-language search | bounded read-only interpretation | authorization/search/write execution |
| `AI-007` | Confidence/validation | confidence/review route | approval/business decision |

AI Result authority remains exactly `ADVISORY`; deterministic validation may reject but does not approve.

## 5. Existing executable boundary

| Evidence | State | Assessment |
|---|---|---|
| Domain APIs/services | selected AI envelope validation hooks | PARTIAL — no generation path |
| `API-017` job service | generic job lifecycle | PARTIAL — no provider execution |
| `advisory-ai-service.ts` | top-level allowlist, authority/provenance/classification/confidence checks, review | PARTIAL — frozen schema mismatch |
| Review | authorization/version/reason, immutable returned history, audit | PARTIAL — process-local store |
| Provider/model | approved provider count zero | NOT IMPLEMENTED |
| UI | FEAT-021 dependency-gated screens | NOT IMPLEMENTED |

Production AI provider calls found: `0`. AI-triggered domain/provider mutation paths found: `0` in the inspected boundary.

### 5.1 Exact API ownership and operations

| API | Canonical owner | FEAT-022 use |
|---|---|---|
| `API-004` | scoped Collector/Reviewer; Intake owner | submit/read Intake and request/associate advisory processing without AI authority |
| `API-005` | Property Data Steward | canonical property lookup and separate governed proposal/decision; AI-002 remains suggestion |
| `API-006` | Listing Owner/Human Reviewer | candidate/duplicate read and human disposition; AI-001/003 cannot mutate |
| `API-009` | Assigned Agent/Human Reviewer | Requirement read/revision and human activation; AI-004/006 provide drafts only |
| `API-010` | Agent/Human Reviewer | eligible matching request/read/human shortlist disposition; AI-005/006 do not decide eligibility |
| `API-017` | Domain/Operations Owner | background job submit/read/start/result/fail/cancel/successor; worker authority is technical only |

## 6. Closed schema reconciliation

| Area | Frozen contract | Current code | Result |
|---|---|---|---|
| Reference version | string | integer | CONFLICT |
| Schema binding | logical capability schema ID is required for exact resolution | wrapper version exists but no logical schema ID is bound | INCOMPLETE |
| `AI-001` | field state/evidence/confidence | shallow arrays | INCOMPLETE |
| `AI-002` | canonical five outcomes | incompatible four outcomes | CONFLICT |
| `AI-003` | closed enums/structured signals | arbitrary strings/arrays | INCOMPLETE |
| `AI-004` | budget/location/type/preference | simplified shape | CONFLICT |
| `AI-005` | cohort/score/rank | omitted | CONFLICT |
| `AI-006` | canonical intent/class/sort | incompatible names/omissions | CONFLICT |
| `AI-007` | closed outcome/route/map | arbitrary strings/array | CONFLICT |

Nested unknown fields, fabricated nested evidence and semantic constraints are not comprehensively rejected. `Closed Output Schemas = FAIL_CURRENT`.

## 7. Confidence, evidence and persistence

- Canonical bands `HIGH`, `MEDIUM`, `LOW`, `UNKNOWN` are complete, but capability/cohort thresholds, sampled `HIGH`, provider/data-class eligibility and full validation layers are absent.
- Subject/provenance is structurally checked; authoritative nested-evidence resolution and frozen version semantics are absent.
- Prompt/model/provider/config provenance is absent.
- Advisory state is a process-local `Map`; restart durability is absent.
- Advisory creation has no canonical idempotency/dedup or atomic durable audit/evidence boundary.
- Caller-authored evidence remains non-authoritative.

## 8. Governance blockers

- No provider/model is `APPROVED`; selection, routing, fallback, residency and evaluation gate are `OPEN DECISION`.
- Prompt ID/registry/store/allocator/version/quorum/activation/disable authority are deferred or `OPEN DECISION`.
- Production schema registry/generated validators are `OPEN DECISION`.
- Reviewer roles, sampling, SoD, SLA and feedback-data approval are `OPEN DECISION`.
- FEAT-022 UI surfaces remain dependency-gated.

These open decisions gate provider-backed generation and release completion, but they do not block FEAT-022-B from aligning executable validators to the already-frozen schema contracts.

## 9. UI/read-model and Post-MVP inventory

| UI group | Canonical read/output/action boundary | Current state |
|---|---|---|
| `UI-008` | authorized cross-domain search; masked/scoped results and explanation; AI-006/007 optional | dependency-gated |
| `UI-011/012` | Intake draft/review with exact source/evidence/version; AI request/advisory correction remains under API-004~006 | dependency-gated |
| `UI-013` | AI Job/Result/schema/input comparison and human accept-draft/correct/reject disposition | dependency-gated |
| `UI-014/015` | scoped candidate collection/detail, evidence/freshness and advisory inspection | dependency-gated |
| `UI-016` | duplicate evidence and human disposition; AI-003 is advisory only | dependency-gated |
| `UI-017/018` | property hierarchy/search/detail and steward-governed correction | dependency-gated |
| `UI-021/023/024` | scoped client search, Requirement draft lifecycle, matching review/shortlist | dependency-gated |

UI action authority remains with the owning API/human workflow. FEAT-022 must not implement a new screen, free-standing AI execute action or dependency-gated backend.

Post-MVP/excluded: an eighth/replacement AI capability, autonomous agent/tool execution, source browsing/account control, production prompt authoring, model training/fine-tuning, new provider/vendor/API endpoint, real network/credentials, AI approval/publication/permission, unrestricted contact/client data, and FEAT-023 observability expansion.

## 10. Test and security assessment

Existing assertions cover current-envelope validation, confidence routing, authorized review, selected authority fields, top-level unknown fields, stale/detached provenance, downgrade and stale review version. Missing proof includes all seven frozen schemas, nested unsafe/fabricated evidence, prompt mismatch, provider sanitization/failure, tenant isolation, dedup, AI-to-domain/provider zero paths and advisory UI. Test names alone do not close these gaps.

No provider path or chain-of-thought persistence was found. PII minimization is canonical but no production prompt-construction boundary exists. One complete FEAT-022 tenant/scope/purpose execution path does not exist.

## 11. Gap disposition

| Gap | Severity | Disposition |
|---|---|---|
| Frozen versus executable schema | Critical implementation gap | proceed with bounded FEAT-022-B design/TDD against frozen contracts |
| No approved provider/model/runtime | Critical later-stage gate | no activation; stop when provider-backed runtime is required |
| No approved prompt runtime identity | Critical later-stage gate | no invented prompt identity; stop before runtime requires it |
| Persistence/idempotency undefined | Important | no invented subsystem/rule |
| Reviewer governance unresolved | Important | review boundary incomplete |
| UI dependency-gated | Important | no UI implementation |

## 12. Recommended bounded direction

Start FEAT-022-B as a bounded contract-alignment slice: use the frozen Book 4 schemas as the authority, add exact executable closed validators and migrate existing fixtures/callers without adding API IDs, provider access, persistence or authority. Then stop before any provider-backed generation/runtime design unless AO resolves prompt/provider/persistence and reviewer-governance gates. Validation-only work is an intermediate slice, not feature completion.

## 13. Stage gates requiring AO decisions

FEAT-022-B may proceed directly under the approved continuous-execution authorization. Before provider-backed generation/runtime or final completion, decide:

1. executable schema/version and migration from the incompatible envelope;
2. whether an unavailable/no-network provider adapter is permitted;
3. prompt identity/registry behavior without production prompt content;
4. durable advisory/result/review/idempotency boundary or explicit process-local disposition;
5. minimum reviewer authority/SoD/sampling;
6. UI applicability under FEAT-021 gates.

## 14. Files and decisions

- Created: `docs/reviews/FEAT022_A_AI_ADVISORY_CANONICAL_INVENTORY_GAP_REPORT.md`.
- Modified: `docs/00_MASTER_INDEX.md` to register `DOC-REVIEW-128` only.
- Production/dependency/lockfile changes: `0`.
- Architecture decisions added: `0`; frozen `AI-001`~`AI-007` authority is preserved.

## 15. Validation and limitations

Baseline, canonical mappings, Book 4, current AI/job/domain/API source and actual test assertions were inspected. No test/build was run because Production code did not change. No provider/model/prompt/credential/network path was activated. `TRACE-022` was not rewritten as implementation completion.

## 16. Next brief prerequisites

Proceed with a bounded FEAT-022-B design, then follow RED → minimum schema-alignment implementation → GREEN. Do not start provider activation, FEAT-023, new UI screens or business mutation.

## 17. Final recommendation

`START_FEAT_022_B_ADVISORY_CONTRACT_ALIGNMENT_DESIGN`

`FEAT-022-A = COMPLETE`; `FEAT-022 = NOT_COMPLETE`; Production implementation has not started. Provider-backed runtime remains blocked pending section 13 decisions.
