# REL-001 Phase 1C Session Security / Readiness Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-061 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Security Owner / Operations Owner |
| Baseline | `eccabb4cb55295815a5ad2e9e78929ec9ecd93e6` |
| Related decisions | `DEC-128`, `DEC-129`, `DEC-130` (`APPROVED`) |

## 1. Security controls

| Control | Required evidence | Current status | Failure behavior |
|---|---|---|---|
| opaque carrier | only `x-session-id`; no embedded claims | defined | authentication denial |
| record integrity | complete known fields; version/immutable binding/unknown-field checks | design resolved | fail closed |
| trusted actor | verified principal binding | existing in-process | fail closed |
| tenant binding | actor → current trusted assignment derivation; persisted reference consistency | design resolved | conceal/deny |
| scope binding | live multidimensional assignment and exact resource/purpose scope | design resolved | `SCOPE_DENIED` |
| expiry/freshness | idle `30m`, absolute `12h`, MFA `15m`; trusted persisted timestamps | design resolved | authentication denial / reauthentication |
| revocation | current Session/family state checked every request; irreversible append-preserving metadata | design resolved, implementation absent | immediate denial at next resolution |
| MFA | trusted assurance consistency and existing privileged rule | defined | `REAUTHENTICATION_REQUIRED` |
| live authority | current assignment resolver and AuthorizationService | defined | deny |
| privacy | bounded identifiers; no raw credential/token/MFA secret | defined | redact/reject |
| audit | safe category, correlation, opaque evidence reference, no raw Session ID | design resolved | mandatory evidence failure blocks affected operation |

## 2. Health / readiness

Only existing FEAT-023 vocabulary applies.

| Dependency condition | Health | Readiness | Business authority |
|---|---|---|---|
| store opens, integrity/lookup/revocation/freshness/auth available | `HEALTHY` or evidence-based current value | `READY` | still requires per-request authorization |
| store unavailable/corrupt | `UNHEALTHY` or `UNKNOWN` according to evidence | `NOT_READY` | none |
| authorization source unavailable | component health may be `DEGRADED`/`UNKNOWN` | `NOT_READY` | none |
| required persisted freshness evidence unavailable | `UNKNOWN` | `NOT_READY` | none |
| optional telemetry unavailable but mandatory audit intact | evidence-based `DEGRADED` | bounded readiness only if all hard dependencies remain ready | none |
| mandatory security/audit evidence unavailable | `UNHEALTHY`/`UNKNOWN` | `NOT_READY` | none |

`UNKNOWN` never becomes `READY`, and readiness never grants business authorization.

## 3. Configuration boundary

Potential safe inputs are limited to runtime mode, an explicit Session store reference/path, the fixed REL-001/Staging bounds (`30m` idle, `12h` absolute, `15m` MFA) and approved security/telemetry references. Cleanup cadence and machine-specific defaults are not authorized. Credentials, raw tokens and Production secrets must not be embedded.

## 4. Safe telemetry

Allowed categories include resolution success/failure class, expired/revoked denial, live authorization outcome and concealed tenant/scope denial, using correlation/evidence references. Raw Session IDs, refresh references, actor/session payloads, roles graph, MFA values, credentials, SQL, database paths and stacks are prohibited.

## 5. Current readiness

```text
Restart durability design: RESOLVED
Production-style Staging Session ingress: RESOLVED
Production implementation authorization: YES_FOR_SESSION_BOUNDARY_ONLY
```
