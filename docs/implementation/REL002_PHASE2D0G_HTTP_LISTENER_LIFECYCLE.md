# REL-002 Phase 2D-0G HTTP Listener Lifecycle

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-341 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준 Main | `aff2b1a1377faba75b30e78faede913a130266ba` |

## 1. Owner

Canonical Production runtime executable/composition boundary가 다음을 단독 소유한다.

- one Node HTTP server creation
- exact Railway `PORT` bind
- closed route registration
- listener start/close
- operational readiness state
- shutdown ordering

API-014와 API-015 child roots는 handler 및 application/persistence lifecycle만 소유한다.

## 2. Startup order

```text
raw configuration
-> typed Production configuration validation
-> identity/secret/readiness gate
-> PostgreSQL pool and required persistence readiness
-> ProductionBootstrapContext
-> construct all child roots
-> compose closed shared route table
-> bind one listener
-> activate required child runtimes and start workers
-> mark READY
```

Listener bind 전 조건 중 하나라도 실패하면 listener count는 `0`, readiness는 `NOT_READY`다. API-014/015가 independently `listen()`하는 경로는 Production에서 금지한다.

## 3. Shutdown order

1. external and runtime readiness를 `NOT_READY`로 전환한다.
2. 새 HTTP traffic 수락을 중지한다.
3. shared listener를 close하고 bounded active request를 종료한다.
4. workers와 child runtimes를 역순으로 close한다.
5. Session/UoW, identity lease, PostgreSQL pool을 역순으로 close한다.
6. 전체 과정은 기존 30초 bound 안에 끝나야 하며 rejection/timeout은 abnormal non-zero termination으로 끝난다.

**Pre-Phase 2D-0H historical evidence:** 당시 bootstrap cleanup stack은 reverse cleanup 때문에 `workers -> listener -> roots -> Session -> identity authority -> pool`로 실행됐다. Phase 2D-0H는 pure LIFO 의존을 제거하고 canonical `listener -> workers -> roots -> Session -> identity authority -> pool` 순서를 구현했다. Listener close는 idempotent하며 cleanup failure는 exhaustive cleanup 뒤 상위 executable에 전파된다.

## 4. `/readyz`

- 초기값 및 shutdown 시작 즉시 `NOT_READY`
- required roots construction, listener bind 및 runtime/worker activation이 성공한 뒤에만 `READY`
- `GET`/`HEAD`만 허용
- fixed allowlist body만 사용
- business authorization이나 tenant data를 읽지 않음
- root failure 또는 listener failure를 `READY`로 숨기지 않음

## 5. Failure behavior

Route collision, duplicate listener, invalid handler 및 bind failure는 worker/provider side effect와 READY 전환 없이 fail closed한다. Ratified bind-before-activation 순서에서 child activation failure가 발생하면 이미 bind된 `NOT_READY` listener를 먼저 close하고 worker/provider side effect를 `0`으로 유지한 뒤 roots/resources를 정리한다. Cleanup 오류는 나머지 cleanup을 중단하지 않되 최종 process outcome을 성공으로 바꾸지 않는다.

## 6. 관련 문서

- [Same-Listener Design](REL002_PHASE2D0G_SAME_LISTENER_COMPOSITION_DESIGN.md)
- [Phase 2D-0F Resume Plan](REL002_PHASE2D0G_PHASE2D0F_RESUME_PLAN.md)
