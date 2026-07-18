# Operation Runbook

| 항목 | 값 |
|---|---|
| Document ID | DOC-OPS-006 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Operations Owner |
| 기준일 | 2026-07-14 |

## Purpose

Logical recurring/emergency operation과 owner/evidence/escalation을 정의한다. 이는 executable command runbook이 아니며 실제 procedure는 approved implementation runbook으로 확장해야 한다.

## Operational responsibilities

| Role | Responsibility | Must not do |
|---|---|---|
| Operations Owner | service health, jobs, capacity, release, backup/recovery coordination | business approval 생성 |
| On-call Operator | alert triage, containment, escalation, evidence capture | unapproved permanent change |
| Release Owner | candidate, approval, deployment, validation/rollback evidence | self-approve high-risk release |
| Data/Backup Owner | backup integrity, restore test, data consistency | bypass Privacy/Legal Hold |
| Security/Privacy Owner | privileged access, event/incident, secret/classification review | use incident access for unrelated purpose |
| Domain Owner | business metric/impact, workflow recovery/reconciliation | operations credential 사용 |
| Integration/AI Owner | provider/connector health and contract | fabricate success or auto-approve |

## Daily checklist

- critical service/dependency health, error budget와 active incident 확인.
- failed/stuck/aging job, retry/dead-letter, publication `UNKNOWN/FAILED/SUSPENDED`와 reconciliation backlog 확인.
- backup completion/integrity signal과 mandatory audit/log pipeline 확인.
- authentication/authorization/export/security anomaly와 expiring credential/certificate/key notice 확인.
- business guardrail: intake/verification/publication freshness, approval queue, notification failure 확인.
- finding은 owner, severity, due/recovery action과 evidence로 기록한다.

## Weekly checklist

- SLO trend/error budget, top failures/latency, backlog age와 external dependency performance review.
- retry pattern, poison job, capacity headroom, storage growth와 log/backup retention review.
- upcoming release/configuration/maintenance/secret rotation와 change calendar 검토.
- open incident/problem, accepted risk, access exception와 stale operational task review.

## Monthly checklist

- availability/response/recovery SLO, service tier와 business continuity metrics 보고.
- privileged/service access, environment drift, configuration/feature flag와 export review.
- backup restore sample/integrity evidence, recovery/DR readiness와 runbook completeness review.
- capacity forecast, cost/resource trend, data lifecycle, connector/AI provider risk review.
- unresolved finding을 CR/Risk/Decision/Incident와 next owner/date에 연결한다.

## Emergency runbook

1. alert/report를 acknowledge하고 Incident Owner/severity/scope를 설정한다.
2. safety: publication/export/connector/credential 등 affected path를 fail closed/contain한다.
3. evidence/time/correlation을 보존하고 Security/Domain/Business owner를 호출한다.
4. approved recovery/rollback/manual continuity path를 선택한다.
5. health, data, authority, external effect와 audit를 검증한다.
6. communication, monitoring observation와 post-incident/change review를 완료한다.

Emergency는 human approval/publication/privacy/audit bypass를 허용하지 않는다.

## Maintenance runbook

Scope, risk, affected service/workflow, owner, window, user communication, backup, rollback, monitoring와 exit criteria를 사전 승인한다. Maintenance mode는 read-only/degraded behavior를 명확히 표시하고 pending write를 성공으로 처리하지 않는다. 종료 후 backlog/reconciliation, security, SLO와 data integrity를 확인한다.

## Handover and evidence

Shift/on-call handover는 active incident/change, degraded service, risky backlog, release/maintenance, expiring access와 unresolved alerts를 포함한다. 모든 checklist 실행은 time, operator, result, exception, follow-up과 OPS/SEC ID를 기록한다.

