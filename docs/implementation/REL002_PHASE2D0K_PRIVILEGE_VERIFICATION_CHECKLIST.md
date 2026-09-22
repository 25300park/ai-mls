# REL-002 Phase 2D-0K Privilege Verification Checklist

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-356 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security / Operations Owner |

`004_production_role_privilege_verification.sql` 결과의 모든 `matches_expected`가 true여야 한다.

- [ ] 두 role이 존재하며 `LOGIN`이고 six prohibited attributes가 모두 false이다.
- [ ] runtime role은 `postgres.CONNECT`만 가지며 database CREATE/TEMPORARY가 없다.
- [ ] migration role은 controlled migration을 위한 `postgres.CONNECT/CREATE`만 가진다.
- [ ] runtime role은 `app_identity.USAGE`만 가지며 schema CREATE가 없다.
- [ ] runtime table privileges가 002 artifact의 exact allowlist와 일치한다.
- [ ] 두 role 모두 grant option이 없다.
- [ ] 두 role 모두 role membership이 없다.
- [ ] runtime role은 `app_identity` object를 소유하지 않는다.
- [ ] migration role의 migration-time object ownership은 named operator가 기록하며 해당 인증 재료는 steady-state runtime에서 제거한다.
- [ ] migration 인증 재료가 Railway/Vercel/browser/steady-state runtime에 존재하지 않는다.
- [ ] verification output에는 인증 재료 또는 연결 비밀값이 없다.

하나라도 false/missing이면 runtime binding과 migration execution을 중단하고 evidence를 `BLOCKED`로 기록한다.
