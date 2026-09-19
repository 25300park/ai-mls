# REL-002 Phase 2D-0A Production Infrastructure Binding Amendment

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-317 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Operations Owner / Data Owner / Security Owner |
| 기준일 | 2026-09-19 |
| 기준 commit | `eacce8dfe19a99db6470140e4bef00e8b1bf35c1` |

## 1. 목적과 판정

이 문서는 REL-002 Production platform을 `Vercel + Railway + Supabase`로 결합하는 승인된 설계 amendment다. 기존 SQLite Production 실행 가정은 `RETIRED_FOR_PRODUCTION`이다. SQLite는 기존 canonical local/test context와 역사적 구현·검증 증거에서만 유지되며 migration fingerprint를 수정하지 않는다.

| 경계 | Canonical Production ownership | 현재 준비도 |
|---|---|---|
| Browser delivery | Vercel | `DESIGN_DEFINED`, deploy `0` |
| Backend/runtime | Railway | `DESIGN_DEFINED`, deploy `0` |
| Relational persistence | Supabase PostgreSQL | `ENGINE_SELECTED`, physical binding `UNBOUND` |
| Identity/Auth authority | 기존 Identity authority, `SessionAccessCoordinator`, `AuthorizationService`, `RoleAssignment`, `RegisteredServiceWorkload` | `UNCHANGED` |
| Supabase Auth | 채택하지 않음 | `NO` |

## 2. DEC-175~178 ratification

| Decision | 상태 | Proposed decision |
|---|---|---|
| DEC-175 | `APPROVED` | Production platform ownership을 Vercel delivery, Railway runtime, Supabase PostgreSQL persistence로 분리한다. |
| DEC-176 | `APPROVED` | Supabase PostgreSQL을 canonical Production relational database engine으로 지정한다. SQLite Production migration 실행은 금지한다. |
| DEC-177 | `APPROVED` | Railway가 `startProductionRuntime()`와 backend/listener 및 장기 실행 worker의 Production host다. |
| DEC-178 | `APPROVED` | Vercel은 frontend/Admin Console/browser delivery만 소유하며 backend authority, worker, DB access를 소유하지 않는다. |

네 decision은 2026-09-19 AO closeout으로 승인되었다. 이는 Production deployment, schema execution, provider configuration 또는 credential binding 승인이 아니며 해당 실행은 `0`이다.

## 3. Supabase PostgreSQL binding

Supabase가 제공하는 full PostgreSQL database를 Production persistence target으로 사용한다. Supabase Auth, Storage, Edge Functions 또는 service-role authority는 이 amendment 범위가 아니다.

| Binding field | 값 |
|---|---|
| Provider | `Supabase` |
| Engine | `PostgreSQL` |
| Environment | `PRODUCTION` |
| Project reference | `OPEN DECISION` |
| Logical database name | `OPEN DECISION` |
| Region | `OPEN DECISION` |
| Runtime connection mode | `OPEN DECISION` — direct 또는 session pooler를 별도 검증해야 함 |
| Migration connection mode | direct database connection 필요, exact binding은 `OPEN DECISION` |
| Schema/version | PostgreSQL artifact 작성 전 `NOT_DEFINED` |
| Binding evidence reference | `NOT_AVAILABLE` |

Provider/engine/environment만 정해졌으므로 `PHYSICAL_DB_BINDING = UNBOUND`다. Project, database, region, connection mode가 하나의 승인된 evidence packet으로 결합되기 전 migration gate를 열지 않는다.

Supabase 공식 연결 문서는 persistent backend에 direct connection을 권장하고 IPv4 제약 시 session pooler를 제시하며, migration/backup/restore에는 direct connection을 요구한다. 이 자료는 가능한 연결 방식을 설명할 뿐 실제 project 선택 또는 readiness 증거가 아니다.

## 4. Railway runtime binding

Railway는 다음 Production runtime을 호스팅한다.

- canonical backend/API process와 유일한 Production entry인 `startProductionRuntime()`
- 지속 실행이 필요한 worker/job process
- Production 환경에 한정된 runtime configuration 및 provider-neutral secret-reference resolution
- application-owned liveness/readiness surface

### 4.1 Service boundary

| Service | Ownership | 제약 |
|---|---|---|
| `runtime-api` | `startProductionRuntime()`, canonical child roots, HTTP listener | bootstrap gate PASS 전 listener/database mutation `0` |
| `runtime-worker` | 향후 승인된 장기 실행 worker | exact worker composition은 `OPEN DECISION`; API process를 복제하거나 새 scheduler semantics를 만들지 않음 |

