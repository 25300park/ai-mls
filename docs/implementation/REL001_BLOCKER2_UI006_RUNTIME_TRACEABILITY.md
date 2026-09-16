# REL-001 Blocker 2 UI-006 Runtime Traceability

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-261 |
| 문서 버전 | v1.0 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner / UI Owner / API Owner / Quality Owner |
| 기준일 | 2026-09-16 |

## 1. Cross-layer mapping

| Requirement | Implementation | Test evidence | 상태 |
|---|---|---|---|
| trusted Session ingress | `staging-console-session-ingress.ts` | revoked/expired, browser tenant override, restart tests | VERIFIED |
| API-001 only | `core-identity-console-read-adapter.ts` exact `GET /v1/me` request | adapter exact-request test; API-001 route regression | VERIFIED |
| four-field DTO | adapter reconstruction + composition strict validation | allowlist/forbidden field tests | VERIFIED |
| tenant/scope binding | adapter and composition exact tenant/team validation | mismatch cases + integrated Staging E2E | VERIFIED |
| partial fail-closed | `withCoreIdentity()` and stale-data-removing `coreUnavailable()` | stale API-015 principal removal + global readiness isolation test | VERIFIED |
| UI-006 presentation | existing `/administration` renderer Current Principal section | renderer/accessibility tests | VERIFIED |
| no direct persistence | injected `ConsoleCoreIdentityReadPort` only | Console architecture regression | VERIFIED |
| no Core expansion | existing closed API-001/002 handler unchanged | Blocker 1 route allowlist regression | VERIFIED |

## 2. Runtime state

| 항목 | 결과 |
|---|---|
| UI-006 live Core data | PASS |
| `/v1/me` integration | PASS |
| API-002 추가 | `0` |
| API-001/002 combined readiness claim | `0` |
| direct persistence access | `0` |
| API-003~010 expansion | `0` |
| new route/screen | `0` |
| dependency/lockfile changes | `0` |

## 3. Release disposition

Blocker 2가 승인되면 UI-006은 `EXECUTABLE`로 재분류할 수 있다. REL-001 acceptance는 live FEAT-022 provider와 fresh dependency audit가 남으므로 `INCOMPLETE`, Promotion Handoff는 `UNAVAILABLE`을 유지한다.
