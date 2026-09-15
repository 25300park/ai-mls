# REL-001 Phase 5A Session/Auth Bootstrap Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-224 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security Owner / Architecture Owner |

## 1. 결론

`CONSOLE_SESSION_BOOTSTRAP_READY = NO`

Phase 1D Session implementation은 필요한 durable semantics를 갖췄지만 Admin Console Staging ingress와 아직 조립되지 않았다. 이는 새 auth protocol 필요를 의미하지 않는다.

## 2. Boundary matrix

| Invariant | Existing evidence | Boundary readiness | Console wiring | Required bounded action |
|---|---|---|---|---|
| carrier | API adapters 및 Console API-015 client의 `x-session-id` | READY | PARTIAL | Console incoming request의 trusted ingress Session ID를 server-side context로 전달 |
| durable lookup | `DurableSessionUnitOfWork` | READY | NOT_WIRED | Staging Platform Host Session composition 주입 |
| idle expiry | `SessionAccessCoordinator`; exact 30-minute boundary | READY | NOT_WIRED | 모든 protected read/write 직전 coordinator 사용 |
| absolute expiry | Phase 1D exact 12-hour lifetime | READY | NOT_WIRED | resolver result에 대해 current clock 재검증 |
| MFA freshness | existing privileged action rule, 15 minutes | READY | NOT_WIRED | UI-036 command에서 backend enforcement 유지 |
| revocation | durable append/CAS revocation | READY | NOT_WIRED | revoked Session은 resolve/refresh 모두 fail closed |
| tenant/scope binding | trusted binding resolver + durable record | READY | NOT_WIRED | caller tenant/team override 금지; trusted binding으로 request scope 생성 |
| live RBAC | `AuthorizationService` and live assignment adapter | READY | NOT_WIRED | every access live evaluate; UI role는 authority 아님 |
| CAS/access refresh | `sessionVersion` conditional update | READY | NOT_WIRED | successful authorized access만 refresh |
| safe failure | `STAGING_SESSION_NOT_READY` and generic public errors | READY | PARTIAL | internal diagnostics를 Console 응답에 전달하지 않음 |
| Development isolation | Staging composition rejects non-STAGING/in-memory | READY | CURRENT VIOLATION FOR STAGING | `composeDevelopmentAdminConsole()` 사용 금지 |

## 3. Trusted flow

`approved Staging ingress -> x-session-id -> Platform Host durable Session lookup -> idle/absolute/revocation check -> trusted tenant/scope binding -> live AuthorizationService -> MFA/SoD where required -> bounded owning port`.

Unauthorized, expired, revoked, mismatched 또는 failed request는 `lastAccessedAt`을 갱신하지 않는다. Browser가 보내는 actor/tenant/scope/role/capability/timestamp는 authority가 아니다.

## 4. Stop conditions

새 login flow, token format, Session lifecycle, role/capability 또는 external identity service가 필요해지면 implementation을 중단하고 AO 결정을 요청한다. 현재 inventory에서는 그런 요구가 발견되지 않았다.
