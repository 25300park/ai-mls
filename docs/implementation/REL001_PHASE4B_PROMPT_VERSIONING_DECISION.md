# REL-001 Phase 4B Prompt / Capability Versioning Decision

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-181 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | AI Reviewer / Capability Owner |
| 기준일 | 2026-09-15 |

## 1. Reused canonical rules

Prompt ownership remains FEAT-022 Prompt Governance. API-017 handlers may pass approved immutable prompt references but may not contain prompt text, construct prompts, select prompt versions or write raw prompt content to Audit evidence.

The existing runtime binds `capability`, `schemaId`, `promptId`, `promptVersion`, `promptFingerprint` and `executionFingerprint`. An `ACTIVE` immutable prompt metadata record is required before execution.

## 2. Capability assessment

| Capability | Prompt owner | Exact prompt/version ref | Capability binding | Mutability | Evidence | Result |
|---|---|---|---|---|---|---|
| AI-001 | FEAT-022 capability/prompt owner | absent | runtime supports binding | active identity immutable | safe reference/fingerprint only | `OWNER_DECISION_REQUIRED` |
| AI-004 | FEAT-022 capability/prompt owner | absent | runtime supports binding | active identity immutable | safe reference/fingerprint only | `OWNER_DECISION_REQUIRED` |
| AI-005 | FEAT-022 capability/prompt owner | absent | runtime supports binding | active identity immutable | safe reference/fingerprint only | `OWNER_DECISION_REQUIRED` |

## 3. Prohibitions

- prompt body in API-017 handler: `0`
- caller-supplied prompt identity as authority: `0`
- raw prompt in final Audit Event: `0`
- unapproved prompt version fallback: `0`

## 4. Disposition

Prompt metadata/version mechanics exist, but the three executable prompt assets/references and their approval evidence do not. Production prompt resolution remains a provider-independent blocker.

`PROMPT_VERSIONING: OWNER_DECISION_REQUIRED`
