# REL-002 Phase 2D-0I Secret Backend Implementation / Configuration Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-351 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Development / Operations Owner |
| 기준 Main | `e973c6e66fb53b3cfb0908b777a8af0704f64812` |

## Goal

승인된 DEC-189/190/191에 따라 provider-neutral `SecretReferenceResolver`를 유지하면서 Railway sealed runtime values를 build에서 구조적으로 격리하고 Production PostgreSQL pool에만 전달한다. 이 문서는 설계 closeout이며 실제 구현과 platform configuration은 별도 승인이 필요하다.

## 1. Repository implementation requirements

1. Add a multi-stage Production Dockerfile using the existing frozen-lockfile install and build commands.
2. Add a static build guard that fails if either physical secret key is present during build; print key name/status only.
3. Add an internal resolver adapter with an exact immutable two-entry mapping and one consumer `PG_IDENTITY_POOL`.
4. Replace the current no-op Production secret validation with presence/shape/consumer validation before listener, worker or database resource creation.
5. Resolve values only immediately before `createProductionPostgreSqlPoolOptions()` and do not retain them in child-root configuration.
6. Add safe failure normalization and explicit value/key redaction regression tests.
7. Add artifact/layer checks for raw PostgreSQL credential, PEM body and physical key leakage.
8. Add Vercel/frontend configuration tests proving reference/value visibility `0`.

## 2. Required RED coverage

- secret physical value visible during Docker build;
- Dockerfile declares secret `ARG`/`ENV`;
- unknown reference or arbitrary env key resolves;
- wrong consumer resolves;
- missing/empty/oversized value passes startup;
- raw `DATABASE_URL` bypasses resolver;
- child root reads physical secret directly;
- secret/reference leaks through log, error, readiness, audit or DTO;
- Vercel/frontend configuration receives database reference/value;
- V1 fallback succeeds after V2 failure.

## 3. Human platform configuration steps

These steps require a later explicit execution authorization.

1. Select exact Railway Production project/environment/service.
2. Configure Dockerfile builder and review that secret `ARG` names are absent.
3. Add the connection and CA values through the Railway UI directly to the Production API service and seal both variables. Do not use Raw Editor, CLI value listing or shared variables.
4. Add the two non-secret reference variables with the exact values in the mapping document.
5. Confirm Vercel and every non-Production Railway environment have neither physical variable.
6. Apply staged configuration only with named operator approval and observe a deployment without making Production DB connection until the separate connection gate is authorized.

## 4. Verification gate

| Gate | Required result |
|---|---|
| Focused resolver/build isolation tests | PASS |
| Affected Production bootstrap tests | PASS |
| Full regression | PASS except separately approved immutable historical fingerprint |
| Docker secret ARG/ENV count | 0 |
| Built artifact secret leakage | 0 |
| Vercel visibility | 0 |
| Dependency/lockfile changes | 0 expected |
| Production connection/writes/deploy during repository implementation | 0 |
| Independent review | READY |

## 5. Stop conditions

STOP if implementation requires a second secret authority, external secrets SDK, runtime fallback, raw Railway value inspection, Vercel secret delivery, Production connection, migration/role execution or unapproved infrastructure mutation.
