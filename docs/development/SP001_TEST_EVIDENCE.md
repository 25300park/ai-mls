# SP-001 Test Evidence

| 항목 | 값 |
|---|---|
| 문서 버전 | v0.1 |
| 문서 상태 | DRAFT |
| Sprint | SP-001 |
| 검증 일자 | 2026-07-19 |
| 기준 커밋 | `b5542c4` |
| Feature | FEAT-001–003, FEAT-016, FEAT-017, FEAT-023 |
| Developer Task | DEV-001–003, DEV-016, DEV-017, DEV-023 |
| Implementation ID | IMP-001–003, IMP-016, IMP-017, IMP-023 |
| Test | TEST-005, TEST-006, TEST-009, TEST-026, TEST-034, TEST-046–049, TEST-053 |

이 문서는 [SP-001 Implementation Plan](SP001_IMPLEMENTATION_PLAN.md)의 실행 증거이며, 완료 판정은 [SP-001 Completion Report](../reviews/SP-001_COMPLETION.md)에 기록한다.

## 1. 검증 환경

| 도구 | 검증 버전 |
|---|---|
| Node.js | 24.18.0 |
| TypeScript | 6.0.3 |
| pnpm | 11.9.0 |
| npm | 11.16.0 |
| typescript-eslint | 8.64.0 |
| Gitleaks | 8.30.1 |

Docker, database, HTTP framework와 external identity provider는 SP-001 검증에 사용하지 않았다.

## 2. Test-first 실행 증거

각 구현 단위는 구현 파일이 없는 상태의 compile failure 또는 missing-module failure를 먼저 확인한 뒤 최소 구현과 regression test를 실행했다.

| 영역 | RED 증거 | GREEN 증거 | 연결 Test |
|---|---|---|---|
| Audit | `audit-log` 구현 부재 실패 | immutable append/query/correction 및 sensitive detail 거부 통과 | TEST-006/034/049 |
| Identity/session | `session-service` 구현 부재 실패 | generic failure, bounded session, expiry, refresh rotation/replay revoke 통과 | TEST-026/046 |
| Authorization | `authorization-service` 구현 부재 실패 | default deny, scope, MFA/reason, human authority와 SoD 통과 | TEST-009/046/047 |
| Administration | `administration-service` 구현 부재 실패 | two-person proposal/approval/revoke, version/effective period 통과 | TEST-005/034/047/048 |
| Privacy/security | `privacy-controls`와 `security-events` 구현 부재 실패 | highest classification, masking, sanitization, monitoring evidence 통과 | TEST-048/049/053 |
| API boundary | `identity-api`와 `admin-audit-api` 구현 부재 실패 | stable envelope, session actor, authorization ordering, correlation propagation 통과 | TEST-006/009/026/034 |

## 3. Trace coverage

| Delivery slice | 구현 artifact | 검증 |
|---|---|---|
| FEAT-001/002 · DEV-001/002 · IMP-001/002 | `modules/identity`, `apps/api/src/identity-api.ts` | TEST-026/046 |
| FEAT-003 · DEV-003 · IMP-003 | `modules/authorization` | TEST-009/026/046/047 |
| FEAT-016 · DEV-016 · IMP-016 | `modules/administration`, `apps/api/src/admin-audit-api.ts` | TEST-005/034/047/048/053 |
| FEAT-017 · DEV-017 · IMP-017 | `modules/audit`, API-016 query adapter | TEST-006/034/049/053 |
| FEAT-023 · DEV-023 · IMP-023 | `modules/security`, `packages/security-contracts` | TEST-046–049/053 |

## 4. 최종 명령과 결과

| 명령 | 결과 |
|---|---|
| `pnpm.cmd verify` | PASS — lint, typecheck, build, tests 30/30 |
| `pnpm.cmd audit --audit-level high` | PASS — known vulnerability 0 |
| `gitleaks dir . --config .gitleaks.toml --no-banner --redact --exit-code 1` | PASS — actual secret 0, unexplained finding 0 |
| repository-local Markdown link 검사 | PASS — broken link 0 |
| frozen/environment/NAS scope 검사 | PASS — 변경 0 |
| obsolete workspace 및 SP-002 source token 검사 | PASS — 각각 0 |
| `git diff --check` | PASS |

Gitleaks의 두 allowlist entry는 frozen DR 문구 두 건에만 path와 exact match를 함께 적용한다. `.env`, token, password, IP, NAS setting 또는 connection string을 허용하지 않는다.

## 5. 범위와 한계

- 구현은 framework-neutral TypeScript contract와 in-memory test adapter에 한정한다.
- final database schema/migration, HTTP endpoint, provider, credential format, UI를 결정하지 않는다.
- authorization assignment source와 audit persistence는 production store가 아닌 bounded in-memory contract다.
- source/intake/background job과 SP-002 artifact는 생성하지 않았다.

## 6. Rollback

Sprint 0 기준점은 `b5542c4`이다. SP-001 rollback은 Sprint 1 completion commit 전체를 별도 revert하는 방식으로 수행하며, frozen 문서나 environment/NAS 설정 복구 작업은 필요하지 않다.
