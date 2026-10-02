# REL-002 R3-C2C — Startup Authorization Team Context

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-393 |
| Version | v0.1 |
| Status | DRAFT |
| Owner | Architecture Owner |

## 승인 범위

AO의 R3-C2C 승인에 따라 Identity-owned `WorkloadStartupBindingRecord.authorizationTeamId`를 명시적 불변 context로 추가한다. 기존 R3-C2 resolver 작업은 보존하고 활성화하지 않는다. [완료 검증](../reviews/REL002_R3C2C_COMPLETION.md), [기존 evidence 계약](REL002_R3C2B_IMPLEMENTATION_PLAN.md)을 따른다.

## Authority와 선택

TEAM governance owner는 Administration의 `TEAM_SCOPE`이다. `RoleAssignment.teamIds`는 exact principal의 현재 유효 assignment에 대한 membership 검사에만 사용한다. 배열 순서·Organization·Project·다른 scope·latest/default로 team을 선택하지 않는다. 기존 TEAM_SCOPE의 tenant 및 organization linkage를 검증한다. 별도 Project→Team authority는 추가하지 않는다.

`scope.use` action/capability는 기존 SVC capability registry에만 추가한다. 기존 live AuthorizationService가 principal/tenant/team/resource/purpose/time을 재평가한다. resource.type은 `Administration`, typed id는 TEAM_SCOPE/POLICY/SOURCE_REGISTRY/PUBLICATION_TARGET, version은 exact governance version이다. AuthorizationService signature는 변경하지 않는다.

## Forward-only persistence와 evidence

기존 migration 012/013 및 Audit 001은 수정하지 않는다. Identity 014는 nullable `authorization_team_id`를 추가하여 historical row를 보존하되 새 INSERT와 ACTIVE 전환은 explicit team을 요구한다. team은 같은 row에서 수정할 수 없다. historical missing team은 startup-ineligible이며 replacement의 새 version에서 명시적으로 설정한다. inferred backfill은 없다.

ASSUMPTION: 기존 immutable schemaVersion 1 activation을 보존하기 위해 새 activation은 `payloadSchemaVersion=2`로 version한다. v2 payload의 `authorizationTeamId`는 binding과 exact equality이다. registration/revocation은 v1을 유지한다. Audit 002는 새 activation INSERT에 v2를 요구한다. historical v1 exact replay는 SELECT 후 NO-OP로 처리하며 historical event를 다시 INSERT/UPDATE하지 않는다.

TEAM_SCOPE/assignment read는 기존 reference validation과 같이 Identity-owned transaction의 client lease 전에 실행하여 single physical pool max=1에서 nested acquisition을 방지한다. 기존 sorted locks, CAS, atomic two-ref replacement와 ambiguous COMMIT quarantine을 유지한다. Runtime team read 결과가 write authorization 자체를 부여하지 않는다.

## 검증 순서

Focused RED/GREEN → migration rollback/replay/historical preservation → disposable atomic replacement/readiness/ACL → C1 compatibility → affected → full regression → build/lint/typecheck/diff/secret → 독립 검토.

## 제한

Production readiness는 NOT_VERIFIED, deployability는 BLOCKED이다. Production/Railway/Supabase mutation은 0/0/0이다. listener/workers 및 R3-D는 NOT_STARTED이다. R3-C2는 이 prerequisite의 검증 후 별도 승인 범위에서만 재개한다. Commit NOT_CREATED; Push NOT_PERFORMED.
