# REL-002 R3-B Implementation Phase Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-370 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Development Owner |
| 선행 조건 | DEC-195–198 APPROVED; CR-030 implementation authorized after R3-B0 main integration |

## Dependency-safe sequence

| Phase | Bounded result | Exit gate |
|---|---|---|
| R3-B1 | five schema specifications, forward migrations/verifiers, exact grants/readiness contract | disposable PostgreSQL schema/ACL verification; no Production execution |
| R3-B2 | canonical async port foundation and SQLite parity adapters | compiler-clean call chains and repository contract parity |
| R3-B3 | Administration PostgreSQL adapter | API-015 atomicity/SoD/idempotency parity |
| R3-B4 | Publication PostgreSQL adapter | API-014 execution journal/event/audit parity |
| R3-B5 | External Integration PostgreSQL adapter | API-019 ordering/FK decisions ratified and parity green |
| R3-B6 | Connector Execution PostgreSQL adapter | API-018 lease/invocation/checkpoint behavior and API-019 dependency green |
| R3-B7 | Advisory PostgreSQL adapter | FEAT-022 persistence parity; provider execution remains separately blocked |
| R3-B8 | shared-pool composition and aggregate schema readiness | five child roots wired, null boundary removed only under explicit implementation approval |

Administration precedes Publication because authorization/governance persistence is a prerequisite for safe operations. External Integration precedes Connector because Connector technical records can depend on the external-observation sink. Advisory remains last among adapters because live provider activation is independent and must not be implied.

## Proposed change requests

- `CR-030` (`APPROVED`): five child-root PostgreSQL schemas, migrations, verifiers and exact ACLs; R3-B1 implementation only, Production execution excluded.
- `CR-031` (`APPROVED` for planning): async persistence contract conversion with SQLite/PostgreSQL parity; phase-specific implementation authorization required.
- `CR-032` (`APPROVED` for planning): shared pool, aggregate readiness and Production child-root composition integration; phase-specific implementation authorization required.

## Per-phase controls

Every phase starts with focused RED tests, applies the minimum bounded implementation, then runs focused → affected → disposable PostgreSQL → full regression only where shared contracts require it. No phase may execute Production SQL, deploy Railway or alter secrets without a separate AO execution authorization.

## Stop conditions

Stop if a phase requires new role/capability/auth authority, a second secret path, automatic migration, SQLite Production fallback, blocking wrapper around `pg`, provider activation, or unapproved contract changes.
