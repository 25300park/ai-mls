# Current Main Document ID Governance Remediation Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-119 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-09-04 |
| Final Recommendation | `APPROVE_CURRENT_MAIN_DOCUMENT_ID_GOVERNANCE_REMEDIATION` |

## 1. Objective

Current main exact-HEAD integrated validation을 차단한 Document ID 형식·등록 위반만 교정했다. Production behavior, dependency, lockfile, frozen Feature identity, historical result와 execution-wave attribution은 변경하지 않았다.

## 2. Baseline

| 항목 | 결과 |
|---|---|
| Branch | `main` |
| Source HEAD | `b6d09e70be62b2e55693471ae97b3a2f3c26df5f` |
| Source working tree | clean |
| `origin/main` | `5d9e945b2aacfd11e6eeb46a32fb6e4c519fc157` — unpublished older baseline |
| Immutable architecture content commit | `426f6de0cdcf8c384f70c3e333f7b6483616bd15` |
| Immutable baseline checksum | `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778` |

## 3. Documents read

- [Document ID Rule](../00_DOCUMENT_ID_RULE.md)
- [Document Lifecycle](../00_DOCUMENT_LIFECYCLE.md)
- [Master Index](../00_MASTER_INDEX.md)
- [Version History](../00_VERSION_HISTORY.md)
- [Change Request Register](../00_CHANGE_REQUEST_REGISTER.md) — `CR-027`
- [Decision Register](../00_DECISION_REGISTER.md) — `DEC-115`
- [Decision Trace Matrix](../00_DECISION_TRACE_MATRIX.md) — `DT-115`
- [Architecture v1.1 Baseline Manifest](../freeze/ARCHITECTURE_V1_1_BASELINE_MANIFEST.md)
- MAOS Architecture Index — historical artifact: commit `97c3bb5b432235cbb8dcc3969961c7c155f20f53`, path `docs/maos/architecture/README.md` (현재 tree에서 회수됨)

## 4. Blocking validation result

Remediation 전 fresh inventory는 실제 metadata `Document ID` 387건에서 invalid format 33건, duplicate 0건을 확인했다. 그중 canonical format은 유효하지만 Master Index에 없던 ID는 `DOC-DEV-018`, `DOC-DEV-019`, `DOC-DEV-020` 3건이었다. Template placeholder `DOC-DOMAIN-NNN`은 발급 ID가 아니므로 inventory에서 제외했다.

## 5. Invalid-ID inventory and classification

### 5.1 Canonical DEV documents

| File | Previous identifier | Classification | Registration required | Remediation |
|---|---|---|---|---|
| `docs/development/SP005_IMPLEMENTATION_PLAN.md` | `DOC-DEV-SP005-PLAN` | EXECUTION_PLAN / IMPLEMENTATION_DOCUMENT | YES | `DOC-DEV-025`; previous value retained as Historical Artifact ID |
| `docs/development/SP006_IMPLEMENTATION_PLAN.md` | `DOC-DEV-SP006-PLAN` | EXECUTION_PLAN / IMPLEMENTATION_DOCUMENT | YES | `DOC-DEV-026`; previous value retained |
| `docs/development/SP007_IMPLEMENTATION_PLAN.md` | `DOC-DEV-SP007-PLAN` | EXECUTION_PLAN / IMPLEMENTATION_DOCUMENT | YES | `DOC-DEV-027`; previous value retained |
| `docs/development/SP008_IMPLEMENTATION_PLAN.md` | `DOC-DEV-SP008-PLAN` | EXECUTION_PLAN / IMPLEMENTATION_DOCUMENT | YES | `DOC-DEV-028`; previous value retained |
| `docs/development/SP008_TEST_EVIDENCE.md` | `DOC-DEV-SP008-TEST-EVIDENCE` | IMPLEMENTATION_DOCUMENT / HISTORICAL_EVIDENCE | YES | `DOC-DEV-029`; previous value retained |
| `docs/implementation/F19_D_CONNECTOR_AMBIGUITY_RECOVERY_HANDOFF_IMPLEMENTATION_PLAN.md` | `F19-D-PLAN` | EXECUTION_PLAN | YES | `DOC-DEV-030`; execution label retained |
| `docs/implementation/F19_E_API_019_BUSINESS_HANDOFF_IMPLEMENTATION_PLAN.md` | `F19-E-PLAN` | EXECUTION_PLAN | YES | `DOC-DEV-031`; execution label retained |
| `docs/implementation/F19_F_RECOVERY_IDEMPOTENCY_NESTED_AMBIGUITY_IMPLEMENTATION_PLAN.md` | `F19-F-PLAN` | EXECUTION_PLAN | YES | `DOC-DEV-032`; execution label retained |

