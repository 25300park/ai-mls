# REL-002 R3-F Restart / Shutdown / Rollback 검증

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-402 |
| 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Operations |
| Baseline | b84dbaf48271e70b02b8f9b11c5026b6f4271b75 |

## 목적과 기존 계약

[R3-D](REL002_R3D_RUNTIME_ACTIVATION_DESIGN.md)의 single-use runtime/composition 계약과 [R3-E](REL002_R3E_RUNTIME_OBSERVABILITY_DESIGN.md)의 attempt별 evidence를 검증한다. runtime source, lifecycle 의미, migration, schema, ACL을 변경하지 않는다. [완료 보고서](../reviews/REL002_R3F_COMPLETION.md)에서 결과와 한계를 기록한다.

## Ownership inventory

| 정확한 경로 | 계약과 owner |
|---|---|
| [production-main.ts](../../apps/api/src/production-main.ts) | Production entry가 SIGINT/SIGTERM 등록·해제, final shutdown, 30초 terminal deadline과 exit failure를 소유한다. WeakSet은 같은 dependency composition 재진입을 거부한다. |
| [production-bootstrap.ts](../../apps/api/src/production-bootstrap.ts) | canonical Production facade와 single-use bootstrap authority. |
| [production-bootstrap-engine.ts](../../apps/api/src/production-bootstrap-engine.ts) | startup order, activation과 reverse resource cleanup, 최종 shared pool close의 owner. |
| [production-runtime-activation.ts](../../apps/api/src/production-runtime-activation.ts) | single-use activation이 ingress/listener와 worker 역순 stop을 소유한다. RequiredWorkersManifestV1은 explicit empty이며 fixture만 non-empty starters를 사용한다. |
| [production-secret-reference-resolver.ts](../../apps/api/src/production-secret-reference-resolver.ts) | earlier bootstrap의 PG_PRODUCTION_POOL 생성 경계. child는 pool을 빌리며 physical pool을 새로 만들거나 final close하지 않는다. |
| [production-readiness-http.ts](../../apps/api/src/production-readiness-http.ts) | 같은 listener의 /livez LIVE, /readyz READY/NOT_READY. top-level readiness owner가 shutdown 요청 즉시 NOT_READY로 전환한다. |
| [production-runtime-observability.ts](../../apps/api/src/production-runtime-observability.ts) | process-local immutable attempt snapshots; 새 instance에 새 runtimeAttemptId. terminal attempt를 reset하거나 persistence로 승격하지 않는다. |

## Restart model

RESTART_MODEL=FRESH_PROCESS. SAME_PROCESS_RESTART=NOT_SUPPORTED_BY_DESIGN는 같은 runtime/composition의 재활성화를 뜻한다. 종료한 instance를 reset/reuse하지 않는다. 기존 계약은 fresh composition을 명시적으로 생성한 caller도 허용한다. 테스트는 같은 test process에서 독립 composition의 격리를 확인하고, 별도 Node child process 두 개의 정상 bootstrap/종료도 확인한다.

application은 clean shutdown과 bounded failure exit를 제공한다. 외부 Railway/container supervisor의 재실행 책임은 application의 자동 retry/restart가 아니다. 실제 supervisor 정책은 조회·구현·검증하지 않았으며 deployment-specific 결정은 이 검증에 필요하지 않다.

## Verification design

새 attempt는 NOT_READY로 시작하고 gate/activation 이후 READY가 된다. shutdown은 NOT_READY, STOPPED와 pool CLOSED를 기록한다. 이전 READY/FAILED snapshot은 새 attempt에 영향을 주지 않는다. listener failure, child activation failure와 schema failure는 final pool까지 rollback한다. worker fixture failure와 cleanup failure는 역순 stop 후 fresh activation에서 복구된다.

실제 local HTTP listener를 닫은 뒤 동일 port에 fresh composition이 bind하는 것을 확인한다. 실제 process signal hooks의 개수가 각 attempt 전후 동일하며 SIGINT/SIGTERM 반복 요청은 close를 중복 실행하지 않는다. 기존 hung-stop/timeout/duplicate activation tests를 유지한다.

## 한계와 범위

RESOURCE_LEAK_CHECK는 local socket rebind, process 종료, signal hook count, fixture close count 및 기존 timeout cleanup 검증 범위이다. 실제 PostgreSQL checked-out client 측정은 수행하지 않았다. bootstrap fixtures는 connect를 사용하지 않으며 real DB restart durability는 이번 단계의 주장에 포함되지 않는다. Disposable PostgreSQL=N/A: DB adapter/schema/readiness 변경 없음.

새 supervisor, timer, failure taxonomy, worker, DB pool 또는 evidence persistence를 추가하지 않는다. R3-G=NOT_STARTED. PRODUCTION_READINESS=NOT_VERIFIED. PRODUCTION_DEPLOYABILITY=BLOCKED. Production/Railway/Supabase mutation=0/0/0. Commit=NOT_CREATED. Push=NOT_PERFORMED.
