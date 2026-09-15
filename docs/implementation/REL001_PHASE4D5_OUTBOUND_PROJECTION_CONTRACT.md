# REL-001 Phase 4D.5 Outbound Projection Contract

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-216 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner |
| 범위 | REL-001 / Staging / AI-001, AI-004, AI-005 |

## Global default deny

아래 allowlist에 없는 모든 field는 `DENIED`다. Raw Job, Session, credentials, unrestricted database rows, unrelated tenant data, raw provider/model response, raw prompt, chain-of-thought 및 hidden reasoning은 항상 `DENIED`다. Projection은 trusted tenant/scope boundary 뒤에서 구성하며 credential은 provider adapter만 소비한다.

## AI-001

| Field | Canonical source | Purpose | Sensitivity | PII | Required |
|---|---|---|---|---|---|
| `inputReference` | FEAT-022 input binding | exact-input provenance | internal identifier | no | yes |
| `approvedContentProjection.text` | approved source content projection | parse listing facts | business content | possible; upstream-minimized | yes |
| `sourceContext.sourceType` | source governance | interpretation context | internal metadata | no | yes |
| `sourceContext.language` | source metadata | language handling | low | no | no |
| `sourceContext.observedAt` | source evidence | chronology | low | no | no |
| `sourceContext.allowedUse` | source governance | use limitation | internal policy | no | yes |
| `existingContext[]` | approved listing projection | ambiguity-aware normalization | business content | possible; minimized | no |

## AI-004

| Field | Canonical source | Purpose | Sensitivity | PII | Required |
|---|---|---|---|---|---|
| `inputReference` | FEAT-022 input binding | exact-input provenance | internal identifier | no | yes |
| `originalRequirementText` | approved requirement input | parse requirement | business content | possible; upstream-minimized | yes |
| `language` | input metadata | language handling | low | no | no |
| `locationVocabulary[]` | approved taxonomy | canonical location mapping | internal reference | no | no |
| `propertyTypeVocabulary[]` | approved taxonomy | canonical type mapping | internal reference | no | no |
| `minimumConversationContext[]` | approved minimized context | resolve explicit ambiguity | business content | possible; minimized | no |

Explicitly denied: Client identity, contact channels, unrelated conversation history, sensitive notes and full conversation archives.

## AI-005

AI-005 is projected one candidate per request; `cohortReference` binds that candidate to the evaluated cohort. This minimizes outbound data while preserving the canonical one-candidate output schema.

| Field | Canonical source | Purpose | Sensitivity | PII | Required |
|---|---|---|---|---|---|
| `requirementProjection` | approved requirement projection | matching basis | business criteria | possible; minimized | yes |
| `candidateProjection` | approved single listing projection | candidate evaluation | business listing data | possible; minimized | yes |
| `cohortReference` | matching application | cohort provenance | internal identifier | no | yes |
| `matchingPolicyVersion` | canonical matching policy | deterministic interpretation | internal policy | no | yes |
| `evidenceReferences[]` | approved evidence boundary | attributable explanation | internal reference | no | no |

Explicitly denied: protected characteristics, contact identities, permissions/credentials, raw source records and unrestricted evidence bodies.

## Transport binding

| Capability | Endpoint | Method | Model | Timeout | Max validation calls |
|---|---|---|---|---:|---:|
| AI-001 | `https://kr.api.openai.com/v1/responses` | POST | `gpt-5.6-terra` | 30 s | 2 |
| AI-004 | `https://kr.api.openai.com/v1/responses` | POST | `gpt-5.6-terra` | 30 s | 2 |
| AI-005 | `https://kr.api.openai.com/v1/responses` | POST | `gpt-5.6-terra` | 45 s | 2 |

Total ceiling is 6. Provider retry, provider fallback and model fallback are 0. This contract does not authorize a network call.
