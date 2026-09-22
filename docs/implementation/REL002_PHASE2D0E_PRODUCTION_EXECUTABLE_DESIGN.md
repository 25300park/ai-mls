# REL-002 Phase 2D-0E Production Executable Design

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-332 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture / Operations Owner |
| 기준 Main | `bbc6fd92f700f3ec3b12db9f8972c2aa78175536` |

## 1. 목적과 현재 증거

Railway의 canonical backend service `ai-mls-api`가 기존 `startProductionRuntime()`을 정확히 한 번 호출하도록 하는 최소 Production executable 계약을 정의한다. 현재 저장소에는 함수형 Production bootstrap은 있지만 이를 실행하는 `main` module과 Production start script가 없으므로 executable status는 `REQUIRED`다.

## 2. Build / start contract

| Item | Canonical contract | Current status |
|---|---|---|
| Root directory | repository root `.` | CLOSED |
| Builder | Railway Railpack | PROPOSED |
| Node / pnpm | `24.18.0` / `11.9.0` | CLOSED by `package.json` |
| Install/build | `pnpm install --frozen-lockfile && pnpm run build` | CLOSED |
| Future source entry | `apps/api/src/production-main.ts` | REQUIRED |
| Future compiled entry | `dist/apps/api/src/production-main.js` | REQUIRED |
| Railway Start Command | `node dist/apps/api/src/production-main.js` | APPROVED / NOT_IMPLEMENTED |

Railpack 자동 추론은 배포 증거가 아니며 Root/Build/Start는 Railway service 설정에 명시적으로 고정한다.

## 3. Executable responsibility

`production-main.ts`의 허용 책임은 다음 순서뿐이다.

1. process environment를 bounded parser에 전달한다.
2. provider-neutral secret reference resolver와 PostgreSQL pool factory dependency를 구성한다.
3. `dependencies.startListeners`를 기존 Production listener factory와 operational health state에 합성한다.
4. `startProductionRuntime(rawConfiguration, dependencies)`을 정확히 한 번 호출한다. 기존 bootstrap이 gate PASS 후 `dependencies.startListeners`를 호출하므로 executable이 별도 listener를 두 번째로 bind하지 않는다.
5. `SIGTERM`/`SIGINT`에서 readiness를 먼저 내리고 신규 요청을 중지한 뒤 `runtime.close()`를 호출한다.
6. 30초 안에 정상 종료하지 못하면 안전한 non-zero exit로 종료한다.

직접 child root 시작, Staging root 재사용, SQLite fallback, migration 실행, identity seed, provider enablement, credential logging은 금지한다.

## 4. Fail-closed states

Configuration/secret/identity/schema compatibility/gate 중 하나라도 실패하면 Session UoW, child roots, listener, worker와 provider-capable runtime은 시작하지 않는다. 이 경우 listener가 없으므로 network 관찰 결과는 HTTP 503이 아니라 connection unavailable이다. Listener가 생성된 뒤 worker start 등 후속 startup이 실패하면 operational state를 `NOT_READY`로 내리고 close한다. 시작 실패 진단은 canonical safe error code와 correlation reference만 노출하며 URI, password, CA body, SQL, stack/path를 노출하지 않는다.

## 5. Lifecycle ownership

Production executable은 process signal과 top-level exit만 소유하고, resource close 순서는 기존 `ProductionBootstrap`이 소유한다. Railway draining window 제안값은 30초이며 executable shutdown timeout과 일치시킨다. background retry/restart loop는 애플리케이션에 추가하지 않는다.

## 6. Decision gate

이 설계는 `DEC-183 = APPROVED`다. 별도 implementation authorization 전까지 executable, script, Railway configuration 변경은 `0`이다.

## 7. Related documents

- [Health / Readiness Contract](REL002_PHASE2D0E_HEALTH_READINESS_CONTRACT.md)
- [Railway Secret Variable Contract](REL002_PHASE2D0E_RAILWAY_SECRET_VARIABLE_CONTRACT.md)
- [Implementation Plan](REL002_PHASE2D0E_IMPLEMENTATION_PLAN.md)
- [Completion Report](../reviews/REL002_PHASE2D0E_COMPLETION_REPORT.md)

Official platform basis: [Railway Build and Start Commands](https://docs.railway.com/builds/build-and-start-commands), [Railway Config as Code Reference](https://docs.railway.com/config-as-code/reference).
