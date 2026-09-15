# REL-001 Phase 3G-C AI-004 Application Port Contract

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-164 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | AI Reviewer / Business Owner |
| 기준일 | 2026-09-15 |
| Decision | `DEC-153` (`APPROVED`) |

## 1. Capability binding

`Ai004RequirementParseApplicationPort`는 `AI_REQUIREMENT_PARSE → AI-004` mapping만 제공한다. 기존 [Requirement Parser](../book-4/07_REQUIREMENT_PARSER.md)와 FEAT-022 `AdvisoryRuntime` 의미를 변경하지 않는다.

## 2. Contract

```text
Ai004AdvisoryExecutionRequest = AdvisoryExecutionRequest where
  capabilityId = AI-004
  schemaId = urn:ai-mls:schema:requirement-parser-output:v0.1

Ai004AcceptedAdvisoryRecord = AcceptedAdvisoryRecord where
  capabilityId = AI-004
  schemaId = urn:ai-mls:schema:requirement-parser-output:v0.1
  envelope.output = Ai004Output

Ai004RequirementParseApplicationPort.execute(
  request: Ai004AdvisoryExecutionRequest
) -> Ai004AcceptedAdvisoryRecord
```

새 input/output field는 없다. Original requirement text, Session, HTTP request 또는 Client history를 port payload로 추가하지 않는다.

## 3. Ownership and safety

- Port owner: FEAT-022 application layer / Business Owner.
- Existing resolver가 tenant/scope와 authorized Requirement reference를 검증한다.
- Output은 Requirement proposal인 `Ai004Output`이며 active Requirement를 변경하거나 consent를 추론하지 않는다.
- Prompt/provider/persistence는 기존 FEAT-022 boundary 뒤에 남는다.
- Raw provider failure는 safe `AdvisoryRuntimeError`로만 경계를 통과한다.

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

Manual structured entry fallback은 AI-004 successful Job handler 구현이 아니므로 Staging executable evidence로 계산하지 않는다.
