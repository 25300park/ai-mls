# F17-C Durable Publication Execution & External Side-Effect Ordering Design

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-020 |
| 문서 버전 | v0.2 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner / Development Owner |
| 기준일 | 2026-08-30 |
| 승인 근거 | Architecture Owner — `APPROVE_F17_C_DURABLE_PUBLICATION_EXECUTION_DESIGN` |
| Brief | F17-C — Durable Publication Execution Foundation |

## 1. Objective

FEAT-015의 canonical `PublicationAggregate`, API-014, authorization 및 lifecycle 의미를 변경하지 않고 Publication 실행을 durable하게 저장한다. 외부 Provider 호출은 로컬 SQLite transaction과 원자적으로 묶을 수 없다는 사실을 명시하고, intent-first ordering, immutable receipt, stable external idempotency와 fail-closed ambiguity 처리를 통해 restart 후 blind resend를 금지한다.

이 문서는 F17-C Production 구현 전 필수 설계 review를 통과했다. Architecture Owner는 `DISPATCH_STARTED` 이후 authoritative receipt가 없으면 blind resend 없이 `RECONCILIATION_REQUIRED`로 처리하는 containment rule을 승인했다.

## 2. Canonical baseline and scope

적용 기준:

- AO-023 Publication Aggregate ownership
- AO-024 canonical Publication lifecycle
- AO-025 exact Target/Channel binding
- AO-027 closed API-014 surface
- AO-028 live revalidation
- AO-029 actor-level Segregation of Duties
- AO-030 idempotency/replay
- AO-031 reconciliation evidence
- 기존 `PublicationUnitOfWork`, `PublicationAggregate`, Delivery Attempt 및 `RECONCILIATION_REQUIRED`
- [F16-R1 durable SQLite pattern](F16_R1_DURABLE_ADMINISTRATION_PERSISTENCE_DESIGN.md)

포함 범위:

- `DurablePublicationUnitOfWork`
- aggregate snapshot/version, attempt, execution intent, immutable receipt, audit, event, idempotency 및 revision persistence
- external side-effect ordering과 crash ambiguity containment
- explicit database-path production composition과 fail-closed startup
- restart, concurrency, atomicity, replay 및 recovery-safety verification

제외 범위:

- API-014 operation/API ID 추가 또는 변경
- Publication lifecycle/state vocabulary 변경
- 실제 rbs-homes/외부 Provider 구현이나 credential 활성화
- Provider-specific canonical model
- F19 reconciliation resolution workflow
- Console mutation control
- F17-G 또는 후속 feature
- PostgreSQL, ORM, migration framework 또는 외부 dependency

## 3. Selected architecture

Production은 Node.js built-in `node:sqlite` 기반의 별도 `DurablePublicationUnitOfWork`를 사용한다. 기존 in-memory adapter는 test/development 전용으로 유지한다. Production composition은 명시적인 local database path가 없거나 memory database가 지정되면 startup을 중단하며 in-memory fallback branch를 갖지 않는다.

기존 `PublicationUnitOfWork` contract의 aggregate, idempotency, audit 및 event journal 역할은 유지한다. F17-C는 동일 transaction에 execution intent/dispatch journal/receipt를 stage할 수 있는 bounded persistence port를 추가한다. Application/API contract 또는 Domain authority를 추가하지 않는다.

`PublicationAggregate`만 lifecycle truth를 유지한다. Execution journal은 외부 side effect의 관측·ordering evidence이며 자체적으로 Publish authority나 Domain transition을 생성하지 않는다.

## 4. Durable storage model

SQLite logical schema는 다음 record를 저장한다.

- `publication_schema`: singleton schema version/compatibility metadata
- `publication_revisions`: `(tenant_scope_id, publication_id)`별 monotonic revision
- `publication_aggregates`: exact identity, aggregate/publication/effective version 및 canonical snapshot JSON
- `publication_attempts`: aggregate에 속한 immutable attempt identity와 operation/binding reference
- `publication_execution_intents`: command/attempt/fingerprint/external idempotency key를 담는 immutable intent
- `publication_dispatch_events`: intent별 append-only `PREPARED`, `DISPATCH_STARTED`, `RESULT_OBSERVED`, `OUTCOME_UNPROVEN` evidence
- `publication_execution_receipts`: normalized outcome, safe evidence references, optional external object reference와 recorded timestamp를 담는 append-only receipt
- `publication_audit`: append-only application/coordination audit
- `publication_events`: immutable canonical Domain Event journal
- `publication_idempotency`: command key/fingerprint/result reference를 담는 immutable idempotency record

