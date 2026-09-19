# REL-002 Phase 2D-0B PostgreSQL Migration Artifact Design

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-324 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준 Main | `cc588e4c9fd26133cc53d3268562badd2a513640` |

## 1. Canonical artifact proposal

DEC-181은 다음 별도 PostgreSQL artifact를 canonical Production candidate로 승인한다.

- Up artifact: `modules/identity/migrations/postgresql/production/001_identity_persistence_v1.up.sql`
- Verify artifact: `modules/identity/migrations/postgresql/production/001_identity_persistence_v1.verify.sql`
- Migration ID: `REL002-P2D0B-IDENTITY-PG-V1`
- Engine: `POSTGRESQL`
- Environment: `PRODUCTION`
- Identity contract IDs: `identity.session`, `identity.registered-service-workload`
- Schema version: `1`
- Checksum/fingerprint: `GENERATED_AT_IMPLEMENTATION`

The existing SQLite Phase 2B artifacts and evidence are not edited and are `RETAIN_HISTORICAL_ONLY` for Production.

## 2. Artifact contents

The Up artifact must contain only deterministic, forward-only DDL for:

1. `app_identity` namespace;
2. `identity_schema_contracts`;
3. `identity_schema_migrations`;
4. `identity_sessions`;
5. `identity_session_revocations`;
6. `identity_registered_service_workloads`;
7. exact constraints/indexes;
8. exact append-only revocation trigger/function;
9. exact contract metadata rows.

It contains zero Session or workload identity seed rows, credentials, roles/scopes/capabilities, or final API-016 business evidence. Migration ledger evidence is written by the controlled migration executor in the same transaction after artifact verification, not silently authored by runtime startup.

## 3. Atomic controlled execution

```text
operator authorization + exact target + backup/restore evidence
→ connect with separate migration technical role
→ acquire bounded PostgreSQL advisory lock
→ BEGIN
→ preflight empty/exact replay/conflict classification
→ apply static Up artifact
→ insert contract rows
→ run Verify artifact in same transaction
→ append exact migration ledger row
→ COMMIT
→ post-commit independent compatibility validation
```

Any pre-commit failure rolls back the transaction. Post-commit defect uses governed forward-fix; destructive down migration is prohibited. Advisory lock identity is a deterministic constant derived from migration ID and is not caller-controlled. Lock timeout must be an explicit execution-packet value.

## 4. Replay and conflict

| Existing state | Result |
|---|---|
| no owned schema objects/metadata | eligible for authorized execution |
| exact objects + exact ledger ID/checksum/contracts | deterministic no-op replay, then verify |
| objects without ledger or ledger without objects | `PARTIAL`, fail closed |
| same migration ID, different checksum | conflict, fail closed |
| same contract/version/engine, different fingerprint | conflict, fail closed |
| unknown owned object | incompatible, fail closed |

No automatic repair, drop, truncate, overwrite or SQLite-to-PostgreSQL translation occurs.

## 5. Verify artifact

The SQL verify artifact performs bounded structural assertions suited to PostgreSQL, while the runtime TypeScript validator independently inspects `pg_catalog`. Both must agree before readiness can be `READY`. The verify artifact never writes business data.

## 6. Execution separation

- Railway runtime technical role cannot execute this artifact.
- `startProductionRuntime()` never imports or runs it.
- Supabase dashboard/editor execution is not an implicit approved mechanism.
- Exact operator, target project/database/region/mode, backup and restore evidence remain required in a future execution packet.
- No Phase 2D-0B migration execution, Production DB write or infrastructure mutation is authorized.

## 7. Tests required before execution authorization

- clean ephemeral PostgreSQL apply + exact verify;
- exact replay stability;
- checksum/fingerprint conflict;
- partial object/ledger state;
- rollback on each injected DDL/metadata/verify failure;
- advisory lock contention/timeout;
- zero identity/session seed;
- append-only trigger enforcement;
- runtime role cannot DDL or mutate ledger;
- migration role cannot become application business authority;
- SQLite artifact cannot be selected for Production;
- unsafe diagnostic leakage `0`.

The harness may use local ephemeral PostgreSQL or an approved pre-provisioned non-Production database. New dependency/package or external Supabase use requires separate approval.

## 8. Related documents

- [PostgreSQL Schema Contract](REL002_PHASE2D0B_POSTGRESQL_SCHEMA_CONTRACT.md)
- [Validator Design](REL002_PHASE2D0B_SCHEMA_COMPATIBILITY_VALIDATOR_DESIGN.md)
- [Implementation Plan](REL002_PHASE2D0B_IMPLEMENTATION_PLAN.md)
