# Test Levels

| 항목 | 값 |
|---|---|
| Document ID | DOC-TEST-004 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Quality Owner / Development Reviewer |
| 기준일 | 2026-07-15 |

## Level model

| Level | Scope | Primary evidence | Owner |
|---|---|---|---|
| Unit | pure rule, validator, state guard, mapper, policy function | input/output/boundary cases | Development |
| Integration | module/data/job/provider adapter contract | contract/state/audit/rollback evidence | Development + Domain |
| System | end-to-end workflow/API/UI/authority | scenario across real logical boundaries | Quality |
| Regression | previously accepted P0/P1 and defect prevention | versioned suite/result delta | Quality |
| User Acceptance | persona/business workflow and usability/accessibility | UAT script, actual result, sign-off | Business/UAT Owner |
| Operational | deploy/release/monitor/backup/recovery/DR/continuity | exercise/result/RPO/RTO/alert evidence | Operations |
| Security | authz/privacy/abuse/audit/secret/incident controls | allow/deny/leak/tamper evidence | Security/Privacy |
| AI Evaluation | dataset/cohort/metric/confidence/human correction | versioned evaluation report | AI + Domain Reviewer |

## Cross-level rules

P0 guardrail은 unit 하나로 release acceptance할 수 없고 integration/system/security/operational level 중 적용 가능한 evidence가 필요하다. UI test는 API deny를 대체하지 않고, contract mock success는 external reconciliation/DR evidence를 대체하지 않는다.

## Test pyramid and risk

Fast deterministic unit/integration coverage를 넓게 두고 high-value system/UAT/operational evaluation을 위험 기반으로 수행한다. AI/security/recovery는 별도 전문 evaluation이 필요하며 단순 pyramid 비율로 축소하지 않는다.

## Environment mapping

Unit은 isolated local, integration/system/security는 Test, release/UAT는 Staging-like isolated, operational recovery/DR는 approved isolated recovery environment를 사용한다. Production validation은 read-only/safe smoke와 approved exercise로 제한한다.

## Non-functional dimensions

Accessibility, privacy, performance, resilience, observability, compatibility와 data integrity를 적용 가능한 모든 level에 포함하고 마지막 별도 gate로만 미루지 않는다.

