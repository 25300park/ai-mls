# REL-001 Phase 5A Console Readiness Status Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-226 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Operations Owner / Security Owner |

## 1. Required Staging truth

| Component | Health evidence | Readiness rendered | Current truth | Global impact |
|---|---|---|---|---|
| Session boundary | durable DB/binding/authorization probes | `NOT_READY` until wired | implementation READY, Console bootstrap NO | protected Console not ready |
| API-015 | server/store/auth status | `NOT_READY` until composed | implementation READY, Staging wiring partial | UI-006/036 unavailable |
| API-016 | durable store/materializer/query boundary | `NOT_READY` until scoped read wired | six-source runtime READY, Console transport blocked | UI-035/audit sections unavailable |
| API-017 | durable store/one-shot/handler mappings | bounded `READY|NOT_READY|UNKNOWN` | provider-integration boundary READY, Console projection missing | Job supporting status unavailable |
| FEAT-022 provider-independent | three capability adapters/apps | `READY` | `3/3 READY` | does not imply live execution |
| FEAT-022 live provider | external account/network/credential gates | `NOT_READY` | `0/3 NOT_READY` | never promoted to READY |
| Core transport | exact operation readiness | `NOT_READY`/`UNKNOWN` per dependency | Phase 1 HOLD | full Core dashboard data unavailable |
| External dependency | account/contract eligibility | `NOT_READY` | `EXTERNAL_ACCOUNT_AND_CONTRACT_DEPENDENCY` | live AI remains blocked |

## 2. AI/provider projection

Existing Health/Readiness vocabulary can represent the distinction without new business state:

- provider-independent runtime: `READY`;
- live provider execution: `NOT_READY`;
- safe reason/evidence reference: external dependency classification and `DEC-162 = IN_REVIEW`;
- `UNKNOWN` is never translated into `READY`, health, success or execution authority.

## 3. Aggregate rule

Console process Health, backend dependency Readiness and business authorization are separate. The shell may be `HEALTHY` while protected sections are `NOT_READY`/`UNAVAILABLE`. A global Staging-ready claim is prohibited until required Session/API-015/API-016/API-017 composition is executable. Optional/deferred Core and live-provider gaps remain visibly not ready but do not create a false failure of provider-independent code.

## 4. Safe presentation

Status DTOs contain only canonical enum values, component IDs, safe evidence references and bounded messages. They exclude credentials, headers, raw errors, provider payloads, prompts, CoT, SQL, stack and paths. Readiness has no retry/recovery/remediation/deployment effect.