### 5.2 Separate MAOS artifact namespace

| File | Artifact identifier | Classification | Registration required | Remediation |
|---|---|---|---|---|
| `docs/maos/architecture/MAOS-FRZ-001-architecture-freeze-v1.0.md` | `MAOS-FRZ-001` | OTHER / placeholder evidence | NO | metadata key changed to `Artifact ID`; value preserved |
| `docs/maos/architecture/MAOS-NRM-001-normalization.md` | `MAOS-NRM-001` | OTHER / placeholder evidence | NO | metadata key changed to `Artifact ID`; value preserved |
| `docs/maos/architecture/MAOS-P13-001-repository-bootstrap-design.md` | `MAOS-P13-001` | OTHER / MAOS implementation design | NO | metadata key changed to `Artifact ID`; value preserved |
| `docs/maos/architecture/README.md` | `MAOS-IDX-001` | OTHER / separate namespace index | NO | metadata key changed to `Artifact ID`; value preserved |

MAOS index는 이 directory를 기존 AI-MLS Domain Architecture와 분리한다고 명시한다. 따라서 `MAOS-*` 값을 canonical `DOC-*`로 위장하지 않고 validator가 사용하는 canonical metadata key에서만 분리했다. 전역 skip, directory allowlist 또는 validator 완화는 추가하지 않았다.

### 5.3 Canonical REVIEW documents

