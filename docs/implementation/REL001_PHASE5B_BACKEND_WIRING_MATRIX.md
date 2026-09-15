# REL-001 Phase 5B Backend Wiring Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-231 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Platform Owner |
| 기준일 | 2026-09-16 |

## 1. Composition boundary

`createStagingAdminConsoleBootstrap()`가 유일한 Staging Platform Host 조립 root이며, `startStagingAdminConsoleBootstrap()`가 이를 실제 loopback server로 시작하는 bounded executable entry이다. Console은 아래 port를 주입받고 store, UoW, credential 또는 provider를 직접 구성하지 않는다.

| 관심사 | 주입 경계 | 권한/구성 소유자 | Fail-closed 조건 |
|---|---|---|---|
| Session | Phase 1D `sessionAccess.resolveAuthorized()` | Identity/Auth | missing, revoked, expired, tenant/scope denial, MFA denial |
| Administration | existing `AdministrationConsoleHttpClient` + `AdministrationConsoleReadAdapter` | API-015 | unavailable HTTP boundary, unsafe/malformed DTO |
| Publication/recovery | `ConsoleReadPort` | API-014/F19 | missing port, unsafe/malformed DTO |
| Audit | `ConsoleReadPort` | API-016 | missing port, unsafe/malformed evidence |
| Jobs | `ConsoleJobRuntimeStatusReadPort` | API-017 | missing port, unknown status, unsafe failure value |
| Advisory | `ConsoleAdvisoryRuntimeStatusReadPort` | FEAT-022 | any truth other than provider-independent `READY`, live `NOT_READY`, external hold, `DEC-162=IN_REVIEW` |

## 2. Request flow

1. Browser는 기존 route만 요청하고 Session identifier를 직접 읽거나 저장하지 않는다. trusted Staging ingress가 기존 `x-session-id` carrier를 주입하며, carrier가 없는 직접 요청은 `401`이다.
2. Console server는 configured tenant/scope와 canonical purpose/action으로 Phase 1D ingress를 호출한다.
3. 승인된 trusted Session carrier만 owning adapter에 전달한다.
4. API-015 controlled command는 body schema 검증 후 `security.admin`/MFA 경계를 통과하고 기존 HTTP command path로 간다.
5. owning adapter 결과는 safe immutable Console DTO boundary를 통과한 뒤 렌더링한다.

## 3. Configuration

| 값 | Staging 규칙 |
|---|---|
| runtime | explicit `STAGING` |
| Console host | loopback `127.0.0.1` |
| API-015 origin | explicit loopback HTTP origin |
| tenant/scope | explicit configuration; caller override 금지 |
| selector scopes | roles/team/policy/source/target의 tenant, type, ID가 configured scope와 정확히 일치 |
| Development Session | 금지 |
| missing Platform Host dependencies | `STAGING_CONSOLE_NOT_READY` |

Standalone Admin Console CLI는 authoritative backend를 임의로 조립하지 않고 `STAGING_PLATFORM_HOST_COMPOSITION_REQUIRED`로 중단한다. Platform Host의 `startStagingAdminConsoleBootstrap()`만 실제 Staging server를 시작하며, focused integration test가 ephemeral loopback port에서 start/request/stop을 검증한다.

## 4. Ownership preservation

- API-015 authorizes and executes Administration reads/writes.
- API-016 owns final Audit truth; Console is read-only.
- API-017 owns Job lifecycle/status; Console mutation, retry, scheduler는 0이다.
- FEAT-022 live provider activation remains blocked; Console status가 execution authority가 아니다.
- Session, Audit, Job, advisory persistence path를 Console에 추가하지 않았다.

## 5. Verification mapping

`staging-console-composition.test.ts`와 `staging-console-session-ingress.test.ts`가 six-screen routing, mandatory-port failure, tenant/scope binding, revocation/expiry/MFA, unsafe data rejection, API-017/FEAT-022 truth separation 및 Platform Host factory 조립을 직접 검증한다.
