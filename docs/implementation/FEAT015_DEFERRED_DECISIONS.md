# FEAT-015 Deferred Implementation Decisions

| 항목 | 값 |
|---|---|
| 버전 | v0.1 |
| 상태 | DRAFT |
| 원칙 | Architecture 의미를 바꾸지 않는 reversible implementation choice만 추천 |

## Decision Matrix

| Decision Topic | Available Options | Recommended Option | Reason | Architecture Impact | Security Impact | Operational Impact | Reversibility | Final Status |
|---|---|---|---|---|---|---|---|---|
| `DFD-001 Physical Payload Schema` | provider payload 직접 domain 사용; internal canonical DTO + provider mapping; opaque blob | versioned internal canonical DTO와 target adapter mapping 분리 | exact representation/checksum/field scope를 provider-neutral하게 유지 | None; `DEC-102/103/104` 준수 | allowlisted fields, classification/purpose metadata, raw contact 금지 | adapter별 validation 필요 | High | `RECOMMENDED_FOR_IMPLEMENTATION`; provider-specific schema `DEFERRED` |
| `DFD-002 Event Serialization` | plain JSON; canonical JSON; binary schema | TypeScript closed contract + deterministic canonical JSON checksum, transport encoding은 port 뒤에 격리 | 현재 dependency 추가 없이 identity/version/checksum test 가능 | None; physical event contract를 확정하지 않음 | integrity/checksum과 redaction 검증 가능 | schema evolution test 필요 | High | internal test format `RECOMMENDED`; production serialization `DEFERRED` |
| `DFD-003 Queue Use` | no queue; DB-backed command inbox/outbox; managed queue | logical dispatch port와 in-memory fake만 구현; production external effect 전 durable inbox/outbox 또는 동등 guarantee 승인 필수 | 현재 repository에 DB/queue가 없고 duplicate external effect를 허용할 수 없음 | None; topology 미결정 유지 | durable idempotency와 least-privilege worker 필수 | production delivery enablement gate | High before deployment | `DEFERRED` |
| `DFD-004 Event Bus Use` | direct in-process publish; transactional outbox + bus; managed event stream | domain service는 append-only journal port만 호출하고 bus는 선택하지 않음 | Event는 authority가 아니며 current implementation에 bus가 필요하지 않음 | None; `DEC-112` physical bus open 유지 | replay authorization와 classification enforcement 필요 | async fan-out/SLO 미정 | High | `DEFERRED` |
| `DFD-005 Event Store / Persistence` | in-memory; relational append tables; dedicated event store; document store | ports + deterministic in-memory test adapter; production은 relational transaction/outbox 후보를 별도 review | 기존 코드가 Map 기반이고 production DB가 deferred | production storage 선택 없음 | encryption, retention, legal hold, optimistic concurrency 필요 | backup/restore/DR adapter 필요 | Medium before migration | `DEFERRED`; test adapter `RECOMMENDED` |
| `DFD-006 Worker Topology` | API process inline; isolated worker; serverless job; shared worker pool | logical isolated service principal/worker boundary를 contract로 두고 test에서는 synchronous fake 사용 | API request와 external effect ownership을 분리하면서 제품을 고정하지 않음 | None; physical topology 미결정 | unique workload identity, no human authority, credential reference only | retry/backpressure/health 책임 분리 | High | `DEFERRED` |
| `DFD-007 Runtime SLO` | 즉시 numeric SLO; existing provisional operations assumptions; measure-first | correctness/security gate를 우선하고 numeric target은 production topology와 baseline measurement 후 승인 | 임의 latency/availability 목표가 architecture decision이 되는 것을 방지 | None | security check 생략 없는 latency 측정 | load/backpressure/timeout 기준은 배포 전 필요 | Medium | `DEFERRED`; measure-first `RECOMMENDED` |
| `DFD-008 Product / Library Selection` | 새 framework/ORM/queue SDK; Node built-ins; thin custom ports | core 구현은 현재 Node/TypeScript와 built-ins만 사용, adapter 제품은 별도 review | dependency/API surface 확대 없이 strict baseline 보존 | None | supply-chain surface 최소화; audit 선행 | adapter 선택 시 운영 runbook 필요 | High | core choice `RECOMMENDED`; products `DEFERRED` |

## Implementation Gates

### Gate A — Logical implementation

다음은 architecture 변경 없이 진행 가능하다.

- immutable domain contract와 transition engine
- repository/delivery/evidence/event/projection port
- in-memory deterministic test adapter
- logical `API-014` contract
- session-derived authorization, SoD, revalidation, idempotency, audit 및 safe error
- event/projection/replay/rebuild semantics test

### Gate B — Production persistence

다음 evidence가 승인되기 전에는 production persistence adapter나 migration을 만들지 않는다.

- selected storage product와 transaction guarantee
- aggregate/history/idempotency/attempt/event atomicity model
- encryption, retention, legal hold, backup/restore 및 recovery contract
- schema/version migration 및 rollback plan

### Gate C — External effect enablement

다음이 모두 승인되고 검증되기 전에는 실제 provider delivery를 disabled로 유지한다.

- durable command/attempt/external-effect idempotency
- approved target/connector instance와 credential reference
- isolated workload identity와 connector policy
- unknown/reconciliation callback/evidence contract
- retry/backpressure/timeout/kill-switch와 runtime SLO
- Gitleaks/dependency/security/operations gate PASS

## Explicit Labels

- **ASSUMPTION:** 다음 implementation increment는 기존 in-memory testing pattern을 사용하며 production deployment를 주장하지 않는다.
- **OPEN DECISION:** production DB, queue, event bus, event store, worker topology, provider adapter, serialization format 및 numeric runtime SLO.
- **POST-MVP:** provider-specific connector optimization, multi-provider fan-out, autonomous recovery, analytics-driven tuning. 이 항목은 FEAT-015 초기 구현 범위가 아니다.

## Change-Control Trigger

다음 선택이 필요하면 구현을 중단하고 Architecture Change Request 또는 승인된 implementation decision을 요구한다.

- Event/Projection/Worker/Connector에 business authority 부여
- canonical state, command, ID, target/channel 또는 lifecycle 의미 변경
- Approval/Verification/Permission 경계 우회
- one target/one channel binding 완화
- replay가 business decision, external side effect 또는 notification을 재생하게 하는 변경
- 새 RoleCode 또는 frozen authority 의미 변경

## Related Documents

- [Implementation Plan](FEAT015_IMPLEMENTATION_PLAN.md)
- [Traceability Matrix](FEAT015_TRACEABILITY_MATRIX.md)
- [Task Breakdown](FEAT015_TASK_BREAKDOWN.md)
- [Test Strategy](FEAT015_TEST_STRATEGY.md)
- [Phase 13-1 Report](../reviews/PHASE13_1_IMPLEMENTATION_PLANNING_REPORT.md)
