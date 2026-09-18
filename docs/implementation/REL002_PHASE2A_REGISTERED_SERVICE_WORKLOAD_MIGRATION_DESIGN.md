# REL-002 Phase 2A Registered Service Workload Migration Design

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-303 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Identity Owner / Data Owner / Operations Owner |
| 기준일 | 2026-09-18 |
| Baseline | `8f217f3e3dfeabed4cdc9413b6f230b26ea61f30` |
| Decisions | DEC-167/171/172 (`APPROVED`) |

## 1. 목적과 범위

Phase 1G의 Identity-owned exact schema contract를 Production migration artifact로 구현할 수 있도록 고정한다. 이 문서는 migration 실행, Production database write, identity row 생성 또는 runtime DDL을 승인하지 않는다.

## 2. Canonical ownership

- logical owner: Identity domain
- physical boundary: existing Identity database boundary
- table: `identity_registered_service_workloads`
- metadata: `identity_schema_contracts`
- migration evidence: same Identity database boundary의 append-only `identity_schema_migrations`
- runtime reader: `DurableRegisteredServiceWorkloadStore` read-only lease
- migration owner: REL-002 Phase 2의 별도 승인된 migration executor
- 금지: Administration ownership, standalone Identity database, runtime `CREATE TABLE`, credential/role/scope/capability 저장

## 3. Artifact contract

현재 repository에는 canonical executable migration directory/runner가 없다. 다음 위치와 이름은 DEC-172에서 승인된 설계 contract이며, 이 Phase에서는 파일을 생성하거나 실행하지 않는다.

| 항목 | 제안 값 |
|---|---|
| Migration ID | `REL002-P2A-IDENTITY-RSW-V1` |
| Sequence | `001` |
| Forward artifact | `modules/identity/migrations/production/001_registered_service_workload_v1.up.sql` |
| Verification artifact | `modules/identity/migrations/production/001_registered_service_workload_v1.verify.sql` |
| Destructive down artifact | 없음 |
| Contract ID | `identity.registered-service-workload` |
| Schema version | `1` |
| Contract fingerprint | `6758c44e385d416299020512d93b6485b42377daf2d9bfd5461f0413fde65e6b` |
| Artifact checksum | ratified `.up.sql` bytes의 SHA-256; execution 전에 고정 |
| Replay identity | `(migration_id, artifact_checksum)` |

`identity_schema_migrations`는 별도 persistence subsystem이나 API-016 event가 아니다. 동일 Identity database transaction에 migration 실행 사실을 결합하는 DEC-172 승인 migration-control metadata다. Executable artifact 생성과 실행은 별도 승인이 필요하다.

## 4. Forward behavior

1. exact target가 `PRODUCTION`인지 확인한다.
2. read-only preflight로 database와 schema state를 분류한다.
3. approved maintenance window에서 단일 executor가 `BEGIN IMMEDIATE` transaction을 연다.
4. lock을 획득한 transaction 안에서 state를 다시 분류하고 `TABLE_ABSENT`일 때만 진행한다.
5. exact shared metadata table(없을 때), migration ledger table(없을 때), workload table, required index와 v1 metadata row를 한 transaction에 기록한다.
6. 같은 transaction에서 immutable migration ledger row를 기록한다. 이미 존재하는 동일 `migration_id`는 아래 replay 분류를 적용한다.
7. Phase 1G checker와 동일한 structure/version/fingerprint 검증을 수행한다.
8. 검증 성공 후 commit한다. ledger에 저장된 사전 승인 evidence references가 schema commit과 원자적으로 남으며, post-commit completion evidence는 이를 보충하되 대체하지 않는다.
9. 검증 실패 시 transaction을 rollback하고 runtime startup을 계속 차단한다.

`CREATE TABLE IF NOT EXISTS`를 사용해 incompatible state를 덮어쓰지 않는다. `TABLE_PRESENT_COMPATIBLE`은 exact ledger row까지 일치할 때만 성공적인 no-op classification이며 artifact를 재실행하지 않는다. Exact schema가 존재해도 ledger row가 없으면 `MIGRATION_PARTIALLY_APPLIED`로 차단한다. 다른 state는 자동 수리하지 않는다.

## 5. Ordering과 idempotency

- sequence `001`은 Identity Production migration line의 최초 contract다.
- 동일 migration ID + 동일 artifact checksum + 동일 contract/version/fingerprint + compatible committed state는 replay-safe no-op다.
- 동일 migration ID에 다른 artifact checksum 또는 contract/version/fingerprint를 연결하면 deterministic conflict로 중단한다.
- exact schema가 있으나 ledger가 없거나, ledger가 있으나 schema가 불완전하면 자동 adoption/repair하지 않고 `MIGRATION_PARTIALLY_APPLIED`로 중단한다.
- higher schema version이 있으면 downgrade하지 않고 `SCHEMA_VERSION_UNSUPPORTED`로 중단한다.
- schema와 row initialization을 하나의 migration으로 합치지 않는다.

## 6. Failure와 evidence

Durable authority는 동일 Identity database transaction의 `identity_schema_migrations` row다. 이 row는 migration ID, artifact checksum, contract/version/fingerprint, target environment, change evidence reference, operator evidence reference, applied time과 result를 보존한다. Change/operator evidence reference는 transaction 시작 전에 이미 존재하고 검증되어야 한다. Schema change와 ledger insert 중 하나라도 실패하면 둘 다 rollback한다. Commit 후 schema 또는 ledger 한쪽만 보이면 `MIGRATION_PARTIALLY_APPLIED`이며 자동 재실행하지 않는다.

외부 completion evidence는 preflight state, post-open checker result, runtime-not-started proof와 safe error/disposition을 추가한다. SQL text, database path, stack, credential, raw identity evidence는 포함하지 않는다. 새 API-016 Audit vocabulary를 만들지 않으며 ledger reference가 final API-016 event라고 주장하지 않는다.

## 7. Rollback disposition

- commit 전: SQLite transaction rollback
- commit 후: table/drop/delete를 수행하는 destructive down migration 금지
- application rollback: v1 schema를 유지하며 이전 artifact가 v1-compatible한 경우에만 수행
- incompatible defect: forward-fix migration + 별도 승인
- data가 존재하는 경우: backup/restore와 evidence-preserving recovery 없이는 schema 제거 금지

## 8. Decision proposal

`DEC-172 = APPROVED`: 위 migration identity, artifact ownership, transaction/idempotency, non-destructive rollback과 evidence contract를 확정한다. Migration artifact 생성/실행 authority는 부여하지 않는다.
