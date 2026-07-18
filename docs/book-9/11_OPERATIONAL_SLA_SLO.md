# Operational SLA and SLO

| 항목 | 값 |
|---|---|
| Document ID | DOC-OPS-012 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Service Owner / Business Owner / Operations Owner |
| 기준일 | 2026-07-14 |

## SLA/SLO distinction

SLO는 internal reliability target, SLI는 measurement, SLA는 approved external/contractual commitment다. 현재 플랫폼은 internal-first이므로 아래 수치는 모두 architecture `ASSUMPTION` SLO이며 SLA가 아니다.

## Availability targets

| Service class | Provisional SLO | Measurement window |
|---|---:|---|
| Core authenticated read/workflow API and UI | 99.5% | calendar month |
| Authority/audit write path | 99.5% availability with fail-closed correctness | calendar month |
| Async Tier 1 jobs | 95% start within 5 minutes; 99% terminal within capability target | rolling 30 days |
| Search/report/projection | 99.0% | calendar month |
| External AI/connector/publication | measured separately; no internal guarantee beyond fallback/reconciliation | provider + monthly |

Planned maintenance inclusion/exclusion은 approved measurement policy 전 `OPEN DECISION`이다. Security fail-closed denial은 availability error가 아니라 correct control outcome로 분리하되 user-impact를 보고한다.

## Response targets

Common read p95 2s, governed write acknowledgement p95 3s, search/job acknowledgement p95 3s를 provisional target으로 사용한다. Queue/provider/external completion은 capability별 duration과 freshness를 별도 측정한다. Error, timeout, retry와 stale response를 success latency에서 제외하여 왜곡하지 않는다.

## Recovery targets

| Tier | RPO | RTO | Continuity target |
|---|---:|---:|---|
| Tier 0 authority/audit | 15 minutes | 4 hours | unsafe write suspended; evidence/authority integrity first |
| Tier 1 core workflow | 1 hour | 8 hours | bounded read/manual intake where safe |
| Tier 2 rebuildable projection | 24 hours | 72 hours | degraded/manual search/report |

모두 `ASSUMPTION`; DR/restore test evidence와 business approval로 검증해야 한다.

## Operational indicators

- availability/success/latency by service/capability/environment.
- backlog age/depth, retry/dead-letter와 time-to-terminal.
- data/evidence freshness, backup age/integrity, achieved RPO/RTO.
- publication unknown/failure/reconciliation and external dependency health.
- failed authentication, deny/export/privileged event와 security logging health.
- incident MTTD/MTTA/containment/recovery, change failure/rollback와 release success.
- business continuity manual backlog와 post-recovery reconciliation.

## Measurement principles

SLI는 numerator/denominator, source, query/version, owner, window, exclusions와 data gap을 문서화한다. Accepted/queued ≠ completed, internal command ≠ external publication, read success ≠ fresh/correct data를 유지한다. Monitoring outage는 success로 간주하지 않는다.

## Error budget and action

SLO gap/error budget burn은 release/change pace, capacity, reliability work와 incident review에 반영한다. Security/privacy/authority correctness는 error budget으로 교환할 수 없는 hard guardrail이다. Repeated breach는 owner, problem record, remediation/date와 Business review를 요구한다.

## OPEN DECISION

Final SLO/SLA, business hours/maintenance, capability completion/freshness targets, alert burn rates와 contractual remedies는 measured baseline과 user/partner approval 후 확정한다.

