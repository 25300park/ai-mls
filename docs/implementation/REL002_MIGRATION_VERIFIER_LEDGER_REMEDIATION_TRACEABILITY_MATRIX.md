# REL-002 Migration Verifier + Ledger Remediation Traceability Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-360 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Development / Security Owner |
| 기준 Main | `6de0145ed280386f6a878e04b213988c80ee3c7a` |

| Requirement | Implementation / evidence | State |
|---|---|---|
| PostgreSQL canonical version CHECK deparse | `001_identity_persistence_v1.verify.sql`; exact three approved expectations | PASS |
| Exact 15 CHECK inventory and semantics | verifier full join plus disposable PostgreSQL negative/positive cases | PASS |
| Exact index verification | `rel.relname` included in the aggregate grouping key; complete verifier execution | PASS |
| Exact trigger-function source verification | outer `btrim(proc.prosrc)` before existing normalization; exact body and metadata checks retained | PASS |
| Historical migration immutability | `001_identity_persistence_v1.up.sql` SHA-256 `b3b1ec9e1cf3b43abecba19acda9c99a126b4a12f09c7547594973bf6607546e` | PRESERVED |
| One-time ledger remediation | `005_record_existing_identity_migration_v1.sql` | READY, NOT EXECUTED IN PRODUCTION |
| Exact schema/table/contract preconditions | 005 exact five tables, two contracts and fifteen CHECKs | PASS |
| Execution-time provenance | bounded operator/backup evidence references and explicit finite timezone-bearing `applied_at` | PASS |
| Duplicate/conflict handling | empty-ledger precondition, no upsert/update/delete, exact-one insert | PASS |
| Canonical order | [controlled execution runbook](REL002_PHASE2D0K_CONTROLLED_EXECUTION_RUNBOOK.md) | `001` → verify → `005` → ledger/readiness verification |
| Complete disposable PostgreSQL execution | `production-migration-remediation.integration.test.ts` | 6/6 PASS; no verifier stage skipped |
| Production safety | Production mutation, 005 execution, runtime grants, role changes and deployment | 0 |

Historical `001` rerun remains `PROHIBITED`. For the already-applied Production schema the permitted future operational sequence is verify-fixed → `005` → ledger/readiness verification, subject to a separate execution authorization.