| File | Previous identifier | Classification | Registration required | Remediation |
|---|---|---|---|---|
| `docs/reviews/F15_TASK_009_API_AND_UI_CONTRACTS_IMPLEMENTATION_REPORT.md` | `DOC-REVIEW-F15-009` | REVIEW_REPORT | YES | existing `DOC-REVIEW-079` reused; previous value retained |
| `docs/reviews/F16_R1_DURABLE_ADMINISTRATION_PERSISTENCE_IMPLEMENTATION_REPORT.md` | `DOC-REV-082` | REVIEW_REPORT / HISTORICAL_EVIDENCE | YES | `DOC-REVIEW-099`; previous value retained |
| `docs/reviews/F16_R2_API_015_CLOSED_CONTRACT_EXECUTION_COMPLETENESS_IMPLEMENTATION_REPORT.md` | `DOC-REV-083` | REVIEW_REPORT / HISTORICAL_EVIDENCE | YES | `DOC-REVIEW-100`; previous value retained |
| `docs/reviews/F16_R3_RTM_TRACEABILITY_CLOSURE_REPORT.md` | `DOC-REV-084` | REVIEW_REPORT / HISTORICAL_EVIDENCE | YES | `DOC-REVIEW-101`; previous value retained |
| `docs/reviews/F16_FINAL_GATE_RETRY_FEATURE_CLOSURE_REPORT.md` | `DOC-REV-085` | REVIEW_REPORT / HISTORICAL_EVIDENCE | YES | `DOC-REVIEW-102`; previous value retained |
| `docs/reviews/F18_C_DURABLE_CONNECTOR_FOUNDATION_IMPLEMENTATION_REPORT.md` | `DOC-REV-F18-C-001` | REVIEW_REPORT | YES | `DOC-REVIEW-103`; previous value retained |
| `docs/reviews/F18_D_CLOSED_API_018_RUNTIME_HTTP_IMPLEMENTATION_REPORT.md` | `DOC-REVIEW-F18-D-001` | REVIEW_REPORT | YES | `DOC-REVIEW-104`; previous value retained |
| `docs/reviews/F19_C_PUBLICATION_RESOLVE_RECOVER_SEPARATION_IMPLEMENTATION_REPORT.md` | `F19-C-REPORT` | REVIEW_REPORT / HISTORICAL_EVIDENCE | YES | `DOC-REVIEW-105`; execution label retained |
| `docs/reviews/F19_D_CONNECTOR_AMBIGUITY_RECOVERY_HANDOFF_COMPLETION.md` | `F19-D-REPORT` | REVIEW_REPORT / HISTORICAL_EVIDENCE | YES | `DOC-REVIEW-106`; execution label retained |
| `docs/reviews/F19_E_API_019_BUSINESS_HANDOFF_COMPLETION.md` | `F19-E-REPORT` | REVIEW_REPORT / HISTORICAL_EVIDENCE | YES | `DOC-REVIEW-107`; execution label retained |
| `docs/reviews/F19_F_RECOVERY_IDEMPOTENCY_NESTED_AMBIGUITY_COMPLETION.md` | `F19-F-REPORT` | REVIEW_REPORT / HISTORICAL_EVIDENCE | YES | `DOC-REVIEW-108`; execution label retained |
| `docs/reviews/F19_H_FINAL_INTEGRATION_HARDENING_COMPLETION.md` | `F19-H-REPORT` | REVIEW_REPORT / HISTORICAL_EVIDENCE | YES | `DOC-REVIEW-109`; execution label retained |
| `docs/reviews/F20_A_OPERATIONS_CONSOLE_INVENTORY_GAP_REPORT.md` | `F20-A-REPORT` | REVIEW_REPORT / HISTORICAL_EVIDENCE | YES | `DOC-REVIEW-110`; execution label retained |
| `docs/reviews/F20_B_OPERATIONS_READ_MODELS_API_PROJECTION_IMPLEMENTATION_REPORT.md` | `F20-B-REPORT` | REVIEW_REPORT / HISTORICAL_EVIDENCE | YES | `DOC-REVIEW-111`; execution label retained |
| `docs/reviews/F20_C_PUBLICATION_OPERATIONS_CONSOLE_IMPLEMENTATION_REPORT.md` | `F20-C-REPORT` | REVIEW_REPORT / HISTORICAL_EVIDENCE | YES | `DOC-REVIEW-112`; execution label retained |
| `docs/reviews/F20_D_CONNECTOR_SOURCE_OPERATIONS_CONSOLE_IMPLEMENTATION_REPORT.md` | `F20-D-REPORT` | REVIEW_REPORT / HISTORICAL_EVIDENCE | YES | `DOC-REVIEW-113`; execution label retained |
| `docs/reviews/F20_E_RECONCILIATION_RECOVERY_CONSOLE_IMPLEMENTATION_REPORT.md` | `F20-E-REPORT` | REVIEW_REPORT / HISTORICAL_EVIDENCE | YES | `DOC-REVIEW-114`; execution label retained |
| `docs/reviews/F20_F_AUDIT_EVIDENCE_LINEAGE_INTEGRATION_REPORT.md` | `F20-F-REPORT` | REVIEW_REPORT / HISTORICAL_EVIDENCE | YES | `DOC-REVIEW-115`; execution label retained |
| `docs/reviews/F20_G_UX_SECURITY_ACCESSIBILITY_HARDENING_REPORT.md` | `F20-G-REPORT` | REVIEW_REPORT / HISTORICAL_EVIDENCE | YES | `DOC-REVIEW-116`; execution label retained |
| `docs/reviews/F20_H_FINAL_INTEGRATION_HARDENING_REPORT.md` | `F20-H-REPORT` | REVIEW_REPORT / HISTORICAL_EVIDENCE | YES | `DOC-REVIEW-117`; execution label retained |
| `docs/reviews/SP-008_COMPLETION.md` | `DOC-REVIEW-SP008-COMPLETION` | REVIEW_REPORT / HISTORICAL_EVIDENCE | YES | `DOC-REVIEW-118`; previous value retained |

