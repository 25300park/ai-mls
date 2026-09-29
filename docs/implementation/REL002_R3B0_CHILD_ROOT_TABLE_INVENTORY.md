# REL-002 R3-B0 Child-root Durable Table Inventory

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-368 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner |
| 적용 범위 | API-014/API-015/API-018/API-019/FEAT-022 persistence design |

## 목적과 검증 결과

현재 SQLite durable DDL을 source에서 직접 대조했다. 총계는 **36 tables**이며 예상치와 일치한다: Publication 8, Administration 9, Connector Execution 11, External Integration 5, Advisory 3. 본 문서는 PostgreSQL artifact가 아니며 schema 생성 또는 migration 실행 권한을 부여하지 않는다.

표의 약어는 `PK` primary key, `FK` foreign key, `UQ` unique, `CK` check, `IDX` index다. 별도 timestamp 열이 없는 경우 시간은 JSON payload 내부 business evidence로만 존재하며 Production schema에서 암묵적으로 추출하지 않는다. 모든 JSON text는 PostgreSQL에서 `jsonb`와 exact shape validation의 결합을 검토해야 한다.

## Publication — 8 tables

Source: [`publication-durable-persistence.ts`](../../modules/publication/src/publication-durable-persistence.ts) lines 307–314.

| Table | Keys / constraints / indexes | Version, idempotency, audit, time | Retention implication | PostgreSQL classification |
|---|---|---|---|---|
| `publication_schema` | PK `singleton_id`; CK `singleton_id=1`, `schema_version>0` | schema version | contract metadata retained | `POSTGRESQL_NORMALIZATION_REQUIRED` |
| `publication_scopes` | PK `(tenant_scope_id, publication_id)`; CK `revision>=0` | optimistic `revision`; record/history JSON; no explicit timestamp | current record plus history retained by domain policy | `POSTGRESQL_NORMALIZATION_REQUIRED` |
| `publication_idempotency` | PK scope + `command_key`; FK scope | idempotency payload | retain for replay horizon; append-only trigger | `DIRECT_PORT` |
| `publication_audit` | PK `id`; FK scope | audit payload | immutable audit retention applies | `DIRECT_PORT` |
| `publication_events` | PK `(tenant_scope_id,event_id)`; FK scope | event payload | immutable event retention applies | `DIRECT_PORT` |
| `publication_execution_intents` | PK scope + `command_id`; FK scope | execution journal | immutable execution evidence | `DIRECT_PORT` |
| `publication_dispatch_events` | PK scope + command + `sequence`; CK sequence > 0; FK intent | ordered journal | immutable execution evidence | `DIRECT_PORT` |
| `publication_execution_receipts` | PK scope + command; UQ `receipt_id`; FK intent | receipt evidence | immutable execution evidence | `DIRECT_PORT` |

## Administration — 9 tables

Source: [`administration-durable-persistence.ts`](../../modules/administration/src/administration-durable-persistence.ts) lines 584–592.

| Table | Keys / constraints / indexes | Version, idempotency, audit, time | Retention implication | PostgreSQL classification |
|---|---|---|---|---|
| `administration_schema` | singleton PK and positive version CK | schema version | contract metadata retained | `POSTGRESQL_NORMALIZATION_REQUIRED` |
| `administration_revisions` | PK tenant/resource; CK revision >= 0 | optimistic revision | current concurrency authority | `DIRECT_PORT` |
| `administration_resources` | PK tenant/resource; FK revision; CK version > 0 | version, scope, JSON | governed resource lifecycle | `POSTGRESQL_NORMALIZATION_REQUIRED` |
| `administration_proposals` | PK tenant/proposal; UQ proposal/resource binding; FK revision; CK version > 0 | proposal version/JSON | approval evidence retained | `POSTGRESQL_NORMALIZATION_REQUIRED` |
| `administration_decisions` | PK tenant/decision; FK revision and proposal binding; CK version > 0 | decision version/JSON | append-only decision evidence | `POSTGRESQL_NORMALIZATION_REQUIRED` |
| `administration_resource_evidence` | PK resource + sequence; FK resource; CK sequence > 0 | ordered evidence | append-only evidence | `DIRECT_PORT` |
| `administration_proposal_evidence` | PK proposal + sequence; FK proposal; CK sequence > 0 | ordered evidence | append-only evidence | `DIRECT_PORT` |
| `administration_decision_evidence` | PK decision + sequence; FK decision; CK sequence > 0 | ordered evidence | append-only evidence | `DIRECT_PORT` |
| `administration_idempotency` | PK resource + key; FK revision; CK result_version > 0 | operation/fingerprint/result | append-only replay evidence | `DIRECT_PORT` |

## Connector Execution — 11 tables

Source: [`connector-durable-persistence.ts`](../../modules/source/src/connector-durable-persistence.ts) lines 505–516. Canonical scope is `(tenant_id, scope_type, scope_id, source_id, connector_id)`.