`PREPARED` 등의 dispatch event 값은 persistence-internal observation vocabulary다. API-014, Domain lifecycle 또는 Provider execution-mode vocabulary로 노출하지 않는다.

모든 child table key와 foreign key는 tenant scope와 Publication identity를 포함한다. SQL parameter binding, strict canonical JSON decode, `foreign_keys = ON`, `journal_mode = WAL`, `synchronous = FULL`, bounded `busy_timeout`을 적용한다. Receipt, dispatch event, audit, Domain Event 및 idempotency에는 normal operation의 `UPDATE`/`DELETE`를 거부하는 trigger를 둔다.

## 5. External side-effect ordering

### 5.1 Transaction A — durable intent before dispatch

Provider 호출 전 하나의 SQLite transaction에서 다음을 commit한다.

1. current aggregate/version과 F17-B `ELIGIBLE` 결과를 확인한다.
2. aggregate를 canonical `EXECUTION_PENDING`으로 전환하고 Delivery Attempt를 추가한다.
3. exact persisted Target/Channel/Representation/Approval binding으로 immutable execution intent와 dispatch fingerprint를 기록한다.
4. stable external idempotency key를 기록한다.
5. accepted command idempotency, audit 및 Domain Event evidence를 함께 기록한다.

하나라도 실패하면 모두 rollback하며 Provider는 호출하지 않는다. Transaction A commit 전에는 external side effect가 발생할 수 없다.

### 5.2 Dispatch claim — committed before invocation

Provider 호출 직전에 짧은 SQLite transaction으로 해당 intent에 append-only `DISPATCH_STARTED` evidence를 정확히 한 번 기록한다. 이미 receipt 또는 `DISPATCH_STARTED`가 존재하면 자동 호출하지 않는다. 이 claim이 commit되지 않으면 Provider를 호출하지 않는다.

### 5.3 Provider invocation

Provider에는 Transaction A에 저장된 exact immutable intent만 전달한다. Caller/body가 supplied한 actor, target, channel, approval 또는 representation 값으로 intent를 다시 구성하지 않는다. Provider가 idempotency를 지원하면 stored stable external idempotency key를 전달한다. raw Provider response, credential, secret 또는 stack/path는 저장하거나 외부 응답으로 노출하지 않는다.

### 5.4 Transaction B — normalized result

Provider 결과가 관측되면 하나의 SQLite transaction에서 다음을 commit한다.

1. immutable normalized execution receipt를 append한다.
2. matching Delivery Attempt를 `CONFIRMED`, `NO_EFFECT` 또는 `UNKNOWN`으로 resolve한다.
3. aggregate lifecycle/version을 canonical transition으로 갱신한다.
4. result audit, Domain Event 및 final result reference를 기록한다.

Receipt, aggregate outcome, result audit/event 및 replayable result reference는 모두 commit되거나 모두 rollback된다. 기존 immutable command idempotency record는 덮어쓰지 않으며, final result는 immutable linked result record로 추가한다.

## 6. Crash and ambiguous outcome semantics

| Failure point | Durable observation | Required behavior |
|---|---|---|
| Transaction A commit 전 | intent 없음 | rollback, Provider call 0, safe retry 가능 |
| Transaction A 이후 / dispatch claim 전 | `PREPARED` only | Provider call이 시작되지 않았음이 증명되므로 fresh authorization/revalidation 후 explicit retry만 허용 |
| `DISPATCH_STARTED` 이후 / Provider 호출 전 crash | started, receipt 없음 | outcome을 증명할 수 없으므로 자동 resend 금지, `RECONCILIATION_REQUIRED`로 fail closed |
| Provider rejection/confirmed response 관측 | normalized result available | Transaction B에서 immutable receipt + aggregate outcome atomic commit |
| Provider 실행 후 Transaction B commit 전 crash | started, receipt 없음 | external outcome ambiguous; 자동 resend 금지, `RECONCILIATION_REQUIRED` |
| timeout/connection reset/invalid response | outcome unproven | `UNKNOWN` receipt와 reconciliation evidence를 atomic commit; success/no-effect를 추론하지 않음 |
| Transaction B commit outcome 자체가 불명확 | adapter quarantined | reopen/integrity check 후 receipt/idempotency/revision으로 판정; 판정 전 재호출 금지 |

