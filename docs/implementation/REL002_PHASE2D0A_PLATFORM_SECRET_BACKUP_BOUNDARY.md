# REL-002 Phase 2D-0A Platform Secret and Backup Boundary

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-319 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security Owner / Operations Owner / Data Owner |
| 기준일 | 2026-09-18 |

## 1. Secret ownership

| Platform | 허용 | 금지 |
|---|---|---|
| Railway | Production runtime의 provider-neutral secret reference를 environment-scoped resolver로 해석 | plaintext를 docs/log/health/readiness/Console에 노출; Staging fallback |
| Supabase | PostgreSQL endpoint/credential의 origin, database service | application authorization, Session/RBAC authority, Supabase Auth 자동 채택 |
| Vercel | public API origin, public build/version metadata | database URL/password, service-role key, Railway secret, internal secret reference |

Canonical reference name은 `IDENTITY_DATABASE_CONNECTION_REF`다. 이것은 secret value가 아니라 approved secret backend의 opaque reference다. 실제 provider key/name/value, Railway variable binding 및 rotation procedure는 `OPEN DECISION`이다.

Secret resolution 순서는 기존 Production bootstrap invariant를 유지한다.

`raw config → typed config → reference validation → identity availability → secret resolution → ProductionStartupValidationGate → pool/UoW → child roots/listeners/workers`

Gate PASS 전 database mutation, Session UoW, listener, worker 및 provider execution은 `0`이다. Exact authority availability 확인에 필요한 pre-gate access가 있다면 read-only로 한정하고 별도 PostgreSQL contract가 필요하다.

## 2. Supabase backup/restore evidence

Supabase의 관리형 backup 기능 존재만으로 readiness를 주장하지 않는다. Official documentation상 backup frequency/PITR availability는 plan과 configuration에 의존한다. 따라서 다음 exact-project evidence가 모두 필요하다.

| Evidence | 현재 상태 |
|---|---|
| exact Production Supabase project binding | `BLOCKED` |
| applicable plan and backup schedule | `BLOCKED` |
| exact backup ID/timestamp/status | `BLOCKED` |
| integrity/retention evidence | `BLOCKED` |
| PITR window, if required | `BLOCKED` |
| compatible isolated restore rehearsal | `BLOCKED` |
| RPO/RTO acceptance and operator evidence | `BLOCKED` |
| restore result tied to exact schema/application verification | `BLOCKED` |

Production restore를 실행하지 않는다. Restore rehearsal target, network isolation, credential access, sanitization 및 cleanup은 별도 authorization이 필요하다.

## 3. Revised Phase 2D-0 prerequisite state

| Gate | State | 이유 |
|---|---|---|
| Physical DB binding | `UNBOUND` | provider/engine/environment만 알려졌고 project/database/region/connection mode가 없음 |
| Named operator authorization | `BLOCKED` | exact PostgreSQL migration과 target이 아직 없음 |
| Exact-target backup evidence | `BLOCKED` | exact Supabase project/backup evidence 없음 |
| Restore verification | `BLOCKED` | exact/compatible restore rehearsal evidence 없음 |
| Migration execution gate | `BLOCKED` | 네 prerequisite가 모두 VERIFIED가 아님 |

## 4. Health/readiness boundary

- Railway healthcheck 성공은 deployment gate이지 continuous monitoring 또는 database business readiness가 아니다.
- Liveness는 process가 응답 가능한지, readiness는 bootstrap/schema/dependency가 serving 가능한지를 구분한다.
- Supabase service availability alone은 application schema compatibility 또는 restore readiness를 증명하지 않는다.
- Vercel frontend availability는 Railway backend/Supabase database readiness를 대체하지 않는다.
- `UNKNOWN` 또는 unbound state를 `READY`로 변환하지 않는다.

## 5. Operations hold

Migration execution, Production DB writes, backup/restore execution, deployment, credential creation/rotation, network activation 및 infrastructure mutation은 모두 `0`이다.
