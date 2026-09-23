# REL-002 PostgreSQL PUBLIC TEMPORARY Compatibility Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-359 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Development / Security Owner |
| 기준 Main | `078b07cb1ac7288dbf98d1fe1aa1aa63e3fd8487` |

| Requirement | Implementation / evidence | State |
|---|---|---|
| PUBLIC-inherited TEMPORARY accepted as platform baseline | [Compatibility Contract](REL002_POSTGRES_PUBLIC_TEMPORARY_COMPATIBILITY_CONTRACT.md) | APPROVED — DEC-192 |
| Direct TEMPORARY prohibited for both roles | `004_production_role_privilege_verification.sql` direct ACL inspection | IMPLEMENTED, NOT EXECUTED |
| Effective TEMPORARY does not fail verification by itself | `effective_temporary_observed` separated from `matches_expected` | IMPLEMENTED, NOT EXECUTED |
| Migration direct DB privileges exact | `003_migration_operator_role_grants.sql`; focused tests | CONNECT + CREATE only |
| Runtime direct DB privileges exact | `002_runtime_role_grants.sql`; focused tests | CONNECT only |
| Protected role attributes remain prohibited | `000_production_role_creation.sql`; `004` role checks | PRESERVED |
| Unexpected direct grant option prohibited | `004` database/schema/table checks | IMPLEMENTED, NOT EXECUTED |
| Unexpected target-role membership prohibited | `004` membership direction check | PRESERVED |
| No temporary-table dependency introduced | SQL artifacts and bounded diff review | PASS |
| Production mutation | Execution counter | 0 |

DEC-192 AO ratification is complete. Production SQL execution, migration execution and runtime grant execution remain outside this change.
