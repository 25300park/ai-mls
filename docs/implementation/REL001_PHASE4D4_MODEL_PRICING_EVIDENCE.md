# REL-001 Phase 4D.4 Model and Pricing Evidence

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-212 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 기준일 | 2026-09-15 |
| Currency | USD, official per-million-token prices unless stated |

## 1. Current model evidence

| Provider | Evaluated model | Status | Context | Max output | Structured output | Standard input | Cached input/read | Cache write/storage | Output |
|---|---|---|---:|---:|---|---:|---:|---:|---:|
| OpenAI | `gpt-5.6-terra` | Default/current | 1,050,000 | 128,000 | supported | $2.00 | $0.20 | cache writes 1.25x uncached input | $12.00 |
| Anthropic | `claude-sonnet-5` | Active; retirement not sooner 2027-06-30 | 1,000,000 | 128,000 | supported | $2.00 | $0.20 | 5-minute write $2.50; 1-hour write $4.00 | $10.00 |
| Google | `gemini-3.5-flash` | Stable | 1,048,576 | 65,536 | supported | $1.50 | $0.15 | storage $1.00 per 1M tokens/hour | $9.00 including thinking tokens |

Tools, search, grounding, batch, priority and file storage are denied, so their charges are not required. Prices are point-in-time evidence, not quotes. Anthropic US inference is 1.1x. OpenAI input over 272K tokens is charged at a higher rate, but minimum projections must remain far below that threshold.

## 2. Model, timeout and request proposal

| Capability | `PROPOSED_AO_VALUE` | Timeout | Official contradiction | Initial calls |
|---|---|---:|---|---:|
| `AI-001` | OpenAI / `gpt-5.6-terra` | 30,000 ms | NO; docs do not prescribe application timeout | 2 |
| `AI-004` | OpenAI / `gpt-5.6-terra` | 30,000 ms | NO | 2 |
| `AI-005` | OpenAI / `gpt-5.6-terra` | 45,000 ms | NO | 2 |
| **Total** | one shared model | — | — | **6** |

Timeouts/counts are owner proposals, not provider limits. Retry, fallback, batch/load and implicit second model are `0`. Authorized requests remain `0` until AO approval and separate network authorization.

## 3. Official sources

All accessed 2026-09-15.

| Ref | Official title | URL | Evidence |
|---|---|---|---|
| OAI-M1 | GPT-5.6 Terra Model | https://developers.openai.com/api/docs/models/gpt-5.6-terra | limits, price, cache rule, features |
| ANT-M1 | Models overview | https://platform.claude.com/docs/en/models/overview | limits/base price |
| ANT-M2 | Model deprecations | https://platform.claude.com/docs/en/about-claude/model-deprecations | active/retirement |
| ANT-M3 | What's new in Claude Sonnet 5 | https://platform.claude.com/docs/en/models/sonnet-5/whats-new-sonnet-5 | behavior, availability, price |
| ANT-M4 | Data residency | https://platform.claude.com/docs/en/manage-claude/data-residency | US multiplier |
| GOOG-M1 | Gemini 3.5 Flash | https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash | stable status/limits |
| GOOG-M2 | Gemini Developer API pricing | https://ai.google.dev/gemini-api/docs/pricing | standard paid price/cache |

## 4. Cost limitation

Exact USD ceiling cannot be calculated without approved per-capability maximum input/output tokens. Thus `2/2/2` calls is the only proposed ceiling here. Token/USD ceilings remain `OPEN DECISION`; monthly/Production extrapolation is absent.
