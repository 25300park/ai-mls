# REL-002 R3-C3B2B Implementation Plan

> 실행: superpowers:executing-plans, TDD. 현재 AO 승인 계약만 구현하고 commit은 만들지 않는다.

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-395 |
| 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |

**Goal:** Identity-owned first-party async authentication persistence/adapter를 구현한다.
**Architecture:** app_identity 2개 table, SELECT-only runtime credential read, native async Argon2id, captured verifier identity의 동일 Session transaction 재검증. 기존 Session authority와 PG_PRODUCTION_POOL을 재사용하고 B3/final gate는 활성화하지 않는다.
**Tech Stack:** TypeScript, node:crypto, PostgreSQL, node:test.
**Spec:** [B2A final AO contract](../reviews/REL002_R3C3B2A_COMPLETION.md), 현재 B2B brief.

## Constraints / Review Focus

- ARGON2ID_V1: 19456 KiB / passes 2 / parallelism 1 / tagLength 32 / saltLength 16; pepper/dependency/fallback 없음.
- Evidence password는 request-private이며 DB/Session/audit/errors/logs에 전달하지 않는다.
- Credential runtime write와 historical credential mutation을 금지한다.
- Login verification과 transaction 재검증 사이 principal/credential/version/profile/hash 변경은 fail-closed한다.
- Zero rows는 readiness PASS; zero/multiple ACTIVE는 authentication FAIL.
- B3/C3 Final/C4/R3-D/listener/workers/Production 접근/push/commit 금지.

## Tasks

1. modules/identity/src/first-party-credential-argon2.ts 및 test: native-only runtime detection, exact profile, correct/wrong verification, random salt, safe error RED→GREEN.
2. modules/identity/src/first-party-credential-contracts.ts / first-party-credential-postgresql.ts 및 직접 tests; forward 015 migration/checksum/readiness. Exact principals/ACTIVE credentials, readonly hydration/cleanup/ACL.
3. FirstPartyCredentialAuthenticationAdapter: evidence/config validation, exact initial reads, capture WeakMap, async verification와 transaction client 재검증. Normalization/tenant context는 현재 AO 답변을 적용한다.
4. 기존 AuthenticationAdapter/SessionService/IdentityApi와 affected stubs/tests를 async로 normalize. 기존 PostgreSqlSessionUnitOfWork 안에 bounded revalidation participant를 넣고 같은 transaction의 Session insert/rollback을 재사용한다. Local/Test 기존 Session authority는 유지한다.
5. Readiness binding registration/config/primitive/schema/SELECT ACL; no login 또는 mutation.
6. Focused → disposable PostgreSQL → affected → build/lint/typecheck/full regression → diff/secret scan → 독립 리뷰. 보고서 작성 후 STOP, commit 없음.

## Ledger

- HEAD d137a010537e99e28709b98f209aa87d696d1409; historical untracked reports 4개 보존.
- AO 승인: loginIdentifier는 OPAQUE_EXACT_IDENTIFIER이며 normalization은 NONE이다. trusted Identity caller의 expectedTenantId와 exact loginIdentifier를 함께 조회하고 tenant-scoped uniqueness를 적용한다. Evidence는 tenant authority를 제공하지 않는다.
- 독립 리뷰 P1 2건 수정: principal별 shared transaction advisory lock과 신규 table의 exclusive write guard로 재검증부터 Session commit까지 변경을 차단한다. 재검증 가능한 adapter는 async Session UoW 없이 구성할 수 없다. Runtime SELECT-only ACL은 유지한다.
- 구현 및 검증 결과는 [B2B Completion](../reviews/REL002_R3C3B2B_COMPLETION.md)에 기록한다. Commit은 생성하지 않는다.
