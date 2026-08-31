# F17-E Provider Boundary Foundation Design

| 항목 | 값 |
|---|---|
| Version | v0.1 |
| Status | APPROVED |
| Owner | Architecture Owner |
| Baseline | `02b157c724c034e76ce2ed224f83d0d815b3f00c` |

## Objective

API-014 business authority와 API-018/019 technical evidence boundary를 유지하면서 실제 provider를 활성화하지 않는 fail-closed provider foundation을 구현한다.

## Approved Boundary

- Production composition은 임의 `connectorDispatcher` 주입을 거부하고 unavailable dispatcher만 사용한다.
- Deterministic test adapter는 명시적 test composition에서만 사용하며 network, credential, randomness를 사용하지 않는다.
- Adapter 결과는 `CONFIRMED`, `REJECTED`, `UNKNOWN`과 안전한 evidence/reference 필드만 새 immutable 객체로 정규화한다.
- Malformed, unsafe, thrown, timeout, connection 및 idempotency-conflict 결과는 증명되지 않으면 `UNKNOWN`으로 containment한다.
- F17-C durable intent, `DISPATCH_STARTED`, receipt, idempotency 및 restart no-resend invariants는 변경하지 않는다.

## Exclusions

Sandbox, rbs-homes, production credential, destination allowlist, provider contract/version, API operation, Publication state, dependency 및 Console 변경은 포함하지 않는다.
