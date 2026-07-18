# Performance Tests

| 항목 | 값 |
|---|---|
| Document ID | DOC-TEST-009 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Performance Test Owner / Operations Owner |
| 기준일 | 2026-07-15 |

## Baseline model

Candidate/config/environment/data size, concurrency/rate/duration, dependency behavior, warm/cold state와 metric source를 고정한다. Phase 10 SLO는 `ASSUMPTION`이므로 result가 validation input이지 contractual claim이 아니다.

## Search

Common/advanced/global query, filter/sort/pagination, authorized field masking, index freshness와 result correctness를 volume/concurrency별 측정한다. p95 target 2s assumption과 timeout/degraded behavior를 평가한다.

## Matching

Requirement/candidate size, hard filters, AI/deterministic phases, queue delay/throughput, rerun/stale result와 ranking correctness를 측정한다. Faster result가 hard constraint를 위반하면 fail이다.

## Publication

Approval-to-command acknowledgement, idempotent delivery, target rate limit, timeout/retry/reconciliation/backlog와 duplicate/false success zero guardrail을 평가한다.

## Background jobs

Queue depth/age, lease/concurrency, throughput, retry/backoff/dead-letter, worker loss, priority/backpressure와 recovery를 평가한다. Tier 1 start p95 5-minute assumption을 측정한다.

## Scalability

Load, stress, spike, soak, capacity limit, 30% headroom assumption, scale up/down와 failure isolation을 검증한다. Security/audit/validation이 load에서 disable되지 않아야 한다.

## Acceptance

Latency/throughput/error/saturation/backlog/freshness/correctness를 함께 보고하고 missing telemetry나 invalid dataset은 pass가 아니다. Bottleneck, capacity forecast와 remediation/next baseline을 기록한다.

