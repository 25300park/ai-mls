# REL-001 Phase 4D.1 Prompt Asset Decision

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-204 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Capability Owner / Prompt Owner / AI Reviewer |
| 기준일 | 2026-09-15 |

## Asset disposition

| Capability | Asset config key | Exact asset ID/path | Prompt version | Capability version | Output schema | Result |
|---|---|---|---|---|---|---|
| `AI-001` | `feat022.capabilities.AI-001.promptAssetRef` | absent | absent | absent | `urn:ai-mls:schema:listing-parser-output:v0.1` | `PROMPT_ASSET_IMPLEMENTATION_REQUIRED` |
| `AI-004` | `feat022.capabilities.AI-004.promptAssetRef` | absent | absent | absent | `urn:ai-mls:schema:requirement-parser-output:v0.1` | `PROMPT_ASSET_IMPLEMENTATION_REQUIRED` |
| `AI-005` | `feat022.capabilities.AI-005.promptAssetRef` | absent | absent | absent | `urn:ai-mls:schema:matching-result:v0.1` | `PROMPT_ASSET_IMPLEMENTATION_REQUIRED` |

Prompt ownership은 FEAT-022다. Repository에는 metadata registry mechanics만 있고 approved physical prompt content/identity/version/fingerprint가 없다. Test fixture prompt IDs는 Staging authority가 아니다.

## Contract to approve with each asset

각 asset은 capability/prompt owner, exact immutable ID/path, version, checksum, provider/model compatibility, permitted variables, input classification, output schema 및 approval evidence를 포함해야 한다. Allowed variables는 [Outbound Data Projection Contract](REL001_PHASE4D1_OUTBOUND_DATA_PROJECTION_CONTRACT.md)의 allowlist만 참조할 수 있다.

API-017 prompt text, credential/config substitution, unrestricted records, unrelated tenant data, undeclared PII, authority-granting instruction 및 chain-of-thought request는 금지한다.
