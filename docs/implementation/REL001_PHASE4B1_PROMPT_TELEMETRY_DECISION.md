# REL-001 Phase 4B.1 Prompt / Telemetry Decision

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-189 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | AI Reviewer / Capability Owner / Security Owner |
| 기준일 | 2026-09-15 |
| Decision | `DEC-156` (`APPROVED`) |

## 1. Prompt ownership and versioning

FEAT-022 capability/application layer owns versioned canonical prompt assets/templates. Each execution binds existing `promptId`, `promptVersion`, `promptFingerprint`, capability ID and schema/capability version through the durable advisory execution fingerprint.

| Capability | Prompt reference key | Canonical schema binding | Physical status |
|---|---|---|---|
| AI-001 | `feat022.capabilities.AI-001.promptAssetRef` | `urn:ai-mls:schema:listing-parser-output:v0.1` | IMPLEMENTATION_GAP |
| AI-004 | `feat022.capabilities.AI-004.promptAssetRef` | `urn:ai-mls:schema:requirement-parser-output:v0.1` | IMPLEMENTATION_GAP |
| AI-005 | `feat022.capabilities.AI-005.promptAssetRef` | `urn:ai-mls:schema:matching-result:v0.1` | IMPLEMENTATION_GAP |

Prompt changes require a controlled version change and new fingerprint. Handlers contain no prompt text; provider adapters translate approved runtime intent but do not own business prompt semantics. Raw prompt content does not enter API-016 evidence.

## 2. Telemetry allowlist

Allowed bounded observational metadata:

- capability ID/version;
- provider/model reference;
- execution correlation ID;
- latency;
- bounded token/usage counts when supplied;
- normalized success/failure classification;
- safe evidence reference.

Forbidden: credentials, authorization headers, raw provider response, raw prompt, chain-of-thought, secret-bearing bodies and unbounded PII. Telemetry has business authority `0`.

## 3. Output path

`provider response → FEAT-022 safe parser/strict validator → canonical schema → immutable advisory result`. Invalid output fails closed. API-017 receives no raw or unvalidated provider output.

## 4. Closure

Prompt ownership: `3/3 CLOSED`. Telemetry contract: `CLOSED`. Missing physical prompt assets are implementation gaps, not semantic ambiguity.
