# REL-002 PostgreSQL PUBLIC TEMPORARY Privilege Compatibility Contract

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-358 |
| 문서 버전 | v1.0 |
| 상태 | APPROVED |
| 소유 역할 | Architecture / Security Owner |
| 기준 Main | `078b07cb1ac7288dbf98d1fe1aa1aa63e3fd8487` |
| Decision | DEC-192 (`APPROVED`) |

## 목적

Supabase managed PostgreSQL의 database `PUBLIC` 기본 ACL로 제공되는 effective `TEMPORARY`와 application role에 직접 부여된 privilege를 분리한다. 이 계약은 Production privilege를 변경하지 않고 read-only 검증 의미만 canonicalize한다.

## Canonical contract

`ai_mls_production_runtime`과 `ai_mls_production_migration_operator`에 공통으로 다음을 적용한다.

- direct `TEMPORARY` grant는 금지한다.
- `PUBLIC`에서 상속된 effective `TEMPORARY`는 `ACCEPTED_PLATFORM_BASELINE`이다.
- effective `TEMPORARY`는 application, runtime 또는 migration authority ownership으로 해석하지 않는다.
- runtime/migration code는 별도 승인 없이 temporary table 또는 `TEMPORARY` privilege에 의존하지 않는다.
- `PUBLIC` global privilege revoke는 이 bounded change 밖이다.

Migration operator의 direct database allowlist는 `CONNECT`, `CREATE`다. Runtime role의 direct database allowlist는 `CONNECT`다. 두 role의 direct database ACL에는 grant option이 없어야 한다.

## Verification semantics

`004_production_role_privilege_verification.sql`은 `pg_database.datacl`을 `aclexplode`하여 target role에 직접 부여된 ACL을 검사한다.

- `effective_temporary_observed`: `has_database_privilege` 기반 관찰값이며 PASS/FAIL 자체가 아니다.
- `direct_temporary_observed`: target role direct ACL의 `TEMPORARY` 존재 여부다. `true`이면 FAIL이다.
- direct CONNECT/CREATE allowlist, direct grant option 부재, prohibited role attribute 부재와 unexpected target-role membership 부재는 계속 필수다.

Role creator인 managed `postgres`가 migration role의 admin member인 방향은 migration role이 `postgres` authority를 상속한다는 뜻이 아니다. 반대 방향 또는 target role이 다른 authority role의 member인 상태는 별도 검증 대상으로 유지한다.

## Runtime review

Repository artifact `002_runtime_role_grants.sql`은 runtime role에 direct `TEMPORARY`를 부여하지 않는다. PostgreSQL `PUBLIC` database ACL이 유지되는 동일 database에서는 runtime role도 effective `TEMPORARY`를 관찰할 수 있으며 동일 compatibility rule을 적용한다.

## Scope boundary

- Production mutation: `0`
- Migration execution: `0`
- Runtime grants execution: `0`
- `001` migration semantics change: `0`
- `002` runtime grant semantics change: `0`
- fixed `003` grant semantics change: `0`

DEC-192는 Architecture Owner가 승인했다. 이 승인은 Production mutation, migration execution 또는 runtime grant execution을 승인하지 않는다.
