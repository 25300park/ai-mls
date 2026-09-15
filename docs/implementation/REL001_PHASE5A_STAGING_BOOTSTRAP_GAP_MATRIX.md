# REL-001 Phase 5A Staging Bootstrap Gap Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-227 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |

## 1. Gap matrix

| Capability | Architecture ready | Implementation ready | Executable now | Auth ready | Backing runtime | Provider dep. | Core dep. | Staging blocker | Action required |
|---|---|---|---|---|---|---|---|---|---|
| Console process/shell | YES | YES | Development only | NO wiring | renderer/server ready | NO | NO | no STAGING config/root | add bounded Staging config/composition/entry |
| Session ingress | YES | YES | NO in Console | semantics YES | Phase 1D durable | NO | NO | `x-session-id` not bound to coordinator | inject trusted Host Session access |
| UI-006 overview | YES | PARTIAL | Development | NO wiring | API-015 ready; Core subset HOLD | NO | API-001/002 deferred | composition | keep bounded API-015/readiness subset; unavailable Core data |
| UI-031 | YES | YES | Development | NO wiring | API-014/018/019 existing | NO | NO | composition | inject existing read port |
| UI-032 | YES | PARTIAL | Development | NO wiring | API-014 view; 011/012 data may be unavailable | NO | NO under 001~010 | composition | preserve partial/unavailable truth |
| UI-033 | YES | PARTIAL | Development | NO wiring | API-014/016~019 existing | NO | NO | composition | inject existing read ports |
| UI-035 audit | YES | YES UI | NO Staging | model YES | API-016 durable runtime | NO | NO | scoped durable query/Host wiring | compose API-016-owned safe read |
| UI-036 administration | YES | YES | Development | model YES | API-015 executable | NO | NO | Staging root/origin/session | compose existing API-015 HTTP boundary |
| Operations supporting views | YES | YES | Development | NO wiring | FEAT-020/023/024 ports | status only | optional Core status | ports unavailable | inject Host-owned immutable projections |
| API-017 status | YES | store/runtime YES | NO Console | model YES | provider-independent complete | live state only | NO | no Console projection | inject bounded readiness/read-by-known-identity projection; no UI-034 activation |
| FEAT-022 status | YES | 3/3 | NO Console | N/A read visibility | provider-independent READY | live provider BLOCKED | NO | no status projection | map existing READY/NOT_READY safely |
| Error/accessibility | YES | YES | Development | N/A | FEAT-021/023 controls | NO | NO | regression proof absent | preserve and test unchanged contracts |

## 2. Exact metrics

| Metric | Result |
|---|---|
| Required Console screens | `6` |
| Existing eligible/executable surfaces | `6/6` |
| Staging-executable screens | `0/6` |
| Staging bootstrap-blocked screens | `6/6` |
| Session bootstrap readiness | `NO` |
| API-015 readiness | `PARTIAL — executable boundary, Staging NOT_WIRED` |
| API-016 readiness | `PARTIAL — durable six-source runtime, Console TRANSPORT_BLOCKED` |
| API-017 readiness | `PARTIAL — provider-integration runtime, Console status NOT_WIRED` |
| FEAT-022 provider-independent readiness | `3/3 READY` |
| FEAT-022 live-provider readiness | `0/3 NOT_READY` |
| Core transport dependencies | `2 APIs / 1 required screen; deferred, non-blocking for bounded view` |
| Provider-independent blockers | `0` |
| Implementation-ready Console screen scope | `6/6`, subject to common bootstrap/wiring |
| Remaining owner decisions | `0` within bounded six-screen scope |
| New API/role/screen/state/dependency/network required | `0/0/0/0/0/0` |

## 3. Gate result

Inventory는 minimum implementation을 bounded composition work로 규정할 충분한 canonical 근거가 있다. UI-034, full Core transport 및 live provider activation은 명시적으로 제외된다. 구현 중 새 transport operation 또는 auth semantics가 실제로 필요하다고 증명되면 즉시 중단한다.
