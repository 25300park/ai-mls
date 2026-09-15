# REL-001 Phase 3G-A API-017 Handler Side-Effect Containment Decision

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-158 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner / Security Owner / Operations Owner |
| 기준일 | 2026-09-15 |
| 기준 commit | `035acb2257338e60e91f0a3c4f788a4ff494c6a8` |
| Decision | `DEC-152` (`APPROVED`) |

## 1. Decision

API-017의 기존 `BoundedJobHandler`는 별도 실행 프레임워크로 교체하지 않고 `CAPABILITY_LIMITED_HANDLER_BOUNDARY`로 진화한다. 정본 개념은 다음과 같다.

```text
handler(canonicalJob, capabilityContext)
```

- `canonicalJob`은 durable Job에서 파생된 기존 immutable `JobExecutionContext`이다.
- `capabilityContext`는 handler identity별로 닫힌 typed interface이다.
- 공식 Staging composition은 등록된 handler에 해당 context만 제공한다.
- `Record<string, unknown>`, service locator, dependency container 또는 임의 object bag은 금지한다.
- 기존 `JobExecutionRegistry`, `JobExecutionRuntime`, `DurableJobStore`와 one-shot dispatcher를 재사용한다.

`DEC-152`는 Architecture Owner closeout으로 `APPROVED`되었다. 이 문서는 Production interface 변경을 승인하지 않으며 Phase 3G는 별도 resume authorization 전까지 `BLOCKED`이다.

## 2. Ownership boundary

Runtime은 durable Job 조회, live admission, CAS, idempotency, failure normalization, audit intent와 completion persistence를 계속 소유한다. Handler는 지정된 domain/application operation만 수행하고 Job lifecycle, authority, audit materialization 또는 retry를 소유하지 않는다.

세 handler의 정본 mapping은 유지한다.

| Job type | Handler identity |
|---|---|
| `AI_LISTING_PARSE` | `AI-001` |
| `AI_REQUIREMENT_PARSE` | `AI-004` |
| `AI_MATCHING` | `AI-005` |

## 3. In-process containment claim

Phase 3G-A는 OS-level sandbox 또는 process isolation을 주장하지 않는다. Node.js global primitive는 물리적으로 존재할 수 있으므로 canonical compliance는 두 조건을 모두 요구한다.

1. 공식 capability context에 prohibited capability가 없다.
2. 승인될 실제 handler source와 tests가 prohibited global을 직접 사용하지 않음을 입증한다.

현재 기준선에는 세 identity에 대응하는 Production `BoundedJobHandler` 구현체가 없다. 따라서 세 mapping은 contract-level `CONTAINMENT_READY`이나 implementation validation은 `0/3`이고 Staging runtime은 `NOT_READY`이다.

## 4. Execution lifetime

Handler invocation은 explicit, one-shot, bounded이다. 반환 시점 이후 지속되는 detached promise/task, recurring timer, hidden loop 또는 handler-owned worker는 허용되지 않는다. `RetryAsSuccessor`는 `MANUAL ONLY`이며 DEC-152는 scheduling semantics를 추가하지 않는다.

## 5. Failure behavior

Prohibited capability 요청, undeclared capability 접근, capability identity mismatch 또는 direct global dependency 검출은 모두 `FAIL_CLOSED`이다. Generic fallback, environment fallback, implicit timer와 dynamic resolution은 없다. 한 handler라도 containment validation을 통과하지 못하면 runtime readiness는 `NOT_READY`이다.

## 6. Preserved decisions

- Phase 3C durable Job ownership과 CAS/idempotency
- Phase 3D closed registry와 one-shot runtime
- Phase 3E concurrency/recovery hardening
- Phase 3F API-016 audit integration
- DEC-151의 `7/7` mapping과 claim/heartbeat `NOT_APPLICABLE`
- in-process Staging composition

New transport, process protocol, queue, scheduler, Job type, lifecycle state, principal/role, Audit event와 external provider/network는 모두 `0`이다.
