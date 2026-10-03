# REL-002 R3-D Runtime Activation Design

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-400 |
| Version | v0.1 |
| Status | DRAFT |
| Owner | Architecture Owner / Operations Owner |
| Baseline | 9bdc76f05ced3e4cd2237c403336275e702710e7 |

## 승인 근거와 범위

사용자의 R3-D REQUIRED WORKER / ACTIVATION LIFECYCLE AO DECISION은 초기 inventory의 두 blocker를 해소하고 구현 재개를 승인했다. 초기 판단과 이후 검증은 [completion report](../reviews/REL002_R3D_COMPLETION.md)에 시간순으로 보존한다. 이전 [R3-C4 Final evidence](../reviews/REL002_R3C4_FINAL_COMPLETION.md)의 당시 activation hold는 변경하지 않는다.

## Explicit required worker manifest

```ts
RequiredWorkersManifestV1 {
  schemaVersion: 1,
  workers: []
}
```

현재 승인된 required worker count는 0이다. Production entry는 이 값을 명시적으로 전달하며 factory에는 missing-input default가 없다. missing/malformed/unsupported version/unknown field/non-empty manifest는 FAIL-CLOSED다. auto-discovery, registry-order 추론, API-017 Staging SQLite one-shot runtime 승격은 없다. future worker 추가는 AO-approved manifest amendment와 dependency-safe order, exact owner, start/stop/drain, rollback/readiness/resource 계약을 먼저 요구한다.

## Activation ownership and order

[ProductionRuntimeActivation](../../apps/api/src/production-runtime-activation.ts)은 top-level lifecycle boundary다. 기존 [bootstrap engine](../../apps/api/src/production-bootstrap-engine.ts)은 이 boundary의 bootstrap resources와 최종 pool 정리를 수행하고, [Production executable](../../apps/api/src/production-main.ts)은 signal lifecycle을 수행한다. listener/worker에는 pool closure authority를 전달하지 않는다.

earlier bootstrap → 기존 pre-listener chain READY → explicit worker manifest 검증 → 기존 aggregate readiness/Session/child preparation → listener START → 기존 child host activation → required workers in approved manifest order → runtime READY다. 현재 Production 경로는 worker starter를 정확히 0개 전달하며 legacy startWorkers seam은 계속 fail-closed다. non-empty starter seam은 rollback fixture 검증에만 사용하며 Production manifest가 이를 허용하지 않는다.

Production entry, bootstrap facade, engine과 activation instance는 각 composition root의 재진입을 pool/signal/listener 생성 전에 거부한다. CREATED → STARTING → READY → STOPPING → STOPPED의 single-use semantics이며 자동 retry/restart가 없다. 새 process/composition은 명시적 caller 실행과 모든 startup 검증을 다시 요구한다.

## Partial rollback and graceful shutdown

- partial start 실패: 성공한 worker를 reverse start order로 stop → listener close → reverse child/UoW/Identity cleanup → top-level pool close.
- listener start 실패: partial listener handle을 bounded close하고 worker를 시작하지 않는다.
- normal shutdown: readiness NOT_READY와 stopRequested로 signal reentry를 neutralize → listener ingress stop → worker reverse drain/stop → remaining listener handles close → reverse resource cleanup/final pool close → 기존 executable finally에서 signal hooks unregister.
- repeated close는 하나의 Promise를 공유하며 pool close도 한 번만 시도한다. cleanup 실패는 다음 handle의 정리를 중단하지 않는다.

top-level cleanup은 25초 deadline을 공유한다. remaining handles마다 시간을 예약하여 hung child가 최종 pool close 시도까지 막지 못하도록 한다. existing main의 30초 terminal shutdown deadline은 유지한다. timeout은 성공을 의미하지 않으며 best-effort cleanup 이후 SHUTDOWN_FAILED를 반환한다. underlying stop이 취소되는 것으로 표현하지 않는다. failing worker의 반환 전 내부 partial handles는 그 starter의 own cleanup 계약을 요구한다.

## Failure normalization

기존 public PRODUCTION_STARTUP_UNAVAILABLE taxonomy를 유지하면서 safe reason을 부가한다: PRE_LISTENER_NOT_READY, WORKER_MANIFEST_INVALID, LISTENER_START_FAILED, WORKER_START_FAILED, ACTIVATION_CLEANUP_FAILED, DUPLICATE_ACTIVATION, SHUTDOWN_FAILED. private child error/config values는 전달하지 않는다. readiness/HTTP는 기존 fixed allowlist를 유지한다.

## Verification and classification

explicit empty/missing/non-empty manifest, zero worker calls, actual disposable local HTTP READY/bind failure/close race, duplicate activation, signal/repeated shutdown, reverse fixture rollback, hung cleanup와 single pool close를 검증한다. required secrets와 Human/Service gate semantics 및 historical migrations/fingerprint는 유지한다.

RUNTIME_ACTIVATION READY는 local tests/composition 구현에 대한 분류다. 실제 Production readiness는 NOT_VERIFIED이고 deployability는 BLOCKED다. schema/ACL/migration/PG adapter 변경이 없어 disposable PostgreSQL은 N/A다. actual Production/Railway/Supabase access, deploy/push/commit은 수행하지 않는다.
