# REL-002 Phase 2D-0C PostgreSQL Adapter Implementation Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-327 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner / Identity Owner / Operations Owner |
| 적용 범위 | REL-002 Phase 2D-0C |

## 1. Traceability

| Requirement | Implementation | Verification | Status |
|---|---|---|---|
| approved PostgreSQL driver only | `package.json`, `pnpm-lock.yaml`: `pg`; compilation-required `@types/pg` | dependency diff inspection | PASS |
| bounded pool and safe shutdown | `modules/identity/src/postgresql-pool.ts` | `postgresql-pool.test.ts` | PASS |
| one-client async Session UoW | `modules/identity/src/session-postgresql-persistence.ts` | commit, rollback, release, CAS tests | PASS |
| read-only workload authority | `modules/identity/src/registered-service-workload-postgresql.ts` | immutable decode/evidence/fail-closed tests | PASS |
| exact catalog compatibility | `modules/identity/src/registered-service-workload-postgresql-schema.ts` | missing/incompatible/version/partial-ledger tests | PASS |
| explicit PostgreSQL Up/Verify artifact | `modules/identity/migrations/postgresql/production/001_identity_persistence_v1.*.sql` | static contract/fingerprint/no-seed tests | PASS |
| async Railway bootstrap boundary | `apps/api/src/production-bootstrap.ts`, `production-bootstrap-engine.ts` | async order, pre-gate zero-effect, reverse cleanup tests | PASS |
| Production SQLite rejection | `identityPersistenceEngine = POSTGRESQL` invariant 및 canonical child-root `databasePath` 사전 차단 | Identity engine 및 전체 canonical root SQLite rejection tests | PASS |
| SQLite local/test preservation | existing SQLite adapters remain unchanged | Identity affected regression | PASS |
| no Production/external effects | no physical binding, credential, connection or executor | diff and test inspection | PASS |

## 2. Preserved boundaries

- Supabase project creation, Production connection, migration execution, Production DB writes, identity seed, Railway deployment and Vercel changes are `0`.
- Supabase Auth, ORM, new API, new role/capability and new authentication authority are not introduced.
- SQLite is rejected by the Production Identity composition contract and remains unchanged for local/test/historical evidence.
- Non-Identity child-store PostgreSQL transition is not claimed by this phase; 그 전까지 canonical Production entry 전체가 fail closed한다.

## 3. Remaining gates

`REL002-GAP-004`, `REL002-GAP-005`, `REL002-GAP-006` remain blocking until physical Supabase binding, secret/operator/backup/restore evidence, controlled migration execution, compatible schema and authoritative Production registrations exist.
