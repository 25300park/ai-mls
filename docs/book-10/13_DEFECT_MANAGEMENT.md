# Defect Management

| 항목 | 값 |
|---|---|
| Document ID | DOC-TEST-014 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Quality Owner / Development Reviewer |
| 기준일 | 2026-07-15 |

## Severity

| Severity | Meaning |
|---|---|
| P0 / BLOCKER | constitutional/security/privacy/authority/data loss or release impossible |
| P1 / CRITICAL | core workflow materially wrong, broad outage, no safe workaround |
| P2 / MAJOR | limited workflow/quality degradation with controlled workaround |
| P3 / MINOR | low-impact usability/cosmetic/document clarity |

Severity는 impact, Priority는 remediation ordering/urgency이며 서로 독립이다.

## Priority

Business impact, security/privacy, affected users/data, recurrence, workaround, release proximity와 dependency를 고려해 Immediate/Current Release/Next Release/Backlog로 정한다. P0/P1 defer에는 named authority와 risk evidence가 필요하다.

## Lifecycle

`NEW → TRIAGED → ASSIGNED → IN_PROGRESS → READY_FOR_VERIFICATION → VERIFIED/CLOSED`이며 `DUPLICATE`, `NOT_REPRODUCIBLE`, `DEFERRED`, `REJECTED`, `REOPENED` disposition을 reason/evidence와 사용한다.

## Required record

Defect ID/title, requirement/TEST, candidate/environment/config/data, steps, expected/actual, severity/priority, impact/classification, evidence/correlation, owner, root cause/fix, retest/regression와 disposition.

## Root Cause Analysis

P0/P1, repeated P2, escaped defect, recovery/SLO/security incident는 technical/process/control/detection causes, contributing conditions, corrective/preventive action, owner/date와 effectiveness test를 요구한다. Blame보다 system evidence를 우선한다.

## Verification

Independent tester가 original case와 affected regression을 same/new candidate에서 검증한다. Code change 존재만으로 close하지 않고 expected result/evidence를 확인한다. Requirement change로 해결한다면 CR/Decision/trace update가 선행된다.

## Release relation

Open defect inventory, blocker/defer/known limitation와 residual risk를 release gate에 제공한다. 숨김/분할로 severity를 낮추거나 test를 삭제해 coverage를 개선한 것으로 표시하지 않는다.

