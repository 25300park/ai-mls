# REL-002 Phase 2D-0E Implementation Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-337 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture / Development Owner |
| 기준 Main | `bbc6fd92f700f3ec3b12db9f8972c2aa78175536` |

## 1. Gate

`DEC-183~187`은 AO ratification으로 `APPROVED`다. 본 계획은 별도 implementation authorization으로만 실행한다. 현재 executable, health route, role SQL, Railway variables 및 Production infrastructure change는 `0`이다.

## 2. Task sequence

## 2.1 Required implementation split

| Requirement | Classification | Evidence / next boundary |
|---|---|---|
| Production executable | `IMPLEMENT_IN_NEXT_STEP` | `startProductionRuntime()` exists; `production-main.ts` and start script do not |
| health/readiness endpoint | `IMPLEMENT_IN_NEXT_STEP` | no truthful network route; `DEC-184` approved, implementation authorization still required |
| Railway variable adapter | `IMPLEMENT_IN_NEXT_STEP` | exact non-secret/reference names designed; parser/composition absent |
| secret resolver binding | `DEFER` | Railway variables expose values to build; runtime-only physical backend remains `OTHER_REQUIRED / BLOCKED` |
| runtime DB role SQL | `IMPLEMENT_IN_NEXT_STEP` | exact grants designed; SQL artifact and execution separate |
| migration operator role SQL | `IMPLEMENT_IN_NEXT_STEP` | bounded DDL identity designed; SQL artifact and execution separate |
| pool configuration | `IMPLEMENT_IN_NEXT_STEP` | most options exist; idle timeout and exact parser mapping absent |
| TLS configuration | `IMPLEMENT_IN_NEXT_STEP` | `rejectUnauthorized`/CA option exists; exact runtime reference/host assertion mapping absent |

Railway Root/Build/Start/healthcheck/draining configuration, outbound IPv6 or Supabase IPv4 add-on proof, role execution, runtime-only secret backend configuration와 sealed/reference variables are `HUMAN_PLATFORM_CONFIGURATION`. Existing `startProductionRuntime()`, PostgreSQL pool adapter core, schema validator and TLS verification primitive are `ALREADY_IMPLEMENTED` supporting capabilities, not completed requirements in the table above.

### Task 1 — executable RED

- executable absent;
- `startProductionRuntime()` 호출 누락/중복;
- bootstrap PASS 전 listener/UoW/child root 시작;
- SQLite fallback;
- safe shutdown ordering 위반.

최소 구현: `apps/api/src/production-main.ts`, bounded environment adapter와 root start script를 추가한다.

### Task 2 — health/readiness RED

- `/readyz` absent;
- pre-gate connection unavailable contract 또는 post-listener STARTING/failure/shutdown 503 contract 위반;
- `/livez`가 dependency readiness를 주장;
- response detail leakage;
- business authorization/readiness collapse.

최소 구현: existing `dependencies.startListeners` composition 안에 fixed-body GET/HEAD operational probes와 bootstrap-state projection만 추가한다. 두 번째 listener를 만들지 않는다. 별도 implementation authorization이 없으면 Task 2에서 STOP한다.

### Task 3 — Railway secret resolver RED

- direct `DATABASE_URL` bypass;
- unknown reference scheme/key accepted;
- Staging fallback;
- secret log/error leakage;
- child-root secret visibility.

최소 구현: exact env parser는 reference만 수용한다. 실제 resolver adapter는 runtime-only backend가 별도 AO 결정으로 선택된 후에만 구현한다. Railway variable을 secret value backend로 사용하지 않는다.

### Task 4 — role artifacts and verification

Runtime/migration role SQL과 negative privilege verification artifact를 작성하되 실행하지 않는다. Role execution은 named operator와 separate database-owner approval 전까지 `0`이다.

### Task 5 — pool/TLS RED

- pool idle timeout unbounded/defaulted;
- max/timeout hidden default;
- TLS hostname/CA verification bypass;
- connection secret/config mismatch;
- unsafe PostgreSQL diagnostics.

최소 구현: existing `PgConnectionPoolOptions`에 bounded idle timeout을 추가하고 exact values/TLS assertions를 parser-to-adapter path에 연결한다.

### Task 6 — verification

Focused executable/health/config/secret/pool/TLS tests → affected Identity/Session/Production bootstrap tests → full regression once → lint → typecheck → clean build → architecture checksum → `git diff --check` → gitleaks → independent review 순서로 실행한다.

## 3. Human/platform actions (separate authorization)

1. Railway service Root/Build/Start/healthcheck/draining 설정;
2. Railway outbound IPv6 활성화 또는 Supabase IPv4 add-on 중 하나의 exact reachability evidence;
3. Production environment non-secret/reference variables 구성 및 runtime-only secret backend 선택/구성;
4. Supabase role creation/grants;
5. project CA and exact connection credential reference binding;
6. named operator, backup/restore evidence and controlled migration;
7. post-migration compatibility/readiness proof;
8. deployment and smoke verification.

각 action은 코드 구현과 분리하며 credential values를 evidence에 기록하지 않는다.

## 4. Stop conditions

New API ID, business authority, role/capability, auth authority, ORM/dependency, SQLite Production fallback, automatic migration, identity seed, provider activation, undocumented network destination 또는 secret exposure가 필요하면 STOP한다.

## 5. Completion criteria

Executable/health/secret resolver/pool contracts가 test-covered이고 역할 artifact가 approved되어도 실제 role/config/deploy/migration evidence 없이는 Gaps 004/005/006을 닫지 않는다.

## 6. Related documents

- [Production Executable Design](REL002_PHASE2D0E_PRODUCTION_EXECUTABLE_DESIGN.md)
- [Health / Readiness Contract](REL002_PHASE2D0E_HEALTH_READINESS_CONTRACT.md)
- [PostgreSQL Role Separation](REL002_PHASE2D0E_POSTGRESQL_ROLE_SEPARATION.md)
- [Railway Secret Variable Contract](REL002_PHASE2D0E_RAILWAY_SECRET_VARIABLE_CONTRACT.md)
- [Pool / Timeout / TLS Contract](REL002_PHASE2D0E_POOL_TIMEOUT_TLS_CONTRACT.md)
- [Completion Report](../reviews/REL002_PHASE2D0E_COMPLETION_REPORT.md)
