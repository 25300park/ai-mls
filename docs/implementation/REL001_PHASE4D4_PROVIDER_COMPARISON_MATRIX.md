# REL-001 Phase 4D.4 Official Provider Comparison Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-210 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / AI Operations Owner / Security Owner / Privacy Owner |
| 기준일 | 2026-09-15 |
| Decision | `DEC-162` (`IN REVIEW`) |

## 1. 평가 경계

이 문서는 [Phase 4D.3 Decision Packet](REL001_PHASE4D3_PROVIDER_SELECTION_ACTIVATION_DECISION_PACKET.md)의 `AI-001`, `AI-004`, `AI-005` 요구사항에 대해 OpenAI API, Anthropic Claude API, Google Gemini API Paid Services를 비교한다. 공개 공식 문서 조회만 수행했으며 inference, authenticated API, credential, billable request 및 repository implementation은 `0`이다.

## 2. Capability fit

세 capability 모두 text 중심 입력, strict canonical JSON output, 한국어/영어 처리, evidence/reference binding 및 mandatory human review를 요구한다. Exact context/SLO bound는 canonical repository에 없으므로 provider context window를 사용 허가로 해석하지 않는다.

| Provider / model | Current status | Context / max output | Structured output | Multilingual / input fit | FEAT-022 adapter fit | Assessment |
|---|---|---:|---|---|---|---|
| OpenAI `gpt-5.6-terra` | `Default`; current page에 deprecation 표시 없음 | 1,050,000 / 128,000 tokens | Responses JSON Schema + `strict: true` | latest OpenAI models are multilingual; text/image input, text output | provider-neutral REST structured generation; implementation/evaluation 별도 | `PRIMARY` candidate |
| Anthropic `claude-sonnet-5` | `Active`; retirement not sooner than 2027-06-30 | 1,000,000 / 128,000 tokens | `output_config.format` JSON Schema | current Claude models are multilingual; text/image input, text output | Messages REST; thinking blocks/type selection 명시 처리 필요 | `SECONDARY` candidate |
| Google `gemini-3.5-flash` | `Stable` | 1,048,576 / 65,536 tokens | supported | text/image/video/audio/PDF input, text output | GenerateContent REST | capability fit은 양호하나 privacy/residency risk로 비추천 |

## 3. Endpoint and operational comparison

| Provider | Exact official destination | Method / API class | Region/residency mechanism | Operational note |
|---|---|---|---|---|
| OpenAI | `https://kr.api.openai.com/v1/responses` | `POST` Responses | South Korea: storage YES, processing NO; non-US residency requires approved abuse-monitoring control and Modified Retention amendment | conditional on organization/project eligibility; tools/search/files/stateful conversation disabled |
| Anthropic | `https://api.anthropic.com/v1/messages` | `POST` Messages | `inference_geo`: `global` or `us`; US-only is 1.1x token price | no Korea option established in reviewed first-party docs |
| Google | `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent` | `POST` `models.generateContent` | Developer API region pinning not established in reviewed docs | paid project required; files/caching/grounding/tools disabled |

## 4. Weighted decision matrix

Score 1 (weak/blocking) to 5 (strong) is a decision-support judgment, not a provider claim.

| Dimension | Weight | OpenAI | Anthropic | Google Gemini Developer API |
|---|---:|---:|---:|---:|
| Privacy/data controls | 25 | 4 | 4 | 2 |
| Capability fit | 20 | 5 | 5 | 4 |
| Existing adapter fit | 15 | 5 | 4 | 4 |
| Structured output | 15 | 5 | 5 | 4 |
| Operational simplicity | 10 | 4 | 4 | 4 |
| Cost | 10 | 3 | 3 | 4 |
| Stability/deprecation risk | 5 | 4 | 5 | 5 |
| **Weighted / 5** | **100** | **4.35** | **4.30** | **3.45** |

OpenAI narrowly leads because strict Responses JSON output and South Korea storage coexist with a provider-neutral REST shape. Korea processing is unavailable and retention-control approval is mandatory. Anthropic is a near-equivalent alternative with an explicit retirement commitment and ZDR eligibility, but only global/US inference controls were established. Google is technically capable but its abuse-monitoring retention and Developer API ZDR/residency constraints are less aligned with the first sensitive Staging validation.

## 5. Official source catalog

All sources accessed 2026-09-15.

| Ref | Official title | URL | Evidence used |
|---|---|---|---|
| OAI-01 | GPT-5.6 Terra Model | https://developers.openai.com/api/docs/models/gpt-5.6-terra | ID, limits, pricing, endpoints, structured output |
| OAI-02 | Models | https://developers.openai.com/api/docs/models | multilingual/model-selection guidance |
| OAI-03 | Structured model outputs | https://developers.openai.com/api/docs/guides/structured-outputs | strict JSON Schema output |
| OAI-04 | Data controls in the OpenAI platform | https://developers.openai.com/api/docs/guides/your-data | training, retention, ZDR, Korea residency |
| ANT-01 | Models overview | https://platform.claude.com/docs/en/models/overview | ID, capability, limits, multilingual, price |
| ANT-02 | Model deprecations | https://platform.claude.com/docs/en/about-claude/model-deprecations | active/retirement status |
| ANT-03 | Structured outputs | https://platform.claude.com/docs/en/build-with-claude/structured-outputs | constrained JSON output |
| ANT-04 | API overview | https://platform.claude.com/docs/en/api/overview | REST host/Messages API |
| ANT-05 | Data residency | https://platform.claude.com/docs/en/manage-claude/data-residency | geography/price multiplier |
| GOOG-01 | Gemini 3.5 Flash | https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash | stable model, limits, capabilities |
| GOOG-02 | Generating content | https://ai.google.dev/api/generate-content | endpoint/method |
| GOOG-03 | Structured output | https://ai.google.dev/gemini-api/docs/structured-output | JSON Schema support |

## 6. Disposition

Evidence is sufficient for AO selection review, but `DEC-162` remains `IN REVIEW`. Provider execution, credential use and network activation authority remain `0`.
