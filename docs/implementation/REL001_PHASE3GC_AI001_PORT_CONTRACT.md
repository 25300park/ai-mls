# REL-001 Phase 3G-C AI-001 Application Port Contract

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-163 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | AI Reviewer / Listing Data Owner |
| 기준일 | 2026-09-15 |
| Decision | `DEC-153` (`APPROVED`) |

## 1. Capability binding

`Ai001ListingParseApplicationPort`는 `AI_LISTING_PARSE → AI-001` mapping만 제공한다. 기존 [Listing Parser](../book-4/04_LISTING_PARSER.md)와 FEAT-022 `AdvisoryRuntime` 의미를 변경하지 않는다.

## 2. Contract

```text
Ai001AdvisoryExecutionRequest = AdvisoryExecutionRequest where
  capabilityId = AI-001
  schemaId = urn:ai-mls:schema:listing-parser-output:v0.1

Ai001AcceptedAdvisoryRecord = AcceptedAdvisoryRecord where
  capabilityId = AI-001
  schemaId = urn:ai-mls:schema:listing-parser-output:v0.1
  envelope.output = Ai001Output

Ai001ListingParseApplicationPort.execute(
  request: Ai001AdvisoryExecutionRequest
) -> Ai001AcceptedAdvisoryRecord
```

이는 TypeScript 구현 지시가 아니라 기존 type을 exact literal로 좁힌 canonical contract이다. 새 request/output field는 `0`이다.

## 3. Ownership and safety

- Port owner: FEAT-022 application layer / Listing Data Owner.
- Trusted snapshot resolution, prompt/schema 검증, output validation, advisory persistence와 idempotency는 기존 `AdvisoryRuntime`이 소유한다.
- Raw Source content는 port input에 직접 전달하지 않고 canonical `inputReference`로 결속한다.
- Raw provider response와 exception은 port를 통과하지 않는다.
- Handler는 returned advisory를 verified Listing truth 또는 mutation authority로 해석하지 않는다.

## 4. Runtime disposition

| Gate | Result |
|---|---|
| `PORT_CONTRACT_READY` | YES |
| existing shared capability runtime | YES |
| exact concrete port adapter | NO |
| provider classification | `PROVIDER_REQUIRED` |
| `NO_NETWORK_EXECUTION_READY` | NO |
| `CONTAINMENT_READY` | contract YES / implementation NO |
| `STAGING_EXECUTION_READY` | NO |

Production `AdvisoryRuntime`은 unavailable adapter를 사용한다. Test-only deterministic adapter는 Production substitute가 아니다.
