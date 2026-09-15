# REL-001 Phase 4D.4 Provider Selection Recommendation

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-213 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 기준일 | 2026-09-15 |
| Decision | `DEC-162` (`IN REVIEW`) |

## 1. Recommendation

- `PRIMARY`: OpenAI API, shared `gpt-5.6-terra` for `AI-001/004/005`.
- `SECONDARY`: Anthropic Claude API, shared `claude-sonnet-5`.
- `NOT_RECOMMENDED_FOR_REL001_STAGING`: Google Gemini Developer API Paid Services with `gemini-3.5-flash`. This does not classify all Google Cloud AI products.
- Architecture option: `OPTION A` one provider/model family. Official evidence shows no material need for first-validation multi-provider complexity.

## 2. Proposed owner values

| Capability | Provider/model | Timeout | Credential reference | Prompt status | Calls |
|---|---|---:|---|---|---:|
| `AI-001` | OpenAI / `gpt-5.6-terra` | 30,000 ms | `FEAT022_STAGING_OPENAI_API_KEY` | `AUTHORING_REQUIRED`: `modules/ai/prompts/ai-001/v1.0/prompt.md` | 2 |
| `AI-004` | same | 30,000 ms | same adapter-only reference | `AUTHORING_REQUIRED`: `modules/ai/prompts/ai-004/v1.0/prompt.md` | 2 |
| `AI-005` | same | 45,000 ms | same adapter-only reference | `AUTHORING_REQUIRED`: `modules/ai/prompts/ai-005/v1.0/prompt.md` | 2 |

Every value is `PROPOSED_AO_VALUE`. No secret, credential lookup, prompt content or runtime config was created.

## 3. Proposed network boundary

- `POST https://kr.api.openai.com/v1/responses`
- Model `gpt-5.6-terra`; bounded text input; strict JSON Schema output; `store=false`.
- Tools, search, files, conversation state, background mode, retry, fallback, batch/load disabled.
- Korea storage is supported; Korea processing is not. MAM/ZDR approval and Modified Retention amendment are prerequisites.
- Maximum calls: AI-001 2, AI-004 2, AI-005 2, total 6.

## 4. Outbound projection

Adopt exactly [Phase 4D.3 section 7](REL001_PHASE4D3_PROVIDER_SELECTION_ACTIVATION_DECISION_PACKET.md); everything else is `DENIED`. Provider terms cannot broaden application data authority. Security/Privacy/Data owners must approve and prove tokenization/redaction and absence of raw Job/Session/credentials/contact channels/full history/protected attributes.

## 5. Trade-offs and blockers

OpenAI offers strict output, sufficient context and Korea storage, but not Korean processing and requires approved retention controls. Anthropic has comparable capability, lower output price and explicit retirement horizon; reviewed residency is global/US and Sonnet 5 thinking blocks require adapter normalization. Gemini is capable and lower-priced, but Developer API abuse retention is 55 days and guaranteed-ZDR/enterprise needs are directed to Vertex AI, outside this provider surface.

AO selection still does not activate anything. Remaining blockers are: three prompt assets/evaluations; executed MAM/ZDR/retention evidence; Korea-processing acceptance; projection approval; input/output token and USD ceiling; and exact-destination network authorization.

## 6. Evidence and disposition

See [Comparison](REL001_PHASE4D4_PROVIDER_COMPARISON_MATRIX.md), [Privacy](REL001_PHASE4D4_PRIVACY_RETENTION_EVIDENCE.md), and [Pricing](REL001_PHASE4D4_MODEL_PRICING_EVIDENCE.md). All external sources were accessed 2026-09-15.

Final Recommendation: `READY_FOR_ARCHITECTURE_OWNER_PROVIDER_SELECTION`.

`DEC-162` stays `IN REVIEW`; readiness `0/3 NOT_READY`; inference/network/credentials remain `0`.
