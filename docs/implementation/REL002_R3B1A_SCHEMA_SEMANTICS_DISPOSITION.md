# REL-002 R3-B1A Child-root Schema Semantics Disposition

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-373 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner |
| 기준 Main | `98944b96bb86bee487b21e7e28acaf202cb2b466` |
| 구현 상태 | R3-B1B remediation implemented / verification candidate |

## 범위와 근거

이 문서는 R3-B1을 막는 External Integration ordering/FK/JSON representation과 exact trigger/readiness 검증 계약만 제안한다. 근거는 현재 SQLite store, domain type, application caller, tests, R3-B0 inventory와 미커밋 PostgreSQL candidate다. Production schema 실행, adapter 구현, candidate code/SQL 수정은 수행하지 않는다.

## Decision 1 — External Integration immutable ordering

### 현재 canonical semantics

- `listObservations`와 `listEvidence`는 각각 `ORDER BY rowid`를 사용한다. 현재 canonical order는 domain timestamp, version 또는 identifier 정렬이 아니라 SQLite insertion order다.
- `observedAt`과 `recordedAt`은 caller-provided business time이므로 동일할 수 있고 입력 순서와 다를 수 있다. ordering authority가 아니다.
- `observationId`와 `evidenceId`는 identity다. `evidenceId` 생성은 contract-local evidence count를 사용하지만 identifier 자체가 정렬 key는 아니다.
- `ext_observations`와 `ext_evidence`는 update/delete trigger로 append-only다. 생성 후 row order는 변경되지 않는다.
- SQLite `BEGIN IMMEDIATE`가 writer를 직렬화한다. 같은 contract에 대한 concurrent write도 한 writer가 먼저 transaction을 획득하고 commit한 insertion order로 관찰된다.
- PostgreSQL candidate는 ordering column/index를 두지 않는다. 따라서 future adapter가 명시적 `ORDER BY` 없이 동일 semantics를 보존할 수 없으며 현재 선택은 semantic gap이다.

### Options

| Option | Contract | 평가 |
|---|---|---|
| A | timestamp (`observed_at`/`recorded_at`) order | caller time은 중복·역행 가능하므로 기존 insertion order와 다르다. 거부 권고. |
| B | global identity/sequence | SQLite `rowid`와 유사하지만 새 global sequence authority와 runtime sequence privilege를 도입하고 contract-local serialization을 증명하지 못한다. 거부 권고. |
| C | existing identifier/version lexical order | identifiers는 ordering contract가 아니며 evidence/observation version이 없다. 거부 권고. |
| D | contract-local immutable `ordinal bigint` | 숨은 insertion order를 명시적으로 보존한다. contract row lock 아래 `max(ordinal)+1`을 할당하고 같은 transaction에서 append한다. 자동 retry는 0이다. 권고. |

### AO-approved clarification

`ext_observations`와 `ext_evidence`에 scope + `contract_id`별 positive safe-integer `ordinal`을 추가한다. `(scope, contract_id, ordinal)`은 `UNIQUE`; runtime caller가 임의 ordinal을 공급하지 않으며 future PostgreSQL adapter가 contract parent row를 `FOR UPDATE`로 잠근 transaction 안에서 다음 ordinal을 계산한다. list는 `ORDER BY ordinal`을 사용한다. ordinal은 API/domain payload에 노출하지 않는 persistence ordering evidence이며 update/delete할 수 없다. 이 선택은 SQLite `rowid` semantics를 명시화하고 새 business sequence authority를 만들지 않는다.

AO가 승인했으며 R3-B1B migration/verifier/index 및 disposable concurrency evidence에 반영했다. Adapter parity implementation은 후속 단계 범위다.

## Decision 2 — External Integration FK canonicalization

### Exact FK matrix

