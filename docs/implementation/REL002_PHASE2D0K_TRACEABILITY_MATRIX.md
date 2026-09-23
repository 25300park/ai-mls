# REL-002 Phase 2D-0K Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-357 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Development / Security Owner |
| 기준 Main | `43fb874d944e3a71ab5e9265e1c811ac0241bd5e` |

| Requirement | Artifact / evidence | State |
|---|---|---|
| Exact two role creation | `000_production_role_creation.sql` | IMPLEMENTED, NOT EXECUTED |
| Least-privilege attributes | creation artifact + focused test | PASS statically |
| No embedded authentication material | creation artifact + focused test | PASS |
| Separate secure binding | [binding procedure](REL002_PHASE2D0K_ROLE_CREATION_PASSWORD_BINDING_PROCEDURE.md) | PREPARED, NOT EXECUTED |
| Existing grant contracts unchanged | `002_runtime_role_grants.sql`, `003_migration_operator_role_grants.sql` | PRESERVED |
| Pre-migration role/database checks | `003a_pre_migration_role_privilege_verification.sql` | IMPLEMENTED, NOT EXECUTED |
| Positive/negative privilege checks | `004_production_role_privilege_verification.sql` | IMPLEMENTED, NOT EXECUTED |
| Controlled order and abort rules | [runbook](REL002_PHASE2D0K_CONTROLLED_EXECUTION_RUNBOOK.md) | PRE: 003a; POST: 004 |
| Verification checklist | [checklist](REL002_PHASE2D0K_PRIVILEGE_VERIFICATION_CHECKLIST.md) | DEFINED |

Execution counters remain: role creation `0`, password binding `0`, migration `0`, Production connection/write `0`, Railway/Supabase/Vercel mutation `0`.
