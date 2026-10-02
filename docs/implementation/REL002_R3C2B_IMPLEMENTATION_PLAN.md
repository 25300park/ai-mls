# REL-002 R3-C2B Implementation Plan

Document ID: DOC-DEV-391 / 버전: v0.1 / 상태: DRAFT / 소유: Identity Owner / Audit Owner / Architecture Owner

Goal: 승인된 두 durable evidence record, PostgreSQL read/materialization, distinct lifecycle evidence의 atomic replacement를 구현한다. 기준선 89b4885db54e9e6bcfb12a8b21b10e37c6a373bf. Worktree는 isolated rel002-r3c2-runtime-startup만 사용한다.

Architecture: Identity proof persistence는 Identity, audit projection validation/materialization은 Audit가 소유한다. Existing pool/client lifecycle를 재사용하고 Identity replacement transaction에 Audit-owned materialization port가 참여한다. Runtime resolver 및 R3-D는 시작하지 않는다.

Tech Stack: existing TypeScript/PostgreSQL pool port; new dependency/role/provider 없음.

Spec: [Approved R3-C2A contract](REL002_R3C2A_DURABLE_EVIDENCE_READ_CONTRACT.md)과 final Human/AO event approval. Earlier OPEN DECISION sections는 historical이며 final approval section이 우선한다.

## Authority gate

RESOLVED C2B-ACL-1: Human/AO가 기존 ai_mls_production_runtime의 Audit projection SELECT+INSERT 및 Audit-owned materializer의 Identity-owned 동일 transaction 참여를 승인했다. UPDATE/DELETE/DDL/GRANT, 새 role 및 migration credential의 runtime 사용은 금지한다.

## Bounded file surface

- modules/identity/src/identity-workload-evidence-postgresql.ts: independent immutable proof validation/lookup.
- modules/audit/src/audit-evidence-read-postgresql.ts: Audit-owned projection read, exact decoder, append-only deterministic materialization.
- modules/identity/src/workload-startup-binding.ts 및 workload-startup-binding-postgresql.ts: distinct old/new refs, evidence participant, own transaction/CAS/replay.
- 각 owner의 새 forward-only migrations/verifiers; approved migration 변경 금지.
- apps/api/src/r3c2b-postgresql-readiness.ts 및 focused/disposable tests: 두 record의 exact readiness/ACL/owner 검증; resolver activation 없음.

## Verification sequence

- [x] ACL gate 확정 및 source/table/decoder detail 설계. 두 record 이외 storage 추가 금지.
- [x] TDD: exact proof tuple/version, final event envelope/payload, malformed/ref/conflict/replay regression RED.
- [x] GREEN: two bounded record schemas, append-only constraints, minimal approved ACL와 read/materialization adapters.
- [x] TDD/GREEN: old/new distinct event/ref, atomic replacement 및 rollback, ambiguous COMMIT quarantine, client release, concurrency/idempotency.
- [x] Disposable PostgreSQL: exact migration/readiness replay, ACL/PUBLIC/grant option/role exclusion, restart-safe reads, max=1 pool.
- [x] Focused/affected/full regression/build/lint/typecheck/diff/secret scan/independent review.
- [x] Completion report. Commit NOT_CREATED until separate closeout authorization.

Historical immutable fingerprint test와 existing approved migrations는 변경하지 않는다. Production deployability BLOCKED; listener/workers NOT_STARTED; Production/Railway/Supabase mutation 0/0/0; push/deploy 없음.

## 확정된 registration audit profile

Human/AO의 2026-10-02 exact event profile 승인으로 C2B-REGISTRATION-PROFILE은 RESOLVED다. sourceDomain=IDENTITY, aggregateType=REGISTERED_SERVICE_WORKLOAD, eventType=REGISTERED_SERVICE_WORKLOAD.REGISTERED, aggregateId=registrationId, aggregateVersion=registrationVersion, final=true다. Payload는 registrationId/registrationVersion/tenantId/principalId와 기존 classification SERVICE/WORKLOAD/PRODUCTION을 exact match한다. 현재 ACTIVE, authorization 또는 startup eligibility를 의미하지 않는다.

## 최종 검증 상태

Focused 11 PASS; disposable R3-C2B 8 PASS 및 affected R3-C1 disposable 9 PASS; affected unit 36 PASS. Full regression 1731 PASS / 1 승인된 immutable historical fingerprint mismatch / 15 SKIP. Build/Lint/Typecheck PASS. Independent review APPROVED이며 두 finding을 RED로 재현해 수정했다. [완료 보고서](../reviews/REL002_R3C2B_COMPLETION.md)에 범위와 한계를 기록한다.

Runtime resolver/composition은 활성화하지 않았다. 두 새 record schema의 readiness는 disposable PostgreSQL에서만 검증했다. Actual Production schema readiness를 확인한 것이 아니다. Commit NOT_CREATED; Push NOT_PERFORMED; Production/Railway/Supabase mutation 0/0/0.