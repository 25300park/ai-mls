# SP-003 Completion Report

| 항목 | 값 |
|---|---|
| 문서 버전 | v0.1 |
| 문서 상태 | DRAFT |
| 완료일 | 2026-07-19 |
| Brief | SP-003 — property, candidate, duplicate와 advisory AI |
| 기준 commit | `2c16f839db38be830e8478856dfe940049a7b68f` |

## 1. Objective

SP-001 identity/security와 SP-002 source/intake/provenance/job foundation을 재사용하여 Property Master, Candidate Listing/Listing Offer, Duplicate Review와 provider-neutral advisory AI boundary를 구현했다. production technology와 SP-004 이후 domain은 선택하거나 구현하지 않았다.

## 2. Documents read

- [Feature Breakdown](../book-12/03_FEATURE_BREAKDOWN.md), [Development Sequence](../book-12/04_DEVELOPMENT_SEQUENCE.md), [Sprint Plan](../book-12/05_SPRINT_PLAN.md), [Implementation Traceability](../book-12/08_IMPLEMENTATION_TRACEABILITY.md)
- [Property Master Model](../book-3/05_PROPERTY_MASTER_MODEL.md), [Candidate and Offer Model](../book-3/06_CANDIDATE_AND_OFFER_MODEL.md), [Data Dictionary](../book-3/15_DATA_DICTIONARY.md)
- [AI Boundaries](../book-4/02_AI_BOUNDARIES.md), AI-001–007 capability 문서와 [Confidence and Validation](../book-4/10_CONFIDENCE_AND_VALIDATION.md)
- [Duplicate Review Workflow](../book-5/04_DUPLICATE_REVIEW_WORKFLOW.md), [Status Dictionary](../book-5/13_STATUS_DICTIONARY.md), [State Transition Rules](../book-5/14_STATE_TRANSITION_RULES.md)
- [Property and Listing API](../book-6/04_PROPERTY_AND_LISTING_API.md), [API Principles](../book-6/01_API_PRINCIPLES.md), [Screen Specifications](../book-7/05_SCREEN_SPECIFICATIONS.md)
- [Permission Matrix](../book-8/04_PERMISSION_MATRIX.md), [Data Classification](../book-8/05_DATA_CLASSIFICATION.md), [Audit and Compliance](../book-8/07_AUDIT_AND_COMPLIANCE.md)
- [AI Validation](../book-10/06_AI_VALIDATION.md), [Test Registry](../book-10/15_TEST_REGISTRY.md), [Definition of Done](../book-11/11_DEFINITION_OF_DONE_DEVELOPMENT.md)

## 3. Files created

- [Property/Listing API adapter](../../apps/api/src/property-listing-api.ts)와 [tests](../../apps/api/src/property-listing-api.test.ts)
- [Property module](../../modules/property/src/property-service.ts), [tests](../../modules/property/src/property-service.test.ts), [export](../../modules/property/src/index.ts)
- [Listing module](../../modules/listing/src/listing-service.ts), [tests](../../modules/listing/src/listing-service.test.ts), [export](../../modules/listing/src/index.ts)
- [Advisory AI module](../../modules/ai/src/advisory-ai-service.ts), [tests](../../modules/ai/src/advisory-ai-service.test.ts), [export](../../modules/ai/src/index.ts)
- [SP-003 design](../development/SP003_DESIGN.md), [implementation plan](../development/SP003_IMPLEMENTATION_PLAN.md), [test evidence](../development/SP003_TEST_EVIDENCE.md), 이 completion report

## 4. Files modified

- [API composition](../../apps/api/src/composition.ts), [safe contracts](../../apps/api/src/contracts.ts), [API exports](../../apps/api/src/index.ts)
- [Authorization service](../../modules/authorization/src/authorization-service.ts)와 [authorization tests](../../modules/authorization/src/authorization-service.test.ts)

## 5. Key decisions and exact scope implemented

| Mapping | 완료 범위 |
|---|---|
| Feature | FEAT-006, FEAT-007, FEAT-022 |
| API | API-005, API-006; API-004/009/010/017은 provider-neutral AI envelope/job 연계 boundary만 유지 |
| Workflow | WF-002–007의 property normalization, candidate/offer lifecycle, duplicate review, advisory AI validation/review |
| AI | AI-001–007 closed-schema validation; provider/model/threshold 없음 |
| UI state | UI-008/011–018/021/023/024에 필요한 canonical/presentation/authority projection contract; frontend 없음 |

Property hierarchy/alias proposal와 steward decision, candidate/offer create/revise/list/read, idempotent candidate create, duplicate suggestion/DUR disposition/senior merge guard, AI classification/confidence/provenance/review history를 구현했다.

## 6. Open decisions

- **OPEN DECISION:** production database, queue, object storage, HTTP framework integration, AI provider, AI model, numeric confidence thresholds는 미결정 상태를 유지한다.

## 7. Inconsistencies found

동결 문서와 accepted SP-002 baseline 사이의 blocking inconsistency는 발견하지 못했다. FEAT-022의 AI-004/005/006은 SP-003에서 schema/advisory boundary만 구현하고 owning Requirement/Matching domain은 후속 sprint로 남기는 trace 해석을 [SP-003 design](../development/SP003_DESIGN.md)에 명시했다.

## 8. Validation performed

| 검증 | 결과 |
|---|---|
| lint / typecheck / build / verify | PASS |
| tests | PASS — 76/76; SP-003 신규 17개 |
| Gitleaks 8.30.1 | PASS — actual secrets 0, unexplained findings 0 |
| dependency audit | PASS — known vulnerabilities 0 |
| frozen docs / `.env` / NAS changes | 0 / 0 / 0 |
| working tree | completion commit 후 clean 확인 예정 |

상세 명령과 결과는 [SP-003 Test Evidence](../development/SP003_TEST_EVIDENCE.md)에 기록했다.

## 9. Known limitations and security controls

- in-memory repositories/ports만 제공하며 process restart persistence를 보장하지 않는다.
- AI는 실제 inference를 실행하지 않고 provider-neutral envelope를 검증한다.
- Requirement activation, matching/shortlist, full frontend는 구현하지 않았다.
- `DST` property decision, `DUR` duplicate disposition, `AIR` AI review를 분리하고 service principal human authority를 거부한다.
- exact version, immutable provenance/audit, highest-input classification, minimization, advisory-only authority와 safe error를 적용했다.

남은 위험은 production adapter 선택 후의 transaction/locking, 실제 AI evaluation dataset/calibration, field-level privacy catalog이며 모두 기존 OPEN DECISION 또는 후속 승인 범위다.

## 10. Next brief prerequisites

SP-004는 이 보고서의 Architecture Owner acceptance와 별도 명시적 authorization 이후에만 시작할 수 있다. Requirement domain과 production technology 결정을 SP-003에 소급 적용해서는 안 된다.

## Completion details

| 요구 항목 | 결과 |
|---|---|
| Security controls applied | session actor, API-002 default deny, DST/DUR/AIR SoD, service/human split, immutable audit/provenance, classification inheritance, safe errors |
| Tests added and count | 17 added; total 76 |
| Commit | 단일 `feat(sp-003): property candidate duplicate and advisory AI` completion commit에 포함 |
| Deferred items | production adapters/provider/model/threshold, Requirement lifecycle, Matching application, full UI |
| SP-004 status | 시작하지 않음; source artifact 0 |

## Completion statement

SP-003의 구현 및 검증 증거를 완료 기록에 반영했다. completion commit과 clean working tree를 확인한 뒤 최종 hash를 사용자 보고에 제공하고 중단한다.
