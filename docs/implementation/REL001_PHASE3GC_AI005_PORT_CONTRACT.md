# REL-001 Phase 3G-C AI-005 Application Port Contract

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-165 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | AI Reviewer / Matching Owner |
| 기준일 | 2026-09-15 |
| Decision | `DEC-153` (`APPROVED`) |

## 1. Capability binding

`Ai005MatchingApplicationPort`는 `AI_MATCHING → AI-005` mapping만 제공한다. 기존 [Matching and Ranking](../book-4/08_MATCHING_AND_RANKING.md)과 FEAT-022 `AdvisoryRuntime` 의미를 변경하지 않는다.

## 2. Contract

```text
Ai005AdvisoryExecutionRequest = AdvisoryExecutionRequest where
  capabilityId = AI-005
  schemaId = urn:ai-mls:schema:matching-result:v0.1

Ai005AcceptedAdvisoryRecord = AcceptedAdvisoryRecord where
  capabilityId = AI-005
  schemaId = urn:ai-mls:schema:matching-result:v0.1
  envelope.output = Ai005Output

Ai005MatchingApplicationPort.execute(
  request: Ai005AdvisoryExecutionRequest
) -> Ai005AcceptedAdvisoryRecord
```

Requirement/Candidate/Offer/cohort semantics와 output factor/score/rank/confidence는 기존 `Ai005Output`만 사용한다.

## 3. Ownership and safety

- Port owner: FEAT-022 application layer / Matching Owner.
- Eligibility는 model preference가 아니라 기존 trusted snapshot/application policy가 소유한다.
- Handler는 matching logic, score interpretation 또는 business filtering을 구현하지 않는다.
- Output은 advisory이며 shortlist, publish 또는 lifecycle mutation authority가 없다.
- Raw provider response/failure는 port 밖으로 노출하지 않는다.

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

Book 4의 deterministic filter/sort fallback은 current FEAT-022 Production `AI-005` output implementation으로 존재하지 않으므로 대체 handler로 계산하지 않는다.