Startup/reopen 또는 동일 command replay가 `DISPATCH_STARTED`와 receipt 부재를 발견하면 Provider를 호출하지 않는다. Bounded recovery containment는 immutable `OUTCOME_UNPROVEN` evidence를 기록하고 existing aggregate command를 사용해 `RECONCILIATION_REQUIRED`로 전환한다. 이것은 F19 resolution workflow가 아니며 unknown outcome을 해소하거나 외부 상태를 추론하지 않는다.

## 7. Provider-side idempotency

- Provider가 idempotency를 지원하면 external key는 `(tenant, publication, command, attempt, dispatch fingerprint)`에서 deterministic하게 도출하고 최초 intent에 고정한다.
- 같은 canonical intent의 explicit retry는 Provider contract가 duplicate suppression을 보장하고 current authorization/approval/target/version revalidation이 다시 통과한 경우에만 같은 external key를 사용할 수 있다.
- Provider idempotency가 없거나 보장 수준을 증명할 수 없으면 ambiguous attempt를 재전송하지 않는다.
- Provider-side key가 있어도 startup이 blind resend하지 않는다. 재호출은 F17-F retry eligibility의 explicit decision과 live revalidation을 요구한다.
- internal command idempotency, Delivery Attempt identity와 Provider external idempotency는 서로 다른 identity이며 혼용하지 않는다.

## 8. Retry and reconciliation boundary

F17-C는 durable fact와 safe state를 제공할 뿐 retry authority 또는 reconciliation resolution을 생성하지 않는다.

- confirmed receipt가 있으면 stored result를 replay하고 Provider call은 0이다.
- same idempotency key/different fingerprint는 `IDEMPOTENCY_CONFLICT`로 거부한다.
- receipt 없는 `DISPATCH_STARTED`는 `RECONCILIATION_REQUIRED`이며 retry-ineligible다.
- `PREPARED` only 상태의 retry도 Session, capability, SoD, MFA, effective Approval, Verification, Permission, Target/Channel 및 aggregate version을 재검증한다.
- prior attempt/receipt/dispatch evidence는 append-only로 보존한다.
- F19만 reconciliation case를 authoritative evidence로 resolve할 수 있다.

## 9. Optimistic concurrency and local atomicity

각 local transaction은 `BEGIN IMMEDIATE`와 database-bound compare-and-swap을 사용한다.

- aggregate update는 `WHERE aggregate_version = expected_version AND revision = initial_revision` 조건을 만족해야 한다.
- revision은 같은 transaction에서 정확히 한 번 증가한다.
- attempt/intent/receipt uniqueness collision은 deterministic conflict로 매핑한다.
- stale writer, concurrent claim 또는 duplicate receipt는 전체 transaction을 rollback한다.
- SQLite transaction 내부의 aggregate mutation, local evidence와 idempotency linkage는 atomic하다.
- SQLite transaction과 외부 Provider 호출은 하나의 atomic transaction이 될 수 없으며, 이 간극은 intent-first ordering과 ambiguity containment로 처리한다.

## 10. Recovery and integrity

Open/reopen 시 schema version, `PRAGMA integrity_check`, `PRAGMA foreign_key_check`와 다음 linkage를 검증한다.

- aggregate version/revision
- attempt ↔ intent ↔ dispatch event ↔ receipt
- receipt ↔ aggregate resolved outcome
- command idempotency ↔ intent/final result
- audit/event sequence와 append-only prefix

지원하지 않는 schema, malformed JSON/linkage, impossible sequence 또는 integrity failure는 connection을 quarantine하고 startup을 중단한다. SQLite WAL이 uncommitted local transaction을 rollback한다. `COMMIT` exception으로 결과가 불명확하면 같은 adapter instance의 추가 operation을 금지하고 새 connection의 validated reopen으로만 판정한다.

