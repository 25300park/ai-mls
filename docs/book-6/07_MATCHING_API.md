# Matching API

| 항목 | 값 |
|---|---|
| Document ID | DOC-API-008 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Matching Owner / Business Owner |
| 기준일 | 2026-07-14 |
| API Capability | API-010 |

## Purpose

활성 Requirement와 eligible Candidate/Offer 사이의 matching execution, ranking, explanation, human review와 staleness를 관리한다.

## Logical Endpoints

| Logical operation | Method/resource | Outcome |
|---|---|---|
| Request Match | `POST /v{major}/match-runs` | `MATCH.REQUESTED` / background job |
| Read Match Run | `GET /v{major}/match-runs/{id}` | status/input version summary |
| List Results | `GET /v{major}/match-runs/{id}/results` | ranked masked results |
| Review Result | `POST /v{major}/match-results/{id}:review` | reviewed/accepted/rejected disposition |
| Mark/Recompute Stale | `POST /v{major}/match-results/{id}:mark-stale` | stale reason and successor trigger |

## Request Model

Active requirement ID/revision, eligible population scope, deterministic/AI matcher intent/version, policy/weight profile, optional explainability level, expected version, idempotency and trace context를 포함한다. Review에는 exact result version, disposition, adjustment/reason과 evidence가 필요하다.

## Response Model

Match run/result IDs, input revisions, status, rank, score/confidence, hard/soft criterion outcomes, explanation, limitations/stale indicators와 candidate/offer links를 반환한다. Restricted listing/contact fields는 별도 authority에 따라 masked된다.

## Business Rules

Matching은 ADVISORY다. Requirement가 active이고 candidate/offer가 search-eligible해야 한다. Result acceptance는 shortlist disposition일 뿐 Verification, Permission 또는 proposal approval이 아니다. Input/version/eligibility 변화는 result를 stale로 만든다.

## Authority

Assigned Agent가 run/review, Senior Agent가 override policy에 따른 adjustment/escalation을 수행한다. Worker/AI는 계산만 하고 acceptance를 결정하지 않는다.

## Validation

requirement status/revision, candidate/offer eligibility, privacy scope, matcher/policy version, result lineage, expected version와 review role을 검사한다.

## Audit

run request, input snapshot, matcher/model/prompt/policy version, result ranking/explanation, human review/adjustment, staleness trigger와 successor linkage를 기록한다.

## Error Conditions

`REQUIREMENT_NOT_ACTIVE`, `NO_ELIGIBLE_CANDIDATES`, `MATCH_INPUT_STALE`, `MATCH_RESULT_NOT_FOUND`, `MATCH_REVIEW_REQUIRED`, `VERSION_CONFLICT`, `AI_RESULT_INVALID`, `JOB_FAILED`.

## Related Workflow

`WF-005` Requirement, `WF-006` Matching, `WF-008` Proposal, `WF-011` Expiration, `WF-012` Recovery.

## Related Entity

Requirement, Matching Preference, Candidate Listing, Listing Offer, Match Result, AI Job, AI Result, Status History.

## Related AI Capability

`AI-005` Matching/ranking, `AI-006` search interpretation, `AI-007` confidence/validation.

