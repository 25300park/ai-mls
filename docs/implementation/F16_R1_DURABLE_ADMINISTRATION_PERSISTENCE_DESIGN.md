# F16-R1 Durable Administration Persistence Design

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-018 |
| 문서 버전 | v0.3 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner / Development Owner |
| 기준일 | 2026-08-26 |
| Brief | F16-R1 — Durable Administration Persistence / Idempotency / Atomic Audit |

## 1. Objective

FEAT-016의 기존 `AdministrationUnitOfWork` 계약과 Phase 6 invariant를 변경하지 않고, production Administration state를 Node.js built-in `node:sqlite`에 durable하게 저장한다. Governed resource mutation, proposal/decision evidence, idempotency와 revision은 하나의 SQLite transaction으로 all-or-nothing commit된다.

## 2. Scope

포함 범위:

- `DurableAdministrationUnitOfWork`
- governed resource, proposal, decision, evidence, idempotency 및 revision persistence
- restart/reopen recovery
- optimistic concurrency와 append-only enforcement
- explicit database-path production composition
- durability, recovery, atomicity 및 regression tests

제외 범위:

- API-015 contract/operation 변경
- authority ownership 또는 authorization rule 변경
- Console/UI 변경
- PostgreSQL, ORM, migration framework 또는 외부 dependency
- F16-R2/F16-R3

## 3. Architecture

`administration-persistence.ts`의 public ports와 record types는 canonical contract로 유지한다. Phase 6의 transaction tracker, repository validation, atomic-bundle validation과 evidence-prefix invariant를 reusable internal transaction engine으로 분리해 in-memory 및 durable adapter가 동일한 rule implementation을 사용한다. In-memory adapter는 development/test에만 남는다.

`DurableAdministrationUnitOfWork`는 `DatabaseSync`를 소유한다. `begin(identity)`는 해당 identity/scope의 committed snapshot, authoritative/proposal record version과 revision을 읽어 공통 engine에 staged transaction을 만든다. `commit()`은 `BEGIN IMMEDIATE` 안에서 다음 compare-and-swap을 수행한다.

1. 신규 record는 `expectedVersion = 0`이며 동일 composite identity가 없어야 한다.
2. 신규 identity는 같은 `BEGIN IMMEDIATE` 안에서 revision row를 revision `0`으로 `INSERT`하고 inserted row가 정확히 1이어야 한다. Unique collision은 전체 rollback 후 `VERSION_CONFLICT`로 매핑한다.
3. 기존 governed/proposal record는 `UPDATE ... WHERE version = expectedVersion`로 갱신하고 affected row가 정확히 1이어야 한다.
4. 신규/기존 identity 모두 `administration_revisions`를 `UPDATE ... SET revision = revision + 1 WHERE revision = initialRevision`으로 증가시키며 affected row가 정확히 1이어야 한다. 신규 identity는 반드시 `0 → 1` CAS를 수행한다.
5. 위 조건 중 하나라도 0 rows이면 전체 transaction을 rollback하고 `VERSION_CONFLICT`로 매핑한다.

CAS가 모두 성공할 때만 validated state delta, append-only decision/evidence와 idempotency record를 같은 SQLite transaction에 기록한다. `SQLITE_BUSY`/`SQLITE_LOCKED`는 bounded `busy_timeout = 5000` 경과 후 rollback하고 deterministic `VERSION_CONFLICT`로 매핑한다. Validation 또는 storage failure도 `ROLLBACK` 후 기존 safe persistence error로 fail closed한다.

## 4. SQLite storage model

SQLite schema는 다음 logical table을 가진다.