Staging과 Production Railway environments는 변수, deployment, database binding 및 secret reference를 분리한다. Railway healthcheck는 deploy-time gate로 사용할 수 있지만 지속 모니터링 또는 business readiness authority로 간주하지 않는다. Application readiness는 bootstrap, schema compatibility 및 required dependency 상태를 직접 반영해야 한다.

### 4.2 Runtime variable classes

| 값 | 분류 | 소비자 |
|---|---|---|
| `AI_MLS_RUNTIME_ENVIRONMENT=PRODUCTION` | `NON_SECRET_CONFIG` | Production bootstrap |
| `AI_MLS_CONFIGURATION_REFERENCE` | `NON_SECRET_CONFIG` | Production bootstrap |
| `IDENTITY_DATABASE_CONNECTION_REF` | `SECRET_REFERENCE` | approved Railway secret resolver → PostgreSQL adapter |
| resolved database URL/password | `SECRET_VALUE` | PostgreSQL adapter only; logs/docs/Console/Vercel 전달 금지 |

변수 이름은 설계 식별자이며 실제 Railway project/environment binding은 아직 없다.

## 5. Vercel frontend/Admin binding

Vercel은 browser-facing frontend와 Admin Console web delivery만 소유한다.

- canonical backend API, workers, persistence, identity authority, policy authority는 Vercel에 두지 않는다.
- Vercel Functions/serverless API는 이 amendment의 canonical backend 경로에 포함하지 않는다.
- frontend에는 public API origin 및 공개 build metadata만 전달할 수 있다.
- Supabase database URL/password, service-role credential, Railway runtime secret 또는 internal secret reference는 frontend에 전달하지 않는다.

현재 `apps/admin-console`은 Node HTTP server와 runtime composition을 포함하므로 즉시 Vercel-ready artifact가 아니다. Frontend delivery adapter/분리는 후속 승인 작업이며, 이 설계는 route/API/authority를 새로 만들지 않는다.

## 6. Authority preservation

| 질문 | 판정 |
|---|---|
| Identity authority changed | `NO` |
| Supabase Auth adopted | `NO` |
| New API/role/capability | `0` |
| Authorization moved to infrastructure provider | `NO` |
| Caller-supplied identity authoritative | `NO` |

Supabase PostgreSQL은 identity evidence를 저장할 뿐 identity proof, Session ingress, live authorization 또는 RBAC ownership을 취득하지 않는다.

## 7. Child-root transition boundary

현재 다섯 Production child root는 SQLite `databasePath`와 `REQUIRE_EXISTING` schema mode를 사용한다. DEC-176은 이들을 자동으로 PostgreSQL-ready로 만들지 않는다. Identity/Session/RegisteredServiceWorkload가 첫 bounded transition lane이며, API-014/015/018/019/FEAT-022의 나머지 store는 별도 inventory, adapter, migration 및 verification 없이는 `NOT_READY`다.

## 8. Execution hold

- Migration execution: `0`
- Production DB writes: `0`
- Production deployment: `0`
- Infrastructure mutation: `0`
- Credential use/exposure: `0`
- Provider/network calls: `0`
- Identity seed: `0`

관련 상세 분류는 [Phase 2B PostgreSQL Impact Matrix](REL002_PHASE2D0A_PHASE2B_POSTGRESQL_IMPACT_MATRIX.md), secret/backup 경계는 [Platform Secret and Backup Boundary](REL002_PHASE2D0A_PLATFORM_SECRET_BACKUP_BOUNDARY.md)를 따른다.

## 9. Final recommendation

`APPROVE_REL002_PRODUCTION_INFRASTRUCTURE_BINDING_AMENDMENT`

DEC-175~178 ratification은 완료되었다. 이 recommendation은 migration, deployment, infrastructure mutation 또는 credential 사용 승인이 아니다.

## 10. Official platform references

- [Supabase Database Overview](https://supabase.com/docs/guides/database/overview)
- [Supabase Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits)
- [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Railway Environments](https://docs.railway.com/environments)
- [Railway Variables](https://docs.railway.com/variables/reference)
- [Railway Healthchecks](https://docs.railway.com/deployments/healthchecks)
- [Vercel Runtimes](https://vercel.com/docs/functions/runtimes)
- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
