| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-156 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Release Owner / Quality Owner |
| 적용 범위 | FEAT-024-H |

# FEAT-024-H Final Integration / Hardening Gap Matrix

## 1. Objective

FEAT-024 A–G의 기존 경계를 한 실행 흐름으로 검증하고, FEAT-024 Final Gate에 필요한 cross-phase 결손만 식별한다. 이 단계는 hardening이며 새 release semantics, authority, persistence, deployment 또는 promotion capability를 추가하지 않는다.

## 2. Preserved canonical truth

- `logicalReleaseId = REL-001`
- `targetEnvironment = Staging`
- `acceptanceResult = INCOMPLETE`
- mandatory runtime gaps = `5`
- promotion handoff = `UNAVAILABLE`
- registry mutation 및 deployment/promotion/rollback side effect = `0`

## 3. Integrated gap matrix

| Cross-phase boundary | Source components | Invariant | Current direct evidence | Exact integrated gap | Minimum correction | Production change |
|---|---|---|---|---|---|---|
| Candidate → artifact | `release-candidate-artifact.ts` | exact source SHA/repository/branch/Staging/runtime bytes determine candidate and artifact fingerprints; exclusions remain closed | `release-candidate-artifact.test.ts` lines 62–173 | A contract is verified directly but not asserted together with persisted/reopened downstream evidence | add H integration assertion using the canonical materialized candidate and existing validators | No |
| Candidate → manifest contract | `release-evidence-manifest.ts` | candidate/artifact/environment bindings cannot be substituted; REL-001 remains INCOMPLETE | `release-evidence-manifest.test.ts` lines 88–259 | B assertions are slice-local; no single A→B→C restart flow proves binding survival | compose canonical candidate and manifest, persist/reopen, then assert exact identities | No |
| Manifest → durable store | `durable-release-acceptance-manifest-store.ts` | immutable append-only manifest, exact replay without duplicate rows, valid same-candidate lineage and atomic rollback | `durable-release-acceptance-manifest-store.test.ts` lines 136–461 | C restart tests do not continue through E/F/G projections in one test | add reopen integration coverage through composition, handoff and read projection | No |
| Authority → persistence | `release-acceptance-authority-service.ts` → durable store | trusted actor, live `RELEASE_OWNER`/`release.accept`, MFA and SoD precede persisted ACCEPTED evidence; stale authority cannot append | `release-acceptance-authority-service.test.ts` lines 228–396 | D tests prove the service boundary; H must verify no persisted/Console elevation of the real INCOMPLETE candidate | assert current REL-001 durable history and downstream projection remain INCOMPLETE with null acceptance provenance | No |
| Candidate/manifest → evidence composition | `release-evidence-composition.ts` | historical/unbound/wrong commit/environment/unsafe evidence cannot satisfy the candidate; UNKNOWN/NOT_READY and five gaps remain truthful | `release-evidence-composition.test.ts` lines 98–301 | E is not currently exercised from the same reopened candidate/manifest used by G | add exact-source integration assertion and unsafe evidence rejection regression | No |
| Manifest/composition → handoff | `promotion-handoff-evidence.ts` | only latest authoritative ACCEPTED manifest with exact bindings/readiness can produce immutable handoff; current REL-001 cannot | `promotion-handoff-evidence.test.ts` lines 206–388 | F tests use isolated fixtures; H needs current-candidate reopened history proof and no-side-effect assertion | derive handoff from reopened real INCOMPLETE history and require `undefined`/UNAVAILABLE | No |
| A–F → read projection | `release-trace-read-projection.ts` | read-only projection preserves exact binding, canonical terminal manifest, gaps and handoff availability | G service test line 43 | G selected `history.at(-1)`, so persistence timestamp order could substitute a predecessor for the canonical lineage terminal after restart; orphaned history was also accepted | select and validate the unique complete `previousManifestId` terminal chain before projection | **Yes — one bounded read-projection correction** |
| Read projection → Console | `console-read-adapter.ts`, `console-renderer.ts`, `console-composition.test.ts` | trusted tenant/scope/session, safe immutable DTO, Staging/INCOMPLETE/gaps 5/UNAVAILABLE, no controls/store bypass | G Console direct tests lines 1102–1248 and composition test line 181 | integrated projection output has not been fed through the Console adapter in the same durable-restart scenario | validate the H projection DTO against existing Console closed validator/renderer path where practical; preserve existing G regression | No unless RED proves a defect |
| Security/privacy | B/E/F/G validators and sanitizers | secret, PII, raw diagnostic, provider/model/prompt/CoT, SQL/path/session internals never cross manifest/composition/handoff/Console | B line 145; E line 192; F line 367; G lines 1166–1218 | leakage assertions are distributed, not summarized as one H hardening gate | add focused cross-boundary unsafe-value cases only if an untested value is accepted; otherwise retain affected suite evidence | No unless RED proves a defect |
| Registry truthfulness | canonical registries and FEAT-024 RTM | release evidence cannot mutate `REL-*` or `IMP-*` state | A–G reports and `FEAT024_TRACEABILITY_MATRIX.md` | no explicit H before/after registry snapshot assertion exists | add architecture/document assertion that H runtime modules have no registry write dependency and record zero registry changes | No |
| Test-only ACCEPTED fixture isolation | D/F/G tests | positive ACCEPTED fixtures remain test-only and cannot become REL-001 production evidence or deployment handoff | D eligible fixture tests; F lines 206–225; G line 1220 | no repository-wide focused assertion distinguishes fixture-only ACCEPTED data from production modules | add architecture source assertion covering production modules and canonical manifest | No |
| Traceability A–H | `FEAT024_TRACEABILITY_MATRIX.md`, Master Index, A–G reports | H evidence is added only after verified; Final Gate stays NOT_STARTED | RTM lines 15–46 | H row/report/index evidence does not exist yet | update RTM and Master Index after verification; create H completion report | Documentation only |

## 4. Initial disposition

Initial inventory identified an integration-evidence gap. The durable restart RED then proved that storage timestamp order could select a predecessor instead of the canonical terminal manifest. Additional RED assertions proved that orphaned lineage and a cross-candidate predecessor could pass into composition. The bounded correction validates and selects the unique complete same-candidate lineage terminal without changing persistence, schema, API, authority, or release semantics.

## 5. Scope protection

No new release state/result, role/capability, API/route, persistence subsystem, deployment/promotion behavior, CI/CD integration, environment-transition semantics, dependency, or registry mutation is authorized. If any H verification requires one, implementation stops.
