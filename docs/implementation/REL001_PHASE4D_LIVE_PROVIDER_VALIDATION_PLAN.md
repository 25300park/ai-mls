# REL-001 Phase 4D Live Provider Validation Plan

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-201 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / AI Operations Owner / Security Owner |
| 기준일 | 2026-09-15 |

## 1. Entry gate

이 계획은 실행 승인이 아니다. [Network Scope Approval Packet](REL001_PHASE4D_NETWORK_SCOPE_APPROVAL_PACKET.md)의 모든 `CONFIG_VALUE_REQUIRED` 및 `CONTRACT_REQUIRED` 항목이 exact 값으로 닫히고 별도 scoped network 승인이 기록되기 전에는 어떤 단계도 provider network를 호출하지 않는다.

## 2. Preflight

1. Exact Staging provider/domain/model/timeout/prompt/capability configuration fingerprint를 검증한다.
2. Opaque credential reference availability를 adapter 경계에서만 확인하고 값은 출력하지 않는다.
3. Exact minimized projection의 tenant/scope/data-class binding과 provider retention/residency approval를 검증한다.
4. Non-test adapter, network authorization, active prompt, strict validator 및 safe telemetry composition이 모두 `READY`인지 확인한다.
5. 승인된 request count가 양수이고 bounded인지 확인한다. 미승인 시 allowed calls는 `0`이다.

## 3. Bounded validation sequence

별도 승인 후 capability별 정확히 승인된 수만큼 다음 단일 경로를 검증한다.

`API-017 Job → handler → FEAT-022 application port/service → configured provider adapter → exact approved HTTPS endpoint → strict canonical validator → advisory result → durable API-017 outcome → API-016 evidence`

각 호출은 automatic retry/fallback 없이 한 번만 시도한다. 결과는 canonical output 또는 기존 safe failure로만 관찰한다.

## 4. Required cases

| Case | Expected |
|---|---|
| AI-001 valid bounded Staging input | strict listing-parser schema or safe failure; autonomous mutation 0 |
| AI-004 valid bounded Staging input | strict requirement-parser schema or safe failure; autonomous mutation 0 |
| AI-005 valid bounded Staging input | strict matching schema or safe failure; autonomous mutation 0 |
| missing configuration/credential reference | pre-network `NOT_READY`; calls 0 |
| timeout test boundary | `ADVISORY_UNAVAILABLE`; retry 0; raw detail 0 |
| injected invalid/malformed response | `ADVISORY_OUTPUT_REJECTED`; raw response propagation 0 |

Intentional invalid credential, abuse/rate-limit, load, batch, Production data/credentials 및 background execution은 수행하지 않는다.

## 5. Evidence and stop conditions

허용 evidence는 configuration fingerprint, safe provider/model references, capability/prompt versions, latency, normalized outcome, safe correlation/evidence reference 및 bounded usage metadata뿐이다. Secret, auth header, raw prompt/response, chain-of-thought, stack/path 및 unrestricted PII가 관찰되면 즉시 중단한다.

Named provider contract, approved projection, credential model, destination policy 또는 provider response semantics가 기존 경계를 변경해야 하면 Architecture Owner 결정 전 구현하지 않는다.
