# REL-001 Phase 3B API-017 handler와 worker 구성 결정 검토

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-132 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Operations Owner / API Owner |
| 기준일 | 2026-09-14 |
| 기준 commit | `7f7661d791c6268204f2453f6a500e0553cbfab7` |

## 1. Handler 판정

`HANDLER_REGISTRY_READY=NO`, handler-backed job types는 `0`이다. [Phase 3A 인벤토리](REL001_PHASE3_API017_RUNTIME_INVENTORY_GAP_MATRIX.md) §3과 [JobService](../../modules/jobs/src/job-service.ts) 151–163·447–453행은 validation policy Map만 확인한다. allowlist가 unknown submit type을 거부하는 것은 실행 함수 매핑의 존재를 증명하지 않는다.

[Event and Job Architecture](../book-2/06_EVENT_AND_JOB_ARCHITECTURE.md)의 Job categories는 업무 분류이고 executable type/handler registry가 아니다. AI Job과 Retention Job도 entity/lifecycle 근거이지 등록된 handler가 아니다. 승인된 exact type-to-handler 행은 없으므로 type 이름, handler 이름, 새로운 capability를 만들지 않는다. `P3A-GAP-007=OPEN DECISION`이다.

향후 owner는 최초 지원 유형, exact input/result 계약, 권한/tenant/scope, downstream idempotency owner, 허용 handler와 unknown-type 거부 경계를 승인해야 한다. FEAT-022 advisory integration은 Phase 4에 남으며 이번 문서로 등록하거나 실행하지 않는다.

## 2. Phase 0 구성 유지

근거는 [Phase 0 topology](REL001_PHASE0_STAGING_RUNTIME_TOPOLOGY_DESIGN.md) §3–5·§8, `REL001-P0-GATE-001/005` 및 [Phase 0 lifecycle](REL001_PHASE0_STARTUP_LIFECYCLE_MATRIX.md) §2·§3·§6이다.

| 구성 후보 | 기존 승인 범위 | 현재 준비도 | 차단 이유 |
|---|---|---|---|
| `Job / Advisory Worker Process` | 조건부 목표 process | `NOT_READY` | 기존 port만으로 API-017 durable claim/result/lease 공유와 API-016 evidence 연결을 증명하지 못함 |
| bounded in-process Staging fallback | Platform Host 안의 bounded worker와 기존 artifact identity 유지 | `TOPOLOGY_APPROVED / SEMANTICALLY_BLOCKED` | identity/lifecycle/handler/audit/store 계약이 닫히지 않아 실행 불가 |
| 전체 worker 구성 | 위 승인 경계 안에서만 구성 | `WORKER_COMPOSITION_READY=NO` | fallback의 topology 승인은 semantic closure를 대체하지 않음 |

새 HTTP, RPC, queue, message bus, internal transport, public route 또는 service principal을 추가하지 않는다. Worker가 Core/Audit/Jobs 내부 store를 직접 공유하는 방식으로 port 증명을 우회하지 않는다. API-017은 job truth, API-016은 audit truth, FEAT-022는 advisory truth를 소유한다. fallback도 기존 계약으로 표현되지 않으면 AO amendment가 필요하며 중단한다.

## 3. 권한·시작·종료 경계

Worker는 privileged principal이 아니며 human Session을 execution identity로 재사용할 수 없다. exact job/attempt/lease/tenant/scope/allowed-work binding의 출처가 미정이다. lease duration, heartbeat cadence, timeout, retry defaults를 설정하지 않는다. scheduler의 restrictive 원칙이 자동 retry 허가는 아니다.

| 경계 | 기존 요구 | 현재 판정 |
|---|---|---|
| 설정/시작 | 명시적 Staging 설정, owner-local durable 경로·integrity, identity와 API-016 evidence 의존성 검증 | API-017 runtime 구성·probe 미구현으로 `NOT_READY` |
| claim/execution | 모든 hard dependency와 등록된 handler·실행 결속 확인 뒤에만 허용 | 현재 claim/execution 금지 |
| shutdown | `NOT_READY` 전환, 새 submission/claim 중단, 허용된 bounded accepted work만 drain | 실행 가능한 timeout/lease 의미가 없어 구현 승인 아님 |
| evidence/store 종료 | 승인된 결과·증거를 owner UoW로 보존하고 역순 close | 불명확한 완료/취소/retry를 만들지 않음 |
| restart | durable truth/integrity 재구성, terminal 불변, blind retry 금지 | interrupted execution 계약 미정으로 `BLOCKED` |

`P3A-GAP-004/007/008/009/010/012`와 감사·실패 안전성 갭이 해소되기 전 Phase 3C/3D 구성 구현을 시작할 수 없다.

## 4. 연계

[결정 검토](REL001_PHASE3B_API017_CANONICAL_DECISION_CLOSURE.md) · [Operation 준비도](REL001_PHASE3B_API017_OPERATION_READINESS_MATRIX.md) · [감사 매핑](REL001_PHASE3B_API017_AUDIT_MAPPING_MATRIX.md) · [실패 안전성](REL001_PHASE3B_API017_FAILURE_SAFETY_CONTRACT.md) · [DRAFT RTM](REL001_PHASE3_API017_TRACEABILITY_MATRIX.md) · [보고서](../reviews/REL001_PHASE3B_API017_CANONICAL_CLOSURE_REPORT.md)
