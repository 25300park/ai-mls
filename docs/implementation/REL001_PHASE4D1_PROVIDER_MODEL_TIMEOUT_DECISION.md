# REL-001 Phase 4D.1 Provider / Model / Timeout Decision

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-202 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / AI Operations Owner |
| 기준일 | 2026-09-15 |
| Decision | `DEC-162` (`IN REVIEW`) |

## Decision result

Repository canonical source는 named provider를 승인하지 않았다. 따라서 provider/model/timeout을 임의로 선택하지 않으며 `DEC-162`는 owner input 대기 상태다.

| Capability | Environment | Provider/config key | Model/config key | Timeout/config key | Failure classification | Result |
|---|---|---|---|---|---|---|
| `AI-001` | `Staging` | `feat022.capabilities.AI-001.providerRef` / `CONFIG_VALUE_REQUIRED` | `feat022.capabilities.AI-001.modelRef` / `CONFIG_VALUE_REQUIRED` | `feat022.capabilities.AI-001.timeoutMs` / `CONFIG_VALUE_REQUIRED` | timeout/provider failure → `ADVISORY_UNAVAILABLE` → `DEPENDENCY_UNAVAILABLE` | OPEN |
| `AI-004` | `Staging` | `feat022.capabilities.AI-004.providerRef` / `CONFIG_VALUE_REQUIRED` | `feat022.capabilities.AI-004.modelRef` / `CONFIG_VALUE_REQUIRED` | `feat022.capabilities.AI-004.timeoutMs` / `CONFIG_VALUE_REQUIRED` | same | OPEN |
| `AI-005` | `Staging` | `feat022.capabilities.AI-005.providerRef` / `CONFIG_VALUE_REQUIRED` | `feat022.capabilities.AI-005.modelRef` / `CONFIG_VALUE_REQUIRED` | `feat022.capabilities.AI-005.timeoutMs` / `CONFIG_VALUE_REQUIRED` | same | OPEN |

Provider/model/timeout owner는 FEAT-022다. API-017과 handlers의 selection authority는 `0`; fallback과 hidden default는 `0`; Production reuse는 `NOT_AUTHORIZED`다.

## Owner action required

AI Operations/Architecture Owner가 capability별 exact providerRef, immutable modelRef 및 positive bounded timeout milliseconds를 승인해야 한다. 같은 provider 사용 여부도 그 결정에서 명시해야 한다.
