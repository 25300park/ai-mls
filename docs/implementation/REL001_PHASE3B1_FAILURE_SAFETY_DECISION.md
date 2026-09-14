# REL-001 Phase 3B.1 API-017 Failure Safety Decision

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-137 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security Owner / Audit Owner / API Owner |
| 기준일 | 2026-09-14 |

## 1. Decision

Phase 3B의 nonblank-only `failureCode` 경로는 승인되지 않는다. Phase 3C가 구현 승인을 받는 경우 failure path는 반드시 아래 단방향 경계를 사용해야 한다.

```text
raw/internal failure
→ trusted internal mapper
→ closed normalized classification
→ immutable safe evidence reference
→ API-017 state/audit intent
```

Caller 또는 public HTTP body는 normalized classification, retryability, category, evidence ID를 작성할 수 없다.

## 2. Closed normalized vocabulary

| Classification | Meaning | Retry eligibility |
|---|---|---|
| `DEPENDENCY_UNAVAILABLE` | approved dependency가 authoritative result를 제공하지 못함 | eligible only after current revalidation and manual successor authorization |
| `JOB_RESULT_INVALID` | result가 canonical validation을 통과하지 못함 | not eligible |

두 값은 frozen API-017 Error Conditions에서 재사용한다. `TRANSIENT`, `PERMANENT`, provider-specific code 또는 임의 메시지를 새 vocabulary로 만들지 않는다.

Unknown mapper input은 classification이나 evidence를 저장하지 않고 현재 mutation을 fail closed한다. raw input을 `JOB_RESULT_INVALID`로 조용히 치환하지 않는다.

## 3. Safe evidence reference

Safe reference는 API-017이 생성한 opaque immutable identity, normalized classification, `jobId`, attempt, source chronology와 correlation만 결속한다. 다음은 포함하지 않는다.

- raw exception message 또는 stack
- SQL/SQLite/database diagnostic
- filesystem/database path
- secret, credential, token, authorization header
- raw provider/model response
- prompt 또는 chain-of-thought
- caller-authored category, retryable flag 또는 evidence ID

길이/문자열 형식의 임의 수치를 이 문서에서 만들지 않는다. API/transport parser의 이미 승인된 공통 bounds를 적용하고, 그 bounds로 안전성이 입증되지 않으면 입력을 거부한다.

## 4. Trust and atomicity

Handler는 typed internal outcome만 mapper에 전달한다. Mapper result는 closed vocabulary membership을 검증하고 새 immutable safe reference를 구성한다. Job failure state, evidence reference, command idempotency와 enriched audit intent는 같은 API-017 owner-local transaction에서 commit한다. 어느 하나라도 실패하면 모두 rollback한다.

Retry eligibility는 safe classification과 별개로 current authority, tenant/scope/purpose, predecessor version, deadline, downstream eligibility와 승인 policy를 다시 검사한다. `DEPENDENCY_UNAVAILABLE` 자체는 retry authority가 아니다.

## 5. Required future assertions

Phase 3C가 승인될 경우 최소한 caller classification forgery, unknown value, raw diagnostic/stack/path/secret, unsafe nested result, restart persistence, audit projection, conflicting replay와 zero-partial-mutation을 RED로 증명해야 한다. 현재 문서는 Production/Test 구현 또는 통과를 주장하지 않는다.

Failure Safety decision status는 `PASS_DECISION_DEFINED`다. 실제 Production verification은 `NOT_STARTED`다.