## 6. Valid IDs registered

| ID | File | Owner/domain | Previous registry state | Result |
|---|---|---|---|---|
| `DOC-DEV-018` | `docs/implementation/F16_R1_DURABLE_ADMINISTRATION_PERSISTENCE_DESIGN.md` | Developer Bible / DEV | unregistered | REGISTERED |
| `DOC-DEV-019` | `docs/implementation/F16_R1_DURABLE_ADMINISTRATION_PERSISTENCE_IMPLEMENTATION_PLAN.md` | Developer Bible / DEV | unregistered | REGISTERED |
| `DOC-DEV-020` | `docs/implementation/F17_C_DURABLE_PUBLICATION_EXECUTION_DESIGN.md` | Developer Bible / DEV | unregistered | REGISTERED |

`DEV`의 기존 highest issued number는 024였으므로 새 발급은 025부터 시작했다. `REVIEW`의 기존 highest issued number는 098이므로 새 발급은 099부터 시작했고 본 보고서는 119를 사용한다. 기존 gap 또는 발급 번호는 재사용하지 않았다.

## 7. Historical evidence preservation

모든 이전 invalid value는 `Historical Artifact ID`로 보존했다. MAOS artifact는 원래 identifier 값을 그대로 유지했다. Historical test result, recommendation, commit evidence, execution-wave attribution, Feature identity와 final-gate disposition 변경은 0건이다. Version History의 `DOC-REV-084/085` 두 direct canonical reference만 같은 파일의 새 canonical ID `DOC-REVIEW-101/102`로 교정했다.

## 8. Validator and Master Index changes

Validator source 변경은 0건이다. Document ID Rule의 현재 authority인 Master Index review를 적용했고 canonical metadata key `Document ID`만 canonical format/registration 검사 대상으로 유지했다. Master Index navigation과 canonical registry에 `DOC-DEV-018–020`, `DOC-DEV-025–032`, `DOC-REVIEW-099–119`를 title/path/availability와 함께 등록했다. 기존 `DOC-REVIEW-079` path registration은 재사용했다.

## 9. Validation performed

| Validation | Result |
|---|---|
| Invalid required Document IDs | PASS — 0 |
| Unregistered required canonical IDs | PASS — 0 |
| Duplicate primary Document IDs | PASS — 0 |
| Master Index ID/path consistency | PASS — 0 mismatch |
| Broken Markdown links | PASS — 0 |
| Direct old canonical references | PASS — only explicit Historical/Artifact ID preservation remains |
| Architecture checksum | PASS — 153/153; immutable checksum matches |
| CR-027 delta | PASS — approved 4-file baseline delta unchanged; new delta 0 |
| `git diff --check` | PASS |
| Production source changes | PASS — 0 |
| Dependency/lockfile changes | PASS — 0 |

## 10. Architecture checksum and CR-027 delta

Immutable Architecture v1.1 scope는 content commit `426f6de0cdcf8c384f70c3e333f7b6483616bd15`에서 153/153 path/blob을 재계산해 checksum `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778`와 일치했다. 이 remediation은 checksum scope 밖의 index, version history, implementation/review metadata만 변경한다. Current main과 immutable snapshot 비교의 기존 4-file delta(`00_API_REGISTRY`, `00_EVENT_REGISTRY`, `00_DECISION_REGISTER`, `00_CANONICAL_TRACEABILITY_MATRIX`)는 `CR-027` 기록과 동일하며 이 작업이 추가한 checksum-scope delta는 0이다.

## 11. Independent review

Fresh independent governance review 결과:

- Critical: 0
- Important: 0
- Minor: 0
- Disposition: READY