- `administration_schema`: singleton schema version과 compatibility metadata; schema bootstrap은 `BEGIN EXCLUSIVE` transaction으로 수행
- `administration_revisions`: primary key `(tenant_id, resource_type, resource_id)`와 non-negative revision
- `administration_resources`: primary key `(tenant_id, resource_type, resource_id)`, revision identity foreign key, scope columns, positive version과 canonical JSON payload
- `administration_proposals`: primary key `(tenant_id, proposal_id)`, unique `(tenant_id, proposal_id, resource_type, resource_id)`, revision identity foreign key와 current governed review status/version
- `administration_decisions`: primary key `(tenant_id, decision_id)`, composite foreign key `(tenant_id, proposal_id, resource_type, resource_id)`로 proposal/resource binding을 보존하는 append-only record
- `administration_resource_evidence`: resource composite foreign key + monotonic sequence primary key
- `administration_proposal_evidence`: proposal composite foreign key + monotonic sequence primary key
- `administration_decision_evidence`: decision composite foreign key + monotonic sequence primary key
- `administration_idempotency`: primary key `(tenant_id, resource_type, resource_id, idempotency_key)`, revision identity foreign key, immutable operation/fingerprint/result reference/version

모든 foreign key는 동일 tenant와 canonical resource binding을 포함하며 orphan/cross-identity insert를 거부한다. `foreign_keys = ON`이며 schema bootstrap과 validation이 실패하면 database는 열리지 않는다. Canonical JSON은 deterministic key ordering과 strict decode/validation을 사용한다. Evidence는 mutable payload와 분리하고 sequence 순서로 reconstruct한다. Decision, 세 evidence table 및 idempotency table에는 `UPDATE`/`DELETE`를 거부하는 trigger를 적용한다. 동일 idempotency primary key와 동일 fingerprint는 stored result replay를 반환하며 different fingerprint는 insert를 시도하지 않고 `IDEMPOTENCY_CONFLICT`로 거부한다.

## 5. Recovery and integrity

Adapter는 local durable filesystem을 전제로 `journal_mode = WAL`, `synchronous = FULL`, `foreign_keys = ON`, `busy_timeout = 5000`을 고정한다. Filesystem은 SQLite가 요구하는 file locking, atomic rename와 flush/fsync semantics를 제공해야 하며 network filesystem은 지원하지 않는다.

Open/reopen 시 schema version, `PRAGMA integrity_check`, `PRAGMA foreign_key_check`를 검증하고 모든 persisted row를 strict decoder로 읽어 version, scope, proposal/decision/resource binding, evidence sequence/prefix와 idempotency linkage를 검증한다. 지원하지 않는 schema, malformed row/linkage 또는 integrity failure는 connection을 quarantine한 뒤 startup을 중단한다.

SQLite WAL recovery가 commit되지 않은 transaction을 rollback한다. Disk-full/I/O failure가 `COMMIT` 전에 발생하면 명시적으로 rollback한다. `COMMIT` 호출이 예외를 반환해 outcome이 불명확하면 해당 adapter instance를 quarantine하고 추가 `begin()`을 거부한다. 새 connection으로 reopen하여 integrity/linkage 검증 후 revision과 idempotency record를 조회해야만 committed 또는 uncommitted outcome을 판정하며, 부분 success를 추론하거나 자동 재실행하지 않는다.

Production database path는 runtime/composition input에서 명시적으로 주입한다. 빈 값, memory database 또는 누락된 production configuration은 거부한다. Production factory는 durable adapter만 구성하며 in-memory fallback branch를 갖지 않는다.

## 6. Composition and lifecycle

기존 `AdministrationGovernanceApplication`과 HTTP adapter 계약은 유지한다. Production composition factory가 database path로 durable UoW를 생성하고 동일 instance의 read repositories와 `AdministrationUnitOfWork`를 application에 주입한다. 종료 경계는 HTTP server shutdown 뒤 SQLite connection을 명시적으로 close한다.

Development/test는 기존 `InMemoryAdministrationUnitOfWork`를 직접 주입할 수 있다. Production composition에서는 이를 선택할 option을 제공하지 않는다.

## 7. Error mapping