| Source relation | Target | SQLite FK | Domain validation | DB orphan currently possible | Delete/update behavior | Classification / proposed PostgreSQL behavior |
|---|---|---:|---:|---:|---|---|
| `ext_mappings.(scope,contract_id)` | `ext_contracts.(scope,contract_id)` | NO | YES: active contract/provider binding before write | YES | contract delete API 없음; contract status/version update only | `FK_REQUIRED`; immediate, `ON UPDATE NO ACTION ON DELETE NO ACTION` |
| `ext_observations.(scope,contract_id)` | `ext_contracts.(scope,contract_id)` | NO | YES: active contract/provider binding before append | YES | observation append-only; contract delete API 없음 | `FK_REQUIRED`; immediate, `NO ACTION` |
| `ext_evidence.(scope,contract_id)` | `ext_contracts.(scope,contract_id)` | NO | YES: evidence is emitted only by validated contract mutation | YES | evidence append-only; contract delete API 없음 | `FK_REQUIRED`; immediate, `NO ACTION` |
| observation payload optional `mappingId` | `ext_mappings` | NO | YES when mapping exists; observation without mapping is valid | logical reference only | historical observation must survive mapping lifecycle | `OPTIONAL_REFERENCE`; keep payload-only, no FK |
| evidence payload optional `mappingId` | `ext_mappings` | NO | YES on internal append paths | logical reference only | immutable historical evidence | `INTENTIONALLY_LOGICAL_REFERENCE_ONLY`; no FK |
| `ext_idempotency.result_json` | operation-dependent result | NO | replay fingerprint and parser | not a single relational target | replay evidence append-only | `INTENTIONALLY_LOGICAL_REFERENCE_ONLY`; no FK |
| mapping payload `internalResourceType/internalResourceId` | another bounded domain | NO | application authorization/binding | cross-domain target may be unavailable | external mapping history retained | `INTENTIONALLY_LOGICAL_REFERENCE_ONLY`; no cross-schema FK |

현재 PostgreSQL candidate는 모든 External Integration FK를 생략하므로 위 세 `FK_REQUIRED` 관계와 충돌한다. 기존 SQLite database를 future migration할 때 orphan은 자동 삭제/수정하지 않고 preflight에서 fail closed한다. parent 삭제 cascade는 허용하지 않는다.

AO가 승인했으며 External migration, verifier fingerprint와 disposable orphan/FK tests에 반영했다. Future adapter transaction implementation은 후속 단계 범위다.

## Decision 3 — External Integration / Advisory JSON representation

### Affected categories and existing semantics

| Category | Current SQLite | Serialization/equality/query semantics | Mutation/null semantics | Recommendation |
|---|---|---|---|---|
| External contract/mapping/observation/evidence `payload_json` | `TEXT` + `json_valid` | `JSON.stringify`; whole object parse; individual JSON keys are not queried. Request fingerprint also uses `JSON.stringify`, so key order/bytes must not be silently normalized. | columns NOT NULL; optional properties are omitted, not stored as SQL NULL; contract/mapping payload replaced atomically, observations/evidence append-only | PostgreSQL `text NOT NULL CHECK (payload_json IS JSON)` |
| External idempotency `result_json` | `TEXT` + `json_valid` | opaque replay envelope; fingerprint is separate; result is parsed as a whole | NOT NULL, append-only | PostgreSQL `text NOT NULL CHECK (result_json IS JSON)` |
| Advisory prompt/record `payload_json` | `TEXT` + `json_valid` | written and compared through recursive key-sorted `canonicalJson`; application addresses whole records, not SQL JSON keys | NOT NULL, append-only; optional properties remain omitted | PostgreSQL `jsonb NOT NULL`; adapter must compare/re-hash through canonical application serialization, never JSONB textual rendering |
| Scalar identity/status/version/time columns | typed SQLite columns plus payload duplicate | individually addressed by store and startup validation | exact NOT NULL/status rules | retain normalized PostgreSQL scalar columns (`text`, `bigint`, `timestamptz`) |

Options A–D were evaluated per category. `JSON`/`JSONB` for External Integration would normalize or re-render persisted representation without an existing canonical serializer; normalized child tables are unnecessary because application code does not query individual payload keys. Advisory already defines canonical logical equality, so `JSONB` preserves its semantics and adds validation without creating a new query authority.

External Integration and Advisory schema version/fingerprint metadata remains schema-owned catalog metadata (exact schema comment plus artifact checksum/verifier) rather than adding tables beyond the approved 36-table inventory. Runtime receives no comment/DDL authority. This is a proposed clarification of DEC-195, not a new business table.

AO가 승인했다. R3-B1B는 External columns를 validated `text`로 변경했고 Advisory `jsonb`를 유지했다.

## Exact trigger topology contract

모든 항목은 `tgenabled='O'`, non-internal, `BEFORE`, `FOR EACH ROW`, events exactly `UPDATE OR DELETE`, 동일 schema의 `reject_append_only_mutation()` binding이어야 한다.