Review는 invalid 33건 분류, historical evidence 보존, `DOC-DEV-018–020` 등록, validator 비완화, Master Index duplicate/orphan 부재, frozen FEAT identity 보존, Production 변경 0을 확인했다.

## 12. Files created

- `docs/reviews/CURRENT_MAIN_DOCUMENT_ID_GOVERNANCE_REMEDIATION_REPORT.md`

## 13. Files modified

- `docs/00_MASTER_INDEX.md`
- `docs/00_VERSION_HISTORY.md`
- DEV/implementation metadata 8 files
- REVIEW metadata 21 files
- separate MAOS artifact metadata 4 files

총 modified 35 files, created 1 file이다.

## 14. Key decisions added

새 Architecture Decision은 추가하지 않았다. 기존 domain rule에 따라 canonical DEV/REVIEW ID를 발급하고 분리된 MAOS namespace는 `Artifact ID`로 명시했다.

## 15. Open decisions and inconsistencies

- 이 remediation에서 추가된 신규 Open decisions: 없음.
- Remaining Document ID inconsistency: 0.
- `CR-027`의 frozen Feature identity와 execution-wave evidence attribution은 변경하지 않았다.

## 16. Known limitations and risks

- 자동 Document ID registry validator 구현 방식은 Document ID Rule의 기존 `OPEN DECISION`으로 남는다.
- 이번 검증은 canonical metadata와 Master Index의 deterministic repository scan이며 validator subsystem을 새로 만들지 않았다.

## 17. Repository state and scope protection

| Scope | Result |
|---|---|
| `apps/*/src` | 0 changes |
| `modules/*/src` | 0 changes |
| `package.json` | unchanged |
| `pnpm-lock.yaml` | unchanged |
| Historical Git commits | unchanged |
| Immutable checksum file | unchanged |
| Push | `NOT_PUSHED` |
| FEAT-021 | `NOT_STARTED` |

## 18. Next brief prerequisites

다음 단계는 새 Feature가 아니라 이 remediation commit을 exact source HEAD로 사용하는 `CURRENT MAIN EXACT-HEAD FRESH INTEGRATED VALIDATION — RETRY`다. 본 보고서 제출과 단일 local commit 후 중단한다.

## Forward-only recovery addendum — 2026-10-02

Human provenance와 Git 기록으로 `97c3bb5b432235cbb8dcc3969961c7c155f20f53`이 MAOS Phase 1.3 brief의 네 artifact를 canonical target `D:/10. MAOS` 대신 AI-MLS repository에 도입한 `CONFIRMED_WRONG_PROJECT` commit임을 확인했다. 이 문서의 당시 metadata 정규화 결과, count, 상태와 recommendation은 historical evidence로 그대로 보존한다.

별도 승인된 forward-only recovery로 아래 네 artifact를 현재 AI-MLS tree에서 제거했다. 과거 내용은 introduction commit의 해당 path에서 확인할 수 있으며 아래 경로는 현재 파일 링크가 아닌 historical 식별자다.

- `docs/maos/architecture/MAOS-FRZ-001-architecture-freeze-v1.0.md`
- `docs/maos/architecture/MAOS-NRM-001-normalization.md`
- `docs/maos/architecture/MAOS-P13-001-repository-bootstrap-design.md`
- `docs/maos/architecture/README.md`

`e69e3cd8255fc62bf8f35b1662682bba93bdb0ff`의 관련 변경은 `NORMALIZATION_ONLY`이며 전체 commit을 revert하지 않았다. 위 5.2절 및 MAOS 관련 과거 기술은 당시 수행 사실을 설명하며 현재 repository ownership 또는 live dependency를 승인하지 않는다. Legitimate AI-MLS 문서 ID 교정, Phase 14/15/16, REL-002, freeze registry, Decision/CR 및 기존 미커밋 작업은 보존했다. History rewrite, runtime/schema/test 변경과 Production/Railway/Supabase 접근 또는 mutation은 수행하지 않았다.
