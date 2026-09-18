# REL-002 Phase 2A Migration Execution Safety Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-306 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Data Owner / Operations Owner / Security Owner |
| 기준일 | 2026-09-18 |
| Execution authority | NOT AUTHORIZED |

## 1. Preconditions

Execution requires a later explicit AO authorization and all of the following evidence:

1. target environment exactly `PRODUCTION` and target database identity fixed
2. approved change/release reference and independently authorized human operator with MFA
3. Data/Operations/Security review appropriate to high-risk schema change
4. verified recoverable checkpoint/backup and isolated restore evidence
5. immutable migration artifact checksum bound to DEC-172/173-ratified contract and exact Identity-owned migration ledger contract
6. maintenance window, listener/worker/provider stop proof and one migration executor
7. read-only preflight classification and capacity/free-space check
8. post-migration Phase 1G exact checker available before runtime start

No new role/capability is proposed. The exact executable Production migration authority remains a later deployment/security control gate; `release.accept` does not grant migration execution.

## 2. Execution sequence

```text
authorize exact change and operator
→ verify backup/restore evidence
→ stop runtime writers and designate one migration executor
→ BEGIN IMMEDIATE
→ reclassify database state under the acquired lock
→ apply exact v1 schema + shared contract metadata + migration ledger row only
→ run exact structural/version/fingerprint verification
→ COMMIT or ROLLBACK
→ reopen read-only and reverify
→ record bounded evidence
→ only then allow startProductionRuntime() evaluation
```

## 3. Concurrency and failure

- SQLite `BEGIN IMMEDIATE` is the bounded schema lock for the approved single-database artifact.
- timeout/lock contention, unexpected state, partial artifact, verification mismatch or migration-ledger evidence write failure blocks completion.
- no parallel migration executor, runtime writer, listener or worker is allowed.
- same migration ID/checksum/contract/ledger and compatible schema is a no-op; same ID with different checksum/contract is conflict.
- schema without exact ledger or ledger without compatible schema is partial migration, not successful replay/adoption.
- commit ambiguity is resolved by read-only schema plus ledger classification; migration is not blindly replayed.
- error evidence contains safe codes/references only, not path, SQL, stack, row values or secrets.

## 4. Rollback and recovery

- failure before commit: transaction rollback and post-rollback state verification
- failure after commit: retain v1 schema; choose approved application rollback if compatible or a new forward-fix migration
- no automatic `DROP TABLE`, row deletion or metadata downgrade
- restore is isolated and requires current authority/data/evidence validation before cutover
- rollback/restore does not create or reactivate service identities

## 5. Verification evidence

The transaction requires pre-existing validated change/operator evidence references and atomically records migration ID/checksum, contract/version/fingerprint, target environment, applied time and `APPLIED` result in `identity_schema_migrations`. External completion evidence adds backup/approval references, pre/post state, transaction outcome, post-open checker result, runtime-not-started proof and exception disposition. The ledger is not a final API-016 event and introduces no Audit vocabulary.

## 6. Scope boundary

This plan executes nothing. Migration execution, Production database access, infrastructure configuration, credentials, provider/network use and deployment remain `0`.