| Table | Keys / constraints / indexes | Version, idempotency, audit, time | Retention implication | PostgreSQL classification |
|---|---|---|---|---|
| `connector_schema` | singleton PK/version CK | schema version | contract metadata | `POSTGRESQL_NORMALIZATION_REQUIRED` |
| `connector_scopes` | scope PK; revision >= 0 | optimistic revision | current scope authority | `DIRECT_PORT` |
| `connector_leases` | scope + lease PK; FK scope; status CK; active-lease partial UQ IDX | `acquired_at`, `expires_at` text; version | lease history | `POSTGRESQL_NORMALIZATION_REQUIRED` |
| `connector_invocations` | scope + invocation PK; UQ scope/idempotency key; FK lease; state CK | idempotency/state JSON | invocation evidence | `DIRECT_PORT` |
| `connector_idempotency` | scope + key PK; FK invocation | fingerprint/result reference | replay horizon | `DIRECT_PORT` |
| `connector_results` | scope + invocation PK; UQ result; FK invocation; outcome CK | result evidence | append-only | `DIRECT_PORT` |
| `connector_checkpoints` | scope PK; version > 0 | optimistic version | current checkpoint plus external retention policy | `DIRECT_PORT` |
| `connector_evidence` | scope + invocation + sequence PK; FK invocation; kind CK | ordered evidence | append-only | `DIRECT_PORT` |
| `connector_technical_records` | scope + type + id PK; FK scope; type CK; version > 0 | optimistic version | record-type policy | `DIRECT_PORT` |
| `connector_technical_idempotency` | scope + key PK; FK scope | fingerprint/JSON | replay horizon; append-only | `DIRECT_PORT` |
| `connector_technical_evidence` | scope + type + id + sequence PK; FK technical record | ordered evidence | append-only | `DIRECT_PORT` |

## External Integration — 5 tables

Source: [`external-integration-durable-persistence.ts`](../../modules/source/src/external-integration-durable-persistence.ts) lines 129–133. Canonical scope is `(tenant_id, scope_type, scope_id, connector_id, source_id)`.

| Table | Keys / constraints / indexes | Version, idempotency, audit, time | Retention implication | PostgreSQL classification |
|---|---|---|---|---|
| `ext_contracts` | scope + contract PK; status CK | version/JSON | contract lifecycle | `POSTGRESQL_NORMALIZATION_REQUIRED` |
| `ext_mappings` | scope + mapping PK; UQ provider/external object | version/JSON; SQLite has no contract FK | mapping lifecycle | `CONTRACT_CHANGE_REQUIRED` |
| `ext_observations` | scope + namespace + observation PK | fingerprint/JSON; SQLite has no contract FK | append-only observation; current list uses `rowid` order | `CONTRACT_CHANGE_REQUIRED` |
| `ext_idempotency` | scope + key PK | fingerprint/result JSON | replay horizon | `DIRECT_PORT` |
| `ext_evidence` | scope + evidence PK | contract reference/JSON | append-only; current list uses `rowid` order | `CONTRACT_CHANGE_REQUIRED` |

## Advisory — 3 tables

Source: [`advisory-durable-persistence.ts`](../../modules/ai/src/advisory-durable-persistence.ts) lines 196–228.

| Table | Keys / constraints / indexes | Version, idempotency, audit, time | Retention implication | PostgreSQL classification |
|---|---|---|---|---|
| `advisory_prompts` | PK `(prompt_id,prompt_version)`; capability/status CK | prompt version; `created_at` text | append-only prompt lineage | `POSTGRESQL_NORMALIZATION_REQUIRED` |
| `advisory_records` | PK `advisory_id` | tenant/scope/capability/schema/fingerprint JSON | append-only advisory evidence | `POSTGRESQL_NORMALIZATION_REQUIRED` |
| `advisory_idempotency` | PK tenant/scope/key; FK advisory record | idempotency binding | append-only replay evidence | `DIRECT_PORT` |

## Cross-engine normalization rules

- Boolean values become PostgreSQL `boolean`; numeric SQLite booleans must not be accepted silently.
- Persisted instants become `timestamptz` and are normalized to UTC. Existing opaque business timestamps inside JSON remain contract data until a separately approved extraction.
- JSON text becomes `jsonb`; key ordering must never be used as identity. Fingerprints continue to use the canonical application serialization contract.
- Existing application-generated identifiers remain application-generated; no new sequence/identity authority is introduced.
- PostgreSQL conflict handling must distinguish exact idempotent replay from semantic conflict; broad `ON CONFLICT DO NOTHING` is prohibited.
- Foreign keys are immediate by default. Any deferrable FK needs explicit AO approval and test evidence.
- `NULL`, collation and case comparison must be explicit; identifiers remain case-sensitive byte-equivalent application strings.
- SQLite `rowid` ordering in External Integration has no PostgreSQL equivalent. An explicit immutable sequence/time ordering contract is required before implementation.
- Append-only triggers are retained as a defense, but runtime grants must already omit `UPDATE`/`DELETE` for immutable relations.

## Items requiring AO decision

1. External Integration explicit ordering columns and whether missing contract FKs become canonical.
2. Domain schema contract metadata tables for External Integration and Advisory, which currently lack a dedicated version table.
3. Exact retention periods remain governed outside this design; no table is classified `NOT_REQUIRED_IN_PRODUCTION`.