지원 filesystem은 SQLite locking/fsync semantics를 제공하는 local durable filesystem이다. Network filesystem은 지원하지 않는다.

## 11. Composition and lifecycle

- Production composition은 explicit database path로 `DurablePublicationUnitOfWork`를 한 번 생성하고 repository, audit, event, idempotency 및 execution journal을 동일 durable authority에서 주입한다.
- database path 누락, 빈 값, `:memory:` 또는 incompatible/corrupt database는 startup failure다.
- Production에는 in-memory fallback option이 없다.
- Development/test는 existing in-memory adapter 또는 explicit sandbox adapter를 직접 선택할 수 있다.
- graceful shutdown은 HTTP intake 중단과 in-flight bounded completion 이후 SQLite connection을 close한다.
- Provider adapter unavailable이면 fail closed하며 intent/attempt를 Provider success로 resolve하지 않는다.

## 12. Safe errors and data handling

SQLite error, SQL, filesystem path, raw Provider response, credential, stack 및 internal dispatch state는 API/Console 응답에 노출하지 않는다. Existing safe Publication errors와 concealment만 사용한다. Durable adapter와 execution journal은 authorization 또는 business authority를 생성하지 않는다.

## 13. TDD verification plan

설계 승인 후 다음 RED 순서로 진행한다.

1. explicit production DB path와 zero in-memory fallback
2. aggregate/attempt/intent/audit/event/idempotency close/reopen durability
3. Transaction A atomic rollback과 Provider call 0
4. exact durable intent만 Provider에 전달
5. dispatch claim uniqueness와 concurrent claim conflict
6. confirmed/rejected/unknown receipt + aggregate outcome atomicity
7. crash after Provider execution and before Transaction B → no resend + `RECONCILIATION_REQUIRED`
8. timeout/invalid response → immutable UNKNOWN receipt + reconciliation-required state
9. same-key/same-fingerprint replay after restart와 conflicting fingerprint rejection
10. stale aggregate/revision conflict
11. receipt/dispatch/audit/event/idempotency append-only enforcement
12. corrupted/incomplete transaction, incompatible schema 및 uncertain commit quarantine
13. Provider-idempotency-supported explicit retry와 unsupported-provider no-resend
14. F17-B blocked eligibility → intent 0, Provider call 0, state mutation 0
15. affected API-014/Application/Runtime regression

최종 gate는 focused durability tests, affected regression, lint, typecheck, build, verify, architecture checksum, `git diff --check`, Gitleaks, scoped authorized dependency audits, full suite once와 independent review다.

## 14. Success criteria

- committed Publication execution state와 evidence가 restart 후 유지된다.
- external side effect 전 durable intent가 항상 존재한다.
- ambiguous outcome은 success로 추론되지 않고 `RECONCILIATION_REQUIRED`로 수렴한다.
- restart 후 blind resend path가 0이다.
- local aggregate outcome + receipt + audit/event + result reference가 atomic하다.
- optimistic concurrency, canonical idempotency와 append-only evidence가 database boundary에서 강제된다.
- Production은 durable configuration 없이는 fail closed한다.
- API-014, authority ownership, lifecycle vocabulary와 Provider-neutral boundary가 유지된다.
- dependency 추가가 없다.

## 15. Review findings and open decisions

Self-review 결과:

- durable intent ordering: PASS
- provider invocation ordering: PASS
- receipt/result atomicity: PASS
- crash/timeout ambiguity containment: PASS
- provider idempotency boundary: PASS
- no blind resend: PASS
- canonical API/authority/lifecycle compatibility: PASS
- F17-C Production implementation started: NO

**DECISION:** `DISPATCH_STARTED` 후 receipt 부재는 reopen 시 즉시 `RECONCILIATION_REQUIRED`로 materialize한다. External outcome resolution 자체는 F19로 유지한다.

**OPEN DECISION:** Production database path와 file lifecycle의 deployment-specific 값은 runtime configuration 단계에서 명시적으로 제공되어야 한다. 값이 없으면 fail closed한다.
