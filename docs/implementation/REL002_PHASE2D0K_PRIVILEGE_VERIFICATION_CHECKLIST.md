# REL-002 Phase 2D-0K Privilege Verification Checklist

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-356 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security / Operations Owner |

## Pre-migration gate

`000` role creation과 `003` migration-role grants 뒤, `001` migration 전에 `003a_pre_migration_role_privilege_verification.sql`을 실행한다. 이 artifact는 schema/table을 참조하지 않으며 모든 `matches_expected`가 true여야 한다.

- [ ] 두 role이 존재하며 `LOGIN`이고 six prohibited attributes가 모두 false이다.
- [ ] runtime role의 direct database privilege는 아직 없으며 direct CONNECT/CREATE/TEMPORARY가 없다.
- [ ] migration role의 direct database privilege는 controlled migration을 위한 `postgres.CONNECT/CREATE`만이며 direct TEMPORARY가 없다.
- [ ] PostgreSQL `PUBLIC`에서 상속된 effective TEMPORARY는 관찰값으로 기록하되 direct privilege ownership으로 판정하지 않는다.
- [ ] 두 target role 모두 다른 role의 member가 아니다. Role creator가 target role의 admin member인 반대 방향 membership은 privilege inheritance로 판정하지 않는다.

이 단계에서 `app_identity` schema/table 검증은 `DEFERRED_UNTIL_POST_MIGRATION`이다. `004`를 실행하여 missing-schema error를 privilege failure로 해석하지 않는다.

## Post-migration gate

`001` migration/schema verification과 `002` runtime grants가 모두 PASS한 뒤에만 `004_production_role_privilege_verification.sql`을 실행한다. 모든 `matches_expected`가 true여야 한다.

- [ ] runtime role의 direct database privilege는 `postgres.CONNECT`만이며 direct CREATE/TEMPORARY가 없다.
- [ ] migration role의 direct database privilege는 `postgres.CONNECT/CREATE`만이며 direct TEMPORARY가 없다.
- [ ] runtime role은 `app_identity.USAGE`만 가지며 schema CREATE가 없다.
- [ ] runtime table privileges가 002 artifact의 exact allowlist와 일치한다.
- [ ] 두 role 모두 grant option이 없다.
- [ ] 두 target role 모두 다른 role의 member가 아니다. Role creator가 target role의 admin member인 반대 방향 membership은 privilege inheritance로 판정하지 않는다.
- [ ] runtime role은 `app_identity` object를 소유하지 않는다.
- [ ] migration role의 migration-time object ownership은 named operator가 기록하며 해당 인증 재료는 steady-state runtime에서 제거한다.
- [ ] migration 인증 재료가 Railway/Vercel/browser/steady-state runtime에 존재하지 않는다.
- [ ] verification output에는 인증 재료 또는 연결 비밀값이 없다.

하나라도 false/missing이면 runtime binding과 migration execution을 중단하고 evidence를 `BLOCKED`로 기록한다.
