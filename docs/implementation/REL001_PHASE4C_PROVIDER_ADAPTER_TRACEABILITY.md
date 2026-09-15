# REL-001 Phase 4C Provider Adapter Traceability

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-195 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner / AI Reviewer / Security Reviewer |
| 기준일 | 2026-09-15 |

## 1. Provider-independent boundary

`ConfiguredAdvisoryProviderAdapter`는 기존 `AdvisoryAdapter`를 구현한다. 입력은 canonical FEAT-022 intent이며 API-017 Job 객체나 Session을 받지 않는다. Capability/version, prompt/version, provider/model reference 및 explicit timeout은 typed configuration에서만 결정된다.

Credential value는 `AdvisoryCredentialResolver`를 통해 adapter 내부에서만 사용된다. API-017, handler, application port/service 및 telemetry에는 credential value가 노출되지 않는다. Non-test executor는 scoped network authorization이 `false`이면 credential resolution과 execution 전에 fail closed한다.

## 2. Attempts, validation and failures

- provider executor invocation: 요청당 최대 `1`
- automatic retry: `0`
- provider fallback: `0`
- model fallback: `0`
- real network/credential use in Phase 4C: `0`
- raw provider output consumer: 기존 `AdvisoryRuntime` canonical validator only
- raw exception/header/body/stack/path propagation: `0`

Deterministic test executor는 구조 검증에만 사용되며 Staging execution readiness를 만들지 않는다.

## 3. Telemetry allowlist

허용 필드는 capability ID/version, provider/model reference, correlation, latency, normalized outcome이다. Credential, auth header, raw response, raw prompt, chain-of-thought 및 arbitrary business data는 event에 포함되지 않는다. Telemetry sink 실패는 실행 권한이나 business result를 변경하지 않는다.
