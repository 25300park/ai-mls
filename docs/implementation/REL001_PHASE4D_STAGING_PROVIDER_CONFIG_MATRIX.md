# REL-001 Phase 4D Staging Provider Configuration Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-197 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / AI Operations Owner / Security Owner |
| 기준일 | 2026-09-15 |

## 1. Purpose

Phase 4C의 provider-independent 경계를 실제 Staging provider 실행으로 전환하기 전에 필요한 exact configuration을 inventory한다. 이 문서는 provider나 값을 선택하지 않으며 secret value를 기록하지 않는다.

## 2. Canonical configuration inventory

| Capability | Environment | Provider key/value | Model key/value | Timeout key/value | Credential reference | Capability version | Prompt asset/version | Schema | Endpoint/domain | Result |
|---|---|---|---|---|---|---|---|---|---|---|
| `AI-001` | `Staging` | `feat022.capabilities.AI-001.providerRef` / `CONFIG_VALUE_REQUIRED` | `feat022.capabilities.AI-001.modelRef` / `CONFIG_VALUE_REQUIRED` | `feat022.capabilities.AI-001.timeoutMs` / `CONFIG_VALUE_REQUIRED` | `feat022.providers.<providerRef>.credentialRef` / `CONFIG_VALUE_REQUIRED` | `CONFIG_VALUE_REQUIRED` | `feat022.capabilities.AI-001.promptAssetRef` / `CONFIG_VALUE_REQUIRED` | `urn:ai-mls:schema:listing-parser-output:v0.1` | `CONFIG_VALUE_REQUIRED` | `NOT_READY` |
| `AI-004` | `Staging` | `feat022.capabilities.AI-004.providerRef` / `CONFIG_VALUE_REQUIRED` | `feat022.capabilities.AI-004.modelRef` / `CONFIG_VALUE_REQUIRED` | `feat022.capabilities.AI-004.timeoutMs` / `CONFIG_VALUE_REQUIRED` | `feat022.providers.<providerRef>.credentialRef` / `CONFIG_VALUE_REQUIRED` | `CONFIG_VALUE_REQUIRED` | `feat022.capabilities.AI-004.promptAssetRef` / `CONFIG_VALUE_REQUIRED` | `urn:ai-mls:schema:requirement-parser-output:v0.1` | `CONFIG_VALUE_REQUIRED` | `NOT_READY` |
| `AI-005` | `Staging` | `feat022.capabilities.AI-005.providerRef` / `CONFIG_VALUE_REQUIRED` | `feat022.capabilities.AI-005.modelRef` / `CONFIG_VALUE_REQUIRED` | `feat022.capabilities.AI-005.timeoutMs` / `CONFIG_VALUE_REQUIRED` | `feat022.providers.<providerRef>.credentialRef` / `CONFIG_VALUE_REQUIRED` | `CONFIG_VALUE_REQUIRED` | `feat022.capabilities.AI-005.promptAssetRef` / `CONFIG_VALUE_REQUIRED` | `urn:ai-mls:schema:matching-result:v0.1` | `CONFIG_VALUE_REQUIRED` | `NOT_READY` |

`providerRef`, `modelRef`, `timeoutMs`, `credentialRef`, capability version, prompt identity/version 및 endpoint/domain의 concrete Staging 값은 repository canonical source에 존재하지 않는다. Test fixture 값은 Staging authority가 아니며 재사용하지 않는다.

## 3. Ownership and fail-closed rules

- Provider/model/timeout/prompt selection owner: FEAT-022 composition/configuration boundary.
- API-017 및 Job handler selection authority: `0`.
- Hidden/default provider, model 또는 timeout: `0`.
- Automatic retry, provider fallback, model fallback: `0`.
- Missing/malformed value: capability `NOT_READY`, provider invocation `0`.
- Production configuration reuse: `NOT_AUTHORIZED`.

## 4. Missing contract

현재 `AdvisoryProviderExecutionRequest`는 canonical intent의 reference/fingerprint metadata와 adapter 내부 credential만 전달한다. 실제 provider에 보낼 최소 canonical content projection과 그 data-class allowlist는 승인된 contract로 존재하지 않는다. Reference-only intent를 임의로 database lookup 또는 raw object 전송으로 확장할 수 없으므로, 이 outbound projection contract가 승인되기 전 실제 inference는 차단한다.
