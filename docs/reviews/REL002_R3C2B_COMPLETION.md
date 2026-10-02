# REL-002 R3-C2B Completion Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-266 |
| Version | v0.1 |
| Status | DRAFT |
| Owner | Architecture Owner / Identity Owner / Audit Owner |
| Completion date | 2026-10-02 |
| Brief | REL-002 R3-C2B — Durable Evidence PostgreSQL Persistence / Materialization / Read Adapter |

## 1. Objective

Isolated worktree `D:/04. AI-MLS/.worktrees/rel002-r3c2-runtime-startup`, branch `codex/rel002-r3c2-runtime-startup`, baseline `89b4885db54e9e6bcfb12a8b21b10e37c6a373bf`에서 승인된 두 durable evidence record와 read/materialization adapter를 구현했다. Identity transaction에서 old REVOKED와 new ACTIVE binding 및 두 distinct final Audit mapping을 atomically commit한다. Runtime resolver, listener/workers와 R3-D는 시작하지 않았다.

## 2. Documents read

- [R3-C2A Durable Evidence Contract](../implementation/REL002_R3C2A_DURABLE_EVIDENCE_READ_CONTRACT.md): 독립 immutable proof 및 final Audit projection.
- [R3-C2B Implementation Plan](../implementation/REL002_R3C2B_IMPLEMENTATION_PLAN.md): 승인 범위와 검증 순서.
- [Decision Register](../00_DECISION_REGISTER.md): DEC-169 및 기존 authority boundary.
- [Phase Completion Template](../templates/PHASE_COMPLETION_TEMPLATE.md).
- Human/AO exact registration event/profile와 Audit SELECT+INSERT 및 동일 transaction 참여 승인.

## 3. Files created

- [Identity proof adapter](../../modules/identity/src/identity-workload-evidence-postgresql.ts).
- [Audit read/materialization adapter](../../modules/audit/src/audit-evidence-read-postgresql.ts).
- [Identity migration 013](../../modules/identity/migrations/postgresql/production/013_identity_workload_evidence_v1.up.sql), SHA256 sidecar와 read-only verify SQL.
- [Audit migration 001](../../modules/audit/migrations/postgresql/production/001_audit_evidence_read_v1.up.sql), SHA256 sidecar와 read-only verify SQL.
- [Exact readiness](../../apps/api/src/r3c2b-postgresql-readiness.ts).
- [Focused evidence tests](../../apps/api/src/rel002-r3c2b-evidence.test.ts), [readiness tests](../../apps/api/src/rel002-r3c2b-readiness.test.ts), [disposable PostgreSQL tests](../../apps/api/src/rel002-r3c2b-postgresql.integration.test.ts).
- 본 보고서와 implementation plan.

## 4. Files modified

- [Binding persistence contract](../../modules/identity/src/workload-startup-binding.ts): evidence-aware transition과 distinct event pair replacement.
- [Identity binding PostgreSQL store](../../modules/identity/src/workload-startup-binding-postgresql.ts): 동일 owner transaction, sorted lock hierarchy, exact replay에서도 두 immutable mapping 검증; shared-ref 및 evidence-free transition 차단.
- [Existing R3-C1 PostgreSQL tests](../../apps/api/src/rel002-r3c1-postgresql.integration.test.ts): 기존 CAS/rollback/replay/race coverage를 보존하며 승인된 Audit pair fixture를 사용한다. 기존 port 55439 및 전용 disposable port 55441만 명시적 CONFIRMED opt-in으로 허용한다.
- [Master Index](../00_MASTER_INDEX.md): isolated worktree의 새 문서 두 개만 등록한다. Primary checkout의 같은 파일 변경은 보존했다.

## 5. Key decisions added

새 role/provider/authority/ADR를 만들지 않았다. Human/AO가 승인한 registration establishment event는 `REGISTERED_SERVICE_WORKLOAD.REGISTERED`, aggregateType은 `REGISTERED_SERVICE_WORKLOAD`다. Binding lifecycle는 `WORKLOAD_STARTUP_BINDING.ACTIVATED` / `WORKLOAD_STARTUP_BINDING.REVOKED`다. 세 profile은 payloadSchemaVersion=1, final=true, exact identity/envelope equality를 요구한다. Registration establishment는 current lifecycle/authorization/startup eligibility를 부여하지 않는다.

