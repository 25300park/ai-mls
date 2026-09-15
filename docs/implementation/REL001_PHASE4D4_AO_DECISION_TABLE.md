# REL-001 Phase 4D.4 Architecture Owner Decision Table

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-214 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 기준일 | 2026-09-15 |
| Decision | `DEC-162` (`IN REVIEW`) |

The table contains exactly the seven decisions required by Phase 4D. All values remain non-authoritative until explicit AO approval.

| Decision | Recommended value | Evidence status | AO approval required |
|---|---|---|---|
| 1. Named provider | OpenAI API `PRIMARY`; Anthropic `SECONDARY`; Gemini Developer API Paid Services `NOT_RECOMMENDED_FOR_REL001_STAGING` | official comparison complete 2026-09-15; [matrix](REL001_PHASE4D4_PROVIDER_COMPARISON_MATRIX.md) | YES |
| 2. Model(s) | `OPTION A`; all three use OpenAI `gpt-5.6-terra` (`PROPOSED_AO_VALUE`) | current official status, schema, context and price evidence complete; live quality evaluation absent | YES |
| 3. Timeout(s) | AI-001 30,000 ms; AI-004 30,000 ms; AI-005 45,000 ms (`PROPOSED_AO_VALUE`) | no official contradiction; application proposals, not provider defaults | YES |
| 4. Credential reference | `FEAT022_STAGING_OPENAI_API_KEY`; selected provider adapter only; secret value absent | containment contract exists; provisioning/vault binding absent | YES |
| 5. Prompt asset status | `AUTHORING_REQUIRED` for three proposed `modules/ai/prompts/ai-00x/v1.0/prompt.md` assets | output schemas exist; physical assets/checksums/evaluations 0/3 | YES |
| 6. Outbound projection | Phase 4D.3 section 7 minimum allowlists; everything else `DENIED` | source mapping complete; owner approval/enforcement evidence pending | YES |
| 7. Endpoint / retention / billing-request limit | `POST https://kr.api.openai.com/v1/responses`; require MAM/ZDR + Modified Retention amendment; Korea storage/non-Korea processing; 2/2/2 calls total 6; retry/fallback/batch/load 0; token/USD ceiling open | official endpoint/data-control/pricing evidence complete; account settings, terms, token/USD ceiling and network authorization pending | YES |

Final Recommendation: `READY_FOR_ARCHITECTURE_OWNER_PROVIDER_SELECTION`.

Production changes `0`; inference calls `0`; credential use `0`; billable requests `0`; commit `NOT_AUTHORIZED`; push `NOT_PERFORMED`.
