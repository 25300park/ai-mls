# REL-001 Phase 4C Configuration Readiness Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-196 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner / AI Reviewer / Operations Owner |
| 기준일 | 2026-09-15 |

## 1. Required configuration

| Capability | Structural boundary | Concrete provider/model | Timeout | Credential availability | Network authorization | Provider-independent | Staging execution |
|---|---|---|---|---|---|---|---|
| `AI-001` | IMPLEMENTED | `CONFIG_VALUE_REQUIRED` | `CONFIG_VALUE_REQUIRED` | UNAVAILABLE | NOT_AUTHORIZED | READY | NOT_READY |
| `AI-004` | IMPLEMENTED | `CONFIG_VALUE_REQUIRED` | `CONFIG_VALUE_REQUIRED` | UNAVAILABLE | NOT_AUTHORIZED | READY | NOT_READY |
| `AI-005` | IMPLEMENTED | `CONFIG_VALUE_REQUIRED` | `CONFIG_VALUE_REQUIRED` | UNAVAILABLE | NOT_AUTHORIZED | READY | NOT_READY |

## 2. Readiness rules

`providerIndependent=READY`는 동일 adapter identity에 결합된 capability-specific Application Service, `AdvisoryRuntime`, active canonical Prompt/Persistence, canonical validator와 safe failure mapper의 실제 composition graph가 실행 가능하다는 뜻이며 external provider readiness가 아니다. 서로 분리되거나 invalid한 runtime 객체의 단순 존재는 `READY`가 될 수 없다. `stagingExecution=READY`에는 valid concrete configuration, credential availability, scoped network authorization 및 non-test adapter가 모두 필요하다. 하나라도 없으면 `NOT_READY`이고 숨은 default는 없다.

Phase 4C 완료 예상 상태는 provider-independent `3/3 READY`, actual network-backed Staging execution `0/3 NOT_READY`이다. 이 표의 `READY/NOT_READY`는 기존 FEAT-023 vocabulary를 재사용하며 business authorization을 부여하지 않는다.
