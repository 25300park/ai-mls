# REL-001 Phase 4D.4 Privacy and Retention Evidence

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-211 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 기준일 | 2026-09-15 |
| 범위 | public official provider evidence only |

## 1. Evidence matrix

| Provider | Training/use | Default retention / abuse logging | ZDR | Human review | Region/residency | Processor/DPA | REL-001 implication |
|---|---|---|---|---|---|---|---|
| OpenAI API | API data is not used to train/improve models unless customer opts in | abuse logs may include prompts/responses and are retained up to 30 days by default; Responses state can be retained at least 30 days when stored | approved organizations; excludes content from abuse logs and forces Responses `store=false`; limitations apply | exceptional severe-risk review under notified conditions and applicable-law exception | Korea domain stores in Korea but does not process there; MAM/ZDR plus Modified Retention amendment required | official DPA defines customer as controller and OpenAI as processor for API customer data; exact executed customer agreement/amendment `UNKNOWN / BLOCKING` | primary only after project controls and bounded stateless request are proven |
| Anthropic Claude API | retained data is not used for training without express permission | retention depends on feature/model; conversation content not retained by default except covered models; flagged/legal-hold exceptions apply | organization-level, on request; Messages and qualified structured outputs eligible; schema may be cached up to 24 hours and must contain no sensitive data | flagged usage may be reviewed under safety processes; exact contract exceptions require confirmation | first-party API exposes `global` or `us`; US-only costs 1.1x; no Korea option established | Anthropic is processor for first-party API; exact executed commercial/ZDR terms `UNKNOWN / BLOCKING` | strong alternative after ZDR/commercial terms confirmation; schema must contain no PII |
| Gemini Developer API Paid Services | paid prompts/responses are not used to improve products | abuse monitoring logs prompts/responses; official page states 55-day retention | guidance directs guaranteed ZDR or enterprise-DPA workloads to Vertex AI; stateful/caching features add retention | authorized personnel may manually review flagged content | data may be transiently stored/cached wherever Google or agents operate; no Developer API region pin established | Paid Services reference processor DPA, but guaranteed ZDR/enterprise controls direct users to Vertex AI | not recommended without separately approved Vertex AI/provider-surface decision |

## 2. Minimum privacy conditions

1. Only [Phase 4D.3 section 7](REL001_PHASE4D3_PROVIDER_SELECTION_ACTIVATION_DECISION_PACKET.md) fields may leave the application; everything else is denied.
2. Raw Job, Session, credentials, unrestricted rows, full conversation, protected attributes, contact channels, prompt assets and raw provider responses are prohibited.
3. Stateful conversations, files, tools, grounding, provider search and persistent caching are disabled unless separately approved.
4. JSON Schema contains structure only, never tenant/property/contact/client values.
5. Canonical validation and human review remain authoritative; provider output grants no approval, execution or mutation authority.
6. Account/project ZDR, DPA, residency and retention settings need preflight evidence before live use.

## 3. Official sources

Accessed 2026-09-15.

| Ref | Official title | URL |
|---|---|---|
| OAI-P1 | Data controls in the OpenAI platform | https://developers.openai.com/api/docs/guides/your-data |
| OAI-P2 | Data processing addendum | https://openai.com/policies/data-processing-addendum/ |
| ANT-P1 | API and data retention | https://platform.claude.com/docs/en/manage-claude/api-and-data-retention |
| ANT-P2 | How long do you store my organization's data? | https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data |
| ANT-P3 | Data residency | https://platform.claude.com/docs/en/manage-claude/data-residency |
| ANT-P4 | Does Anthropic act as a Data Processor or Controller? | https://support.anthropic.com/en/articles/9267385-does-anthropic-act-as-a-data-processor-or-controller |
| GOOG-P1 | Gemini API Additional Terms of Service | https://ai.google.dev/gemini-api/terms |
| GOOG-P2 | Abuse monitoring | https://ai.google.dev/gemini-api/docs/usage-policies |
| GOOG-P3 | Zero data retention in the Gemini Developer API | https://ai.google.dev/gemini-api/docs/zdr |

## 4. Unresolved activation evidence

- `OPEN DECISION`: executed provider contract/DPA/ZDR and exact account/project controls.
- `OPEN DECISION`: Korea storage with non-Korea processing acceptance.
- `OPEN DECISION`: safety-retention/human-review exceptions acceptance.
- Until closed, network activation readiness remains `0/3 NOT_READY`.
