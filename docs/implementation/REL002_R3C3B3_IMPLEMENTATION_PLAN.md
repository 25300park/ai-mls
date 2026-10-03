# REL-002 R3-C3B3 Implementation Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-396 |
| Version | v0.1 |
| Status | DRAFT |
| Owner | Architecture Owner |

현재 AO TRUSTED TENANT / ACTIVE TEAM BINDING CONTRACT를 구현한다. 이전 [blocker inventory](../reviews/REL002_R3C3B3_COMPLETION.md)의 발견은 historical 조사 결과로 보존한다.

1. TDD로 기존 DurableSessionRecord에 optional tenantId/teamBindingOrigin을 추가한다. 새 Production binding은 전체 exact tuple과 두 canonical origin을 요구한다. Historical Session은 계속 decode되지만 Production binding에는 fail closed하며 추론/backfill하지 않는다.
2. 신규 forward-only 016 migration/checksum/verifier/readiness로 Session binding persistence를 확장한다. 승인된 이전 migration과 fingerprint는 변경하지 않는다.
3. 동일 Session transaction client에서 principal/credential 재검증 이후 명시적 requestedTeamId를 기존 Administration TEAM_SCOPE/RoleAssignment/evidence semantics로 검증한다. Credential evidence에는 tenant/team을 추가하지 않는다.
4. 기존 async Session UoW와 pool을 재사용하여 binding tuple을 원자적으로 발급한다. 새 pool/UoW/authority/credential write는 없다.
5. Exact Session에서 시작하는 async Production trusted-binding resolver는 principal/tenant/team/live roles, revocation/freshness를 검증하고 기존 AuthorizationService context를 구성한다. B1 explicit Production freshness를 사용한다. Readiness는 catalog/composition만 확인한다.
6. Focused→disposable PostgreSQL→affected→full regression/build/lint/typecheck/diff/secret scan/independent review. 새 grant가 필요하면 STOP. Commit/push/Production 접근 및 C3 Final/Secrets/listener/workers/R3-D는 금지한다.

Migration의 범위는 Session binding field에 한정한다. Administration read validation은 기존 owner adapter를 사용하며 RoleAssignment.teamIds는 explicit selection을 검증할 뿐 선택하지 않는다. Session, Identity principal, Administration authority 순서와 concurrent update 보호를 검증한다.

검증 완료: Focused 6, B3 disposable 12, B2B/B1 compatibility 10/1, affected 65 PASS. Full regression 1813 PASS / 1 authorized immutable historical mismatch / 19 SKIP. 상세 결과와 한계는 위 completion report의 후속 AO 구현 section에 기록했다. Production startup 활성화 또는 commit은 수행하지 않았다.
