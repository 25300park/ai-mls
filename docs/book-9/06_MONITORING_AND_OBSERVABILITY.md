# Monitoring and Observability

| 항목 | 값 |
|---|---|
| Document ID | DOC-OPS-007 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Operations Owner / Security Operations Owner |
| 기준일 | 2026-07-14 |

## Observability principles

Health, metrics, logs, traces/correlation와 audit/business state를 역할에 맞게 분리하되 end-to-end correlation으로 연결한다. Observability data는 privacy-minimized이며 canonical business/audit record를 대체하지 않는다.

## Health monitoring

| Layer | Signals | Failure posture |
|---|---|---|
| Access/UI | availability, error/load, auth reachability | safe error; no cached authority write |
| Core/API | request success/latency/saturation, authorization/audit dependency | privileged write fail closed |
| Worker/queue | queue age/depth, lease, attempts, dead-letter | isolate job; backlog visible |
| Data/object | availability, latency, capacity, integrity/backup | write stop or read-only safe mode |
| AI/provider | availability, latency, validation/fallback | manual/deterministic path; no fabricated result |
| Connector/publication | contract health, checkpoint, delivery/reconciliation | suspend boundary; no false published |
| Security/operations | login/deny/export/anomaly, log pipeline, secret/key expiry | contain/escalate by risk |

## Application metrics

Request rate/error/latency, concurrency, job throughput/age/retry, data/object capacity, cache/projection freshness, dependency success/timeout, release/config version와 resource saturation을 측정한다. Cardinality와 personal data를 제한한다.

## Business metrics

Intake validation/failure, AI review backlog, duplicate/verification/permission/approval age, match freshness, publication unknown/failure/reconciliation, expiry/reverification와 exception recovery를 canonical status 기반으로 집계한다. Metric은 approval/quality truth를 단독 판단하지 않는다.

## Alerting principles

Alert는 user/business/security impact, urgency, actionable owner, threshold/window, runbook, dependency, dedup/suppression, escalation와 resolution evidence를 가진다. Symptom과 root-cause alert를 구분하고 alert storm을 제한하되 critical failure를 suppress하지 않는다.

## Operational dashboards

| Dashboard | Audience | Required content |
|---|---|---|
| Service health | Operations | availability, latency/error, dependencies, releases/incidents |
| Workflow health | Domain/Manager | backlog age, failure, freshness, blocked gates |
| Jobs/integrations | Operations/AI/Integration | queue/retry/dead-letter, provider/connector/reconciliation |
| Security/privacy | Security/Privacy | auth/deny/export/privilege/events, log health, access exception |
| Resilience | Operations/Data/Security | backup/integrity/test, capacity, RPO/RTO readiness |

Dashboards는 scoped role/access를 적용하며 raw contact/source/secret를 표시하지 않는다.

## Correlation and sampling

Request/correlation/job/operation/release/change/incident ID를 연결한다. Error/privileged/publication/recovery evidence는 필요한 범위에서 sampling 제외하고, high-volume diagnostic data는 privacy/cost/diagnostic value에 따라 bounded sampling한다.

## Observability failure

Mandatory audit/log/monitoring이 불확실하면 privileged action을 fail closed하거나 approved bounded buffer와 incident escalation을 적용한다. Monitoring blind spot은 itself alert/incident이며 silent success로 간주하지 않는다.