SQLite-specific error, filesystem path, SQL text와 internal schema detail은 persistence boundary 밖으로 노출하지 않는다. 오류는 기존 의미에 맞춰 `VERSION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `RECORD_NOT_FOUND`, transaction/commit failure 또는 safe internal failure로 변환한다. Commit 성공 전에는 application success, decision/audit evidence 또는 idempotency success가 관찰되지 않는다.

## 8. TDD verification

각 production change 전에 다음 순서로 RED를 확인한다.

1. committed governed state/proposal/decision/idempotency가 close/reopen 후 유지
2. rollback 및 injected commit failure 후 모든 table에 side effect 0
3. state + decision/evidence + idempotency atomic commit
4. 두 adapter instance의 stale revision/version conditional-write conflict와 bounded lock conflict
5. close/reopen 이후 same-key/same-fingerprint stored-result replay와 same-key/different-fingerprint rejection
6. decision/evidence/idempotency `UPDATE`/`DELETE` rejection과 evidence prefix preservation
7. controlled child process를 `BEGIN IMMEDIATE` 후 partial rows를 쓰고 `COMMIT` 전에 강제 종료한 뒤 reopen하면 반드시 이전 state만 관찰되어야 함
8. child process를 `COMMIT` boundary에서 종료하거나 connection failure를 주입한 뒤 reopen하면 resource/proposal/decision/evidence/idempotency/revision이 모두 이전 상태이거나 모두 새 상태여야 하며 subset 관찰은 실패; revision/idempotency lookup으로 outcome 판정
9. disk-full/I/O와 uncertain-commit fault에서 adapter quarantine 및 reopen-based outcome resolution
10. corrupted database, incompatible schema, foreign-key violation과 malformed payload/linkage의 fail-closed startup
11. production composition의 explicit path requirement와 zero in-memory fallback
12. existing Phase 6, Application, Runtime/HTTP 및 Console affected regression

최종 gate는 focused tests, affected regression, lint, typecheck, build, verify, architecture checksum, `git diff --check`, Gitleaks, authorized dependency audits, full suite once와 independent review다.

## 9. Security and data handling

- database path와 SQLite errors는 client-visible response에 포함하지 않는다.
- persisted records는 기존 tenant/scope identity를 유지하며 cross-tenant key alias를 허용하지 않는다.
- adapter는 authorization 또는 business authority를 생성하지 않는다.
- SQL parameter binding만 사용한다.
- test database는 OS temporary directory에 생성하고 종료 후 제거한다.
- dependency manifest와 lockfile은 변경하지 않는다.

## 10. Compatibility and migration

기존 in-memory state를 production durable store로 자동 승격하거나 추론하지 않는다. R1 production startup은 새 durable database 또는 동일 schema-version database만 연다. 별도 legacy data migration 요구가 확인되면 `OPEN DECISION`으로 차단하며 R1에서 임의 변환하지 않는다.

## 11. Documentation and traceability

구현 완료 시 `F16-GAP-004`, `F16-GAP-006`, `F16-GAP-007`을 실제 durability evidence로 갱신하고 F16-R1 report를 생성한다. Architecture Bible frozen checksum 대상은 직접 수정하지 않는다. 새로운 canonical operation, API ID 또는 authority decision은 생성하지 않는다.

## 12. Success criteria

- durable adapter가 기존 `AdministrationUnitOfWork` 계약을 만족한다.
- restart/recovery, atomicity, concurrency, idempotency와 append-only evidence tests가 통과한다.
- production composition이 durable adapter만 선택하고 missing path를 fail closed한다.
- 기존 Phase 6 invariant와 API/Application/Console regression이 유지된다.
- production dependency 추가가 없다.
- independent review가 Critical 0 / Important 0으로 READY다.

## 13. Open decisions

- **OPEN DECISION:** 기존 production Administration data의 migration source가 확인되면 별도 migration authorization이 필요하다. 현재 repository에는 durable legacy Administration store evidence가 없으므로 R1은 자동 migration을 수행하지 않는다.
