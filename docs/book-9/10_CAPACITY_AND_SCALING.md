# Capacity and Scaling

| 항목 | 값 |
|---|---|
| Document ID | DOC-OPS-011 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Operations Owner / Architecture Owner |
| 기준일 | 2026-07-14 |

## Growth assumptions

`ASSUMPTION`: MVP는 internal team, moderate source intake와 bounded publication workload를 지원하며 cooperative broker network/enterprise multi-organization은 `POST-MVP`다. Exact user/listing/request/storage volumes와 growth rate는 baseline measurement 전 확정하지 않는다.

## Capacity dimensions

Concurrent users/sessions, API request/latency, intake/raw attachment size, canonical entity/history growth, search/index size, AI/job queue throughput/age, connector/publication delivery, audit/log/backup volume, export와 recovery throughput을 별도로 측정한다.

## Scaling principles

1. correctness, authority, privacy와 audit를 capacity 때문에 완화하지 않는다.
2. observed bottleneck, forecast와 load/recovery evidence에 기반해 scale한다.
3. stateless access/core replica, worker concurrency, data read/projection, object/backup와 integration isolation을 logical options로 둔다.
4. per-tenant/provider/source/job/user limits와 backpressure로 noisy workload를 격리한다.
5. modular monolith를 기본으로 하고 independent ownership/scale/release/failure need가 반복 입증될 때만 service extraction을 review한다.

## Performance objectives

다음은 `ASSUMPTION` user-experience objective이며 Book 10 측정/승인 전 SLO가 아니다.

| Interaction | Provisional objective |
|---|---|
| common read/list/detail | p95 server response ≤ 2 seconds under normal load |
| governed write acknowledgement | p95 ≤ 3 seconds; async completion은 별도 |
| search/matching request acknowledgement | p95 ≤ 3 seconds; result completion target capability-specific |
| privileged decision | no latency optimization may skip reauth/validation/audit |
| queue start delay | Tier 1 operational jobs p95 ≤ 5 minutes when healthy |

External AI/connector/publication latency를 internal response와 분리 측정하고 accepted/queued를 completion으로 계산하지 않는다.

## Resource planning

30/90/365-day trend, peak/seasonality, planned release/integration, retention/backups와 recovery headroom을 forecast한다. Critical resource에는 normal peak 이후 minimum 30% headroom을 `ASSUMPTION`으로 하며 actual saturation/error budget에 따라 조정한다.

## Backpressure and degradation

Queue/admission limit, rate/concurrency/size limit, lower-priority pause, batch/schedule 조정과 read-only/manual fallback을 사용한다. Verification/approval/publication/export를 bulk performance 목적으로 자동화하거나 authority를 생략하지 않는다.

## Scaling change gate

Metric/evidence, risk, consistency/security/privacy impact, test/recovery/rollback, cost/owner와 success criteria를 change record에 포함한다. Scaling 후 latency/error/backlog/data integrity/authority/audit와 cost를 검증한다.

## OPEN DECISION

Workload baseline, exact limits/quotas, storage forecast, performance SLO, headroom와 service extraction trigger는 production evidence 후 정한다.

