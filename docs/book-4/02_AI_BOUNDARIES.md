# AI Boundaries

| 항목 | 값 |
|---|---|
| Document ID | DOC-AI-003 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | AI Reviewer / Security Reviewer |
| 기준일 | 2026-07-14 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Allowed AI actions

- approved Raw Source/Requirement references에서 purpose-limited structured draft 생성
- existing canonical candidates에 대한 alias/property/location match suggestion
- duplicate similarity, match/rank, explanation and uncertainty suggestion
- natural-language search intent/filter interpretation within read-only query scope
- invalid/missing/ambiguous/conflicting content flagging
- human review를 위한 alternatives and evidence-aligned explanation 생성

Allowed action도 authorization, input minimization, provider policy, validation, audit와 retention을 통과해야 한다.

## Prohibited AI actions

| Prohibited action | Required enforcement |
|---|---|
| Verification decision or verifier impersonation | AI/service principal cannot satisfy verifier role; output schema has no approval field |
| Permission grant/revoke | Permission command requires authorized human/grantor evidence |
| Publication approval/delivery initiation | valid human approval and application command required; AI identity denied |
| Authoritative Property/Unit/Candidate/Offer mutation | AI Result stored separately; application/human correction creates revision |
| Contact unmask/disclosure/export | authorization/purpose gate outside AI; unnecessary contact excluded/redacted |
| Role/authorization/policy change | deterministic administration workflow only |
| Retention deletion/legal hold decision | approved policy/owner only; AI may classify as non-authoritative suggestion only if later approved |
| Source account control or autonomous scraping | connector boundary and source approval required; Phase 5 excludes it |
| Hidden tool/action execution | capability allowlist, explicit intent and audit; no autonomous agent action in current scope |

## Human approval boundary

Human review is mandatory when output can influence canonical master, duplicate merge/split, hard requirement, external shortlist, verification workflow, permission, publication, restricted data, low/unknown confidence or policy/security exception. Review must show source/input version, output, confidence/limitations, validation findings and correction controls.

## Authority boundary

- AI Job has orchestration authority only.
- AI Result has `ADVISORY` authority only.
- deterministic validators may reject output but do not grant business approval.
- authorized application module owns business transition; human authority is checked at action time.
- persisted AI Result never changes authority because it was reviewed; the separate human decision/revision carries authority.

## Trust boundary

| Flow | Threat assumptions | Controls |
|---|---|---|
| Raw/user input → AI orchestration | injection, secrets, personal data, malformed/oversized content | allowlist purpose, type/size, minimization/redaction, instruction/data separation |
| Core → Provider | over-disclosure, retention/training, region, vendor compromise | approved data class, provider contract/settings, encryption, scoped credential |
| Provider → Core | hallucination, malformed schema, prompt injection following, unsafe content | strict parsing, schema/semantic validation, confidence, rejection/quarantine |
| AI Result → Human | automation bias, misleading confidence/explanation | advisory label, evidence, alternatives, uncertainty, independent correction |
| AI Result → Application | direct authority escalation, replay, stale input | capability-specific command mapping, input-version check, authorization, idempotency/audit |

## Examples

| Scenario | Allowed | Not allowed |
|---|---|---|
| Parser detects price and unit | propose values with source spans and confidence | mark listing verified/available |
| Normalizer finds likely tower alias | present candidates and ambiguity | create/merge canonical Tower automatically |
| Duplicate model scores two offers | recommend same unit/different offer with reasons | delete one source/offer or finalize merge |
| Requirement parser sees “near BGC” | propose location intent and ask clarification | fabricate exact radius/hard constraint |
| Ranker returns top candidates | explain factors within eligible cohort | include unverified item in client-facing output |
| Search interpreter receives “show owner contacts” | return authorization-required/unsupported interpretation | unmask or retrieve restricted contact without policy |

## Fail-closed rules

Unknown capability, stale input, schema mismatch, missing confidence where required, policy violation, unauthorized data class or audit correlation failure blocks automated use and routes to safe manual handling.