Identity-owned `app_identity.identity_workload_evidence`는 independent immutable proof이며 runtime SELECT-only다. Audit-owned `app_audit.audit_evidence_read_records`는 JSONB payload의 append-only final projection이며 runtime SELECT+INSERT만 승인됐다. UPDATE/DELETE/DDL/GRANT OPTION은 허용하지 않는다. Audit-owned participant는 Identity-owned client에서 BEGIN/COMMIT/ROLLBACK/release를 수행하지 않는다. No seed/backfill/runtime migration.

## 6. Open decisions

None. Registration event profile과 bounded Audit ACL의 미결정은 Human/AO 승인으로 해소됐다. R3-C2 runtime resolver 재개는 별도 승인 단계이며 본 Brief에서 수행하지 않았다.

## 7. Inconsistencies found

기존 single audit ref replacement는 승인된 한 event/한 aggregateVersion contract와 불일치해 fail closed로 교체했다. Independent review의 evidence-free transition 및 standalone fictitious replacement lineage finding을 각각 RED로 재현하고 수정했다. Existing C1 test assertions는 유지하고 fixture만 새 contract로 갱신했다.

Historical fingerprint failure는 승인된 immutable historical-candidate mismatch다. Expected `7fef924f0178d732ca4a1bd4ee5c83c0eea7a5dafb8b1a2a28747784bbe5c659`, actual `90c6fdac84e6b470c6b935767717223bf6c94e0caa98d2ac816a4d8749bc74e6`. 해당 테스트, approved prior migrations 및 historical Production evidence/status는 변경하지 않았다.

## 8. Validation performed

| 검사 | 결과 |
|---|---|
| Focused evidence/readiness | 11 PASS |
| Disposable R3-C2B PostgreSQL | 8 PASS |
| Affected R3-C1 disposable PostgreSQL | 9 PASS |
| Affected unit tests | 36 PASS |
| Full regression | 1731 PASS / 1 authorized historical fingerprint failure / 15 SKIP |
| Build / Lint / Typecheck | PASS / PASS / PASS |
| Independent review | APPROVED; two findings fixed, re-reviewed |
| Atomicity / idempotency / concurrency | PASS; same-client dual evidence commit, failure rollback and replay/race |
| Exact readiness / runtime role / migration exclusion | PASS against disposable PostgreSQL |
| PG_PRODUCTION_POOL | Existing injected port 재사용; runtime pool/secret composition 변경 없음 |
| Physical Production pool count | 1 유지; 새 adapter의 physical pool construction 없음 |
| Runtime SQLite / raw DATABASE_URL / runtime DDL | ABSENT |
| git diff --check / new-file whitespace | PASS |
| Scoped secret-pattern scan | PASS |
| New documentation links / scope restrictions | PASS |

## 9. Known limitations

Readiness READY는 dedicated disposable PostgreSQL의 두 새 evidence root에 한정한다. Actual Production은 query/mutation하지 않았으며 verified Production schema readiness로 표현하지 않는다. Evidence read adapters는 future runtime resolver에 연결하지 않았다. Proof provisioning 및 실제 registration authority initialization은 수행하지 않았다. Native validation cluster와 logs는 ignored local `.tmp`에만 둔다. Production deployability BLOCKED.

Primary checkout의 ownership-unknown Master Index 변경과 untracked R3-D design은 복사·수정·stage하지 않았다. API-016은 Audit/History boundary로 유지하며 별도 Identity authority를 만들지 않았다.

## 10. Next brief prerequisites

R3-C2B closeout 승인이 필요하다. 본 결과가 승인된 뒤 별도 R3-C2 runtime resolver 재개 지시를 받아 existing registered workload/evidence/authorization -> startup gate -> aggregate readiness ordering으로 연결한다. Listener/workers 및 R3-D를 자동 시작하지 않는다.

## Completion statement

Implementation 및 verification gate는 승인된 historical test 예외를 보존한 상태로 충족했다. FINAL_RECOMMENDATION=APPROVE_REL002_R3C2B_DURABLE_EVIDENCE_POSTGRESQL_PERSISTENCE. Commit NOT_CREATED. Push NOT_PERFORMED. Production/Railway/Supabase mutation 0/0/0. Production deployability BLOCKED. 다음 Brief는 시작하지 않았다.