| Schema | Expected trigger → table |
|---|---|
| `app_publication` | `publication_idempotency_append_only` → `publication_idempotency`; `publication_audit_append_only` → `publication_audit`; `publication_events_append_only` → `publication_events`; `publication_execution_intents_append_only` → `publication_execution_intents`; `publication_dispatch_events_append_only` → `publication_dispatch_events`; `publication_execution_receipts_append_only` → `publication_execution_receipts` |
| `app_administration` | `administration_decisions_append_only` → `administration_decisions`; `administration_resource_evidence_append_only` → `administration_resource_evidence`; `administration_proposal_evidence_append_only` → `administration_proposal_evidence`; `administration_decision_evidence_append_only` → `administration_decision_evidence`; `administration_idempotency_append_only` → `administration_idempotency` |
| `app_connector` | `connector_results_append_only` → `connector_results`; `connector_evidence_append_only` → `connector_evidence`; `connector_technical_idempotency_append_only` → `connector_technical_idempotency`; `connector_technical_evidence_append_only` → `connector_technical_evidence` |
| `app_external_integration` | `ext_observations_append_only` → `ext_observations`; `ext_evidence_append_only` → `ext_evidence` |
| `app_advisory` | `advisory_prompts_append_only` → `advisory_prompts`; `advisory_records_append_only` → `advisory_records`; `advisory_idempotency_append_only` → `advisory_idempotency` |

Exact verifier는 `pg_trigger`, target `pg_class/pg_namespace`, `tgfoid`, `tgtype`, `tgenabled`와 normalized `pg_get_triggerdef`의 exact set을 비교한다. missing/extra/wrong table/timing/event/level/function/enabled state를 모두 거부한다. Function name/schema/owner/language/source identity와 runtime/PUBLIC `EXECUTE`, grant option을 exact 검증한다. 현재 verifier의 trigger-name-only check는 insufficient하며 모든 5 verifier가 변경되어야 한다.

## Exact aggregate readiness contract

각 domain verdict는 checksum, schema version/fingerprint, exact table/column/type/null/default, PK/UQ/FK/CHECK/index, schema/table/function owner, exact trigger/function topology, direct runtime ACL, effective runtime privileges, grant options, PUBLIC leakage, unexpected third-role membership/authority를 검증한다. Aggregate readiness는 같은 read-only catalog snapshot에서 다섯 verdict가 모두 PASS일 때만 PASS다.

`app_publication AND app_administration AND app_connector AND app_external_integration AND app_advisory` 외의 partial result, missing result, exception concealment, fallback 또는 table-existence-only success는 `R3B1_CHILD_ROOT_SCHEMA_NOT_READY`다. Runtime migration/repair는 0이다.

## Existing 26-file candidate impact

| Classification | Candidate impact |
|---|---|
| `UNCHANGED_VALID` | Publication/Administration/Connector/Advisory migration semantics and sidecars subject to unchanged bytes; five ACL files; no new role/pool/runtime authority |
| `REQUIRES_AMENDMENT` | External migration + sidecar for ordinal/FKs/TEXT JSON; R3-B1 trace/completion statements after AO disposition |
| `REQUIRES_REMOVAL` | Whole-file removal 0; External candidate `jsonb` column definitions are replaced, not retained |
| `REQUIRES_NEW_TEST` | ordering under concurrent writes, duplicate ordinal, orphan preflight/FK rejection, External byte-preserving JSON, Advisory canonical JSONB parity, exact trigger drift, third-role/effective privilege and aggregate partial-readiness cases |
| `REQUIRES_VERIFIER_CHANGE` | all five `001_schema_v1.verify.sql` files and aggregate `child-root-postgresql-readiness.ts` |

## Governance disposition

새 DEC/CR ID는 필요하지 않다. 다음 bounded clarification을 기존 authority에 amendment로 AO 승인하는 것이 최소 변경이다.

- `DEC-195`: External aggregate-local ordinal, exact three-FK matrix, External TEXT JSON / Advisory JSONB, schema catalog metadata를 명시한다.
- `DEC-197`: exact trigger/function topology와 owner/direct/effective privilege를 포함하는 per-domain 및 atomic aggregate readiness를 명시한다.
- `CR-030`: 위 semantics를 R3-B1 migration/verifier/readiness/tests의 acceptance criteria로 추가한다.

Amendment 상태는 `APPROVED / IMPLEMENTED CANDIDATE`다. R3-B1B 검증과 independent review 전 commit은 생성하지 않으며 Production execution은 별도 승인 전 계속 금지된다.
