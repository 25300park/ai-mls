# REL-002 Phase 2D-0E Health / Readiness Contract

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-333 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Operations / Security Owner |
| 기준 Main | `bbc6fd92f700f3ec3b12db9f8972c2aa78175536` |

## 1. Endpoint proposal

| Path | Meaning | Success | Failure |
|---|---|---|---|
| `/livez` | process/listener liveness only | HTTP 200 after listener bind | connection failure or HTTP 503 during terminal shutdown |
| `/readyz` | Production bootstrap readiness | HTTP 200 only after `startProductionRuntime()` returns READY | listener가 존재하는 STARTING/후속 startup failure/shutdown에는 HTTP 503; pre-gate failure에는 connection unavailable |

Railway Healthcheck Path는 `/readyz`로 승인되었다. Railway healthcheck가 deployment-time gate이며 지속 monitoring 대체물이 아니라는 platform boundary를 보존한다.

## 2. Response allowlist

두 endpoint는 `Content-Type: application/json`과 아래 bounded fields만 반환한다.

```json
{"status":"LIVE"}
```

```json
{"status":"READY"}
```

실패 시 `status = NOT_READY`만 허용한다. database host/user/schema/version, secret/reference, service registration, tenant/principal, provider status, SQL, exception, stack/path는 금지한다.

## 3. Truth and ordering

- liveness는 database/provider readiness나 business authorization을 의미하지 않는다.
- pre-gate에는 listener가 존재하지 않으므로 readiness probe는 connection unavailable이다. 503 응답을 허위로 약속하지 않는다.
- 기존 bootstrap이 gate PASS 뒤 호출하는 `dependencies.startListeners`가 application route와 operational route를 한 listener에 합성한다. 별도 pre-bootstrap listener 또는 두 번째 listener는 만들지 않는다.
- listener bind 직후부터 `startProductionRuntime()` 전체 성공 전까지 `/readyz`는 503이며, full return 뒤에만 200으로 전환한다.
- readiness는 config, identity authority availability, required secret resolution, schema compatibility 및 전체 `startProductionRuntime()` PASS 후에만 참이다.
- shutdown signal 수신 즉시 readiness는 `NOT_READY`로 전환한다.
- 일반 business authorization denial은 global readiness를 오염시키지 않는다.
- failed startup을 후속 단순 read 성공으로 가리지 않는다.
- provider execution은 별도 authorization이 없으므로 healthcheck가 이를 READY로 주장하지 않는다.

## 4. Access and abuse boundary

Operational endpoints는 authentication 없이 Railway probe가 접근할 수 있으므로 body는 고정 상수이고 query/body를 받지 않는다. GET/HEAD 이외 method는 405, body/oversized header는 기존 bounded HTTP safety policy로 거부한다. rate/edge protection은 deployment configuration에서 처리하며 endpoint 자체가 DB query나 external call을 발생시키지 않는다.

## 5. Public-route gate

현재 route는 존재하지 않는다. `DEC-184 = APPROVED`이며 `/readyz`는 infrastructure readiness endpoint이지 business/public domain API가 아니다. 별도 implementation authorization 전에는 구현하지 않으며, 구현 시 new business API ID, role/capability, state vocabulary는 `0`이어야 한다.

## 6. Platform values

| Setting | Proposed value |
|---|---|
| Railway healthcheck path | `/readyz` (APPROVED / NOT_IMPLEMENTED) |
| Railway healthcheck timeout | 300 seconds |
| Railway draining seconds | 30 seconds |

## 7. Related documents

- [Production Executable Design](REL002_PHASE2D0E_PRODUCTION_EXECUTABLE_DESIGN.md)
- [Pool / Timeout / TLS Contract](REL002_PHASE2D0E_POOL_TIMEOUT_TLS_CONTRACT.md)
- [Implementation Plan](REL002_PHASE2D0E_IMPLEMENTATION_PLAN.md)

Official platform basis: [Railway Healthchecks](https://docs.railway.com/deployments/healthchecks), [Railway Variables Reference](https://docs.railway.com/variables/reference).
