# REL-001 Phase 4D.5 Prompt Asset Manifest

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-215 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner |
| 범위 | REL-001 / Staging / FEAT-022 AI-001, AI-004, AI-005 |

## Canonical binding

| Capability | Prompt ID | Version | Schema | Provider / Model | SHA-256 |
|---|---|---|---|---|---|
| AI-001 | PRM-AI-001-001 | v1.0 | `urn:ai-mls:schema:listing-parser-output:v0.1` | OpenAI / `gpt-5.6-terra` | `EA632846F7341CA6571529B7567A4F519C8911D0846CF868BB746FBF931E6321` |
| AI-004 | PRM-AI-004-001 | v1.0 | `urn:ai-mls:schema:requirement-parser-output:v0.1` | OpenAI / `gpt-5.6-terra` | `1D416BBD7E4D09A4242AE02DED00BB98190FEF43E970EC07DC53438A7A87EF9D` |
| AI-005 | PRM-AI-005-001 | v1.0 | `urn:ai-mls:schema:matching-result:v0.1` | OpenAI / `gpt-5.6-terra` | `E5988693C5704A0570EC6464C73D528B3A8BC40BE0012457950A419F57FE68EA` |

각 fingerprint는 해당 `prompt.md` UTF-8 파일 바이트의 SHA-256이다. Manifest 자체는 fingerprint 입력이 아니다.

## Boundary

- Prompt assets: `3/3 EXISTING_AND_VERSIONED`.
- 상태는 `DRAFT`; account/network activation을 의미하지 않는다.
- `ADVISORY_ONLY`, human review `REQUIRED`, canonical output schema strictness, 허용 변수 및 금지 권한·데이터가 각 자산에 명시되어 있다.
- Credentials, raw Session/Job/database row, unrelated tenant data, provider response, raw prompt 및 chain-of-thought는 prompt 입력·출력에서 금지한다.

## Assets

- [AI-001 prompt](../../modules/ai/prompts/ai-001/v1.0/prompt.md)
- [AI-004 prompt](../../modules/ai/prompts/ai-004/v1.0/prompt.md)
- [AI-005 prompt](../../modules/ai/prompts/ai-005/v1.0/prompt.md)
- [Outbound Projection Contract](REL001_PHASE4D5_OUTBOUND_PROJECTION_CONTRACT.md)
