# REL-001 Phase 4D.3 FEAT-022 Provider Selection / Activation Decision Packet

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-209 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / AI Operations Owner / Security Owner / Privacy Owner |
| 기준일 | 2026-09-15 |
| Decision | `DEC-162` (`IN REVIEW`) |

## 1. 목적과 증거 경계

이 문서는 `AI-001`, `AI-004`, `AI-005`의 Staging provider activation에 필요한 일곱 owner decision을 위한 decision-support packet이다. Provider를 선택하거나 network authority를 부여하지 않는다.

이번 Brief의 `NETWORK CALLS: 0` 제약에 따라 외부 provider 문서, 가격표, privacy/retention terms 및 endpoint 문서를 조회하지 않았다. Repository canonical evidence에는 named commercial provider가 없으므로 최신 외부 정책이라고 주장할 수 있는 provider-specific fact는 `0`이다. 외부 근거가 필요한 항목은 `UNKNOWN / BLOCKING`으로 표시한다.

## 2. Capability requirements

| Capability | Canonical purpose | Canonical input / exposure boundary | Canonical output | Structured output | Context size | Latency sensitivity | Human review | Required model features |
|---|---|---|---|---|---|---|---|---|
| `AI-001` | approved Raw Source evidence를 structured candidate proposal로 변환 | Raw Source ref/version, minimum approved content projection, source context, optional approved Property/Location candidates; credentials, unrestricted Contact details 및 unrelated Client data 제외 | `urn:ai-mls:schema:listing-parser-output:v0.1` | strict schema, unknown field rejection, evidence/confidence binding | exact bound `UNDEFINED` | exact SLO `UNDEFINED` | `REQUIRED`; verified fact/permission/Property/Publication authority `0` | schema-constrained generation, multilingual/local-name handling, evidence-grounded field extraction, ambiguity preservation |
| `AI-004` | approved natural-language client input을 structured Requirement proposal로 변환 | original requirement text/ref/language, authorized Client/Requirement ref, approved vocabularies, minimum purpose-selected conversation context; unrelated contact history, sensitive notes 및 full archive 제외 | `urn:ai-mls:schema:requirement-parser-output:v0.1` | strict schema, exact enums, confidence and clarification structure | exact bound `UNDEFINED` | exact SLO `UNDEFINED` | `REQUIRED`; active Requirement revision/consent authority `0` | schema-constrained generation, negation and hard/soft distinction, multilingual parsing, privacy-aware extraction |
| `AI-005` | one Requirement revision과 eligible Candidate/Offer cohort를 advisory match/rank | authorized exact revisions and approved cohort projection only; protected/sensitive attributes and unrestricted contact/client data excluded | `urn:ai-mls:schema:matching-result:v0.1` | strict schema, factor/hard-constraint/rank/explanation consistency | cohort/input bound `UNDEFINED` | exact SLO `UNDEFINED` | `REQUIRED`; audience eligibility and sharing permission remain authoritative application policy | schema-constrained generation, grounded factor explanation, deterministic reference binding, no protected-attribute reasoning |

Runtime classification은 trusted snapshot의 most-restrictive classification을 보존한다. Capability별 고정 data classification이나 exact token/context bound는 canonical repository에 없다. Provider selection 전에 field-level projection, maximum input size 및 capability evaluation cohort가 별도 승인되어야 한다.

## 3. Provider option evidence assessment

Book 4 abstraction은 `structured generation`, optional embeddings/similarity, optional reranking이라는 capability class만 지원하고 named vendor를 승인하지 않는다. 현재 adapter는 provider-neutral `providerRef`, `modelRef`, `timeoutMs`, credential reference 및 strict canonical validator를 수용하므로 vendor-specific SDK 없이 HTTP executor로 연결할 구조적 여지는 있다. 그러나 이는 provider compatibility 또는 policy approval의 증거가 아니다.

| Candidate class | Suitable model(s) | Structured output | Current abstraction compatibility | Credential | Exact destination/region | Retention/training/logging/deletion | Pricing basis | Disposition |
|---|---|---|---|---|---|---|---|---|
| Managed structured-generation API | named model evidence 없음 | required capability; provider-specific proof 없음 | structurally plausible; concrete adapter/evaluation 없음 | provider-scoped API credential expected | `UNKNOWN / BLOCKING` | `UNKNOWN / BLOCKING` | `UNKNOWN / BLOCKING` | NOT EVALUABLE |
| Regional cloud model platform | named model evidence 없음 | required capability; provider-specific proof 없음 | structurally plausible; region and endpoint contract 없음 | platform-scoped credential expected | `UNKNOWN / BLOCKING` | `UNKNOWN / BLOCKING` | `UNKNOWN / BLOCKING` | NOT EVALUABLE |
| Self-hosted model runtime | approved model/runtime 없음 | unproven | new runtime/infrastructure would exceed this Brief | new credential/runtime model required | repository-local or private endpoint not defined | operational/privacy controls undefined | infrastructure basis undefined | REJECTED FOR PHASE 4D.3 |

### Recommendation disposition

- `PRIMARY_RECOMMENDATION`: `NONE — EVIDENCE REQUIRED`.
- `ALTERNATIVE`: `NONE — EVIDENCE REQUIRED`.
- `REJECTED_OPTIONS`: any named provider/model selected without current capability, endpoint, privacy/retention and pricing evidence; self-hosted/new-infrastructure activation in this phase.

No named candidate can satisfy the Book 4 evaluation dimensions under the approved zero-network evidence boundary. AO provider selection must therefore remain open.

## 4. Model and timeout proposal

| Capability | Provider/model proposal | Shared model disposition | Timeout proposal | Classification |
|---|---|---|---:|---|
| `AI-001` | `UNSELECTED / UNSELECTED` | one shared structured-output model may be evaluated first, but sufficiency is unproven | 30,000 ms | `PROPOSED_OWNER_VALUE` |
| `AI-004` | `UNSELECTED / UNSELECTED` | same evaluation hypothesis; privacy/language quality must be proven independently | 30,000 ms | `PROPOSED_OWNER_VALUE` |
| `AI-005` | `UNSELECTED / UNSELECTED` | separate model is not justified without comparative evidence; cohort-size risk requires independent evaluation | 45,000 ms | `PROPOSED_OWNER_VALUE` |

Timeouts are conservative first-validation proposals, not repository-derived facts or hidden defaults. They become usable only with exact provider/model selection, provider timeout behavior evidence and explicit AO approval.

## 5. Credential reference proposal

| Capability | Existing config key | Proposed secret identifier pattern | Authorized consumer | Status |
|---|---|---|---|---|
| `AI-001` | `feat022.providers.<providerRef>.credentialRef` | `FEAT022_STAGING_<APPROVED_PROVIDER>_API_KEY` | selected provider adapter only | provider token unresolved |
| `AI-004` | same | same provider-scoped identifier when the same provider is approved; otherwise an exact provider-specific identifier | selected provider adapter only | provider token unresolved |
| `AI-005` | same | same rule | selected provider adapter only | provider token unresolved |

These are identifier patterns only. Secret values, vault paths and credentials are absent. API-017, handlers, application ports, prompts, telemetry and audit visibility remain `0`.

## 6. Prompt asset gap and proposed identity contract

| Capability | Status | Proposed repository path | Proposed prompt ID/version | Allowed variables | Output schema |
|---|---|---|---|---|---|
| `AI-001` | `AUTHORING_REQUIRED` | `modules/ai/prompts/ai-001/v1.0/prompt.md` | `PRM-AI-001-001` / `v1.0` | only approved AI-001 projection fields in section 7 | listing-parser v0.1 |
| `AI-004` | `AUTHORING_REQUIRED` | `modules/ai/prompts/ai-004/v1.0/prompt.md` | `PRM-AI-004-001` / `v1.0` | only approved AI-004 projection fields in section 7 | requirement-parser v0.1 |
| `AI-005` | `AUTHORING_REQUIRED` | `modules/ai/prompts/ai-005/v1.0/prompt.md` | `PRM-AI-005-001` / `v1.0` | only approved AI-005 projection fields in section 7 | matching-result v0.1 |

Paths and IDs are `PROPOSED_OWNER_VALUES`. No prompt content or file is created. Each asset requires owner, checksum, immutable version, provider/model compatibility, evaluation evidence and rollback/change control. Raw prompt content must not enter telemetry or API-016 evidence.

## 7. Proposed outbound field allowlist

Anything not listed below is `DENIED`. This table is a proposal and does not activate external transmission.

### AI-001

| Field | Canonical source | Purpose | Sensitivity | PII | Required |
|---|---|---|---|---|---|
| `inputReference` | approved Raw Source ref/version | bind output to exact input | INTERNAL reference metadata | NO unless source identifier itself is identifying; then tokenize | YES |
| `approvedContentProjection.text` | policy-approved Raw Source content projection | listing field extraction | runtime source classification; may include personal/property data | POSSIBLE; unnecessary contact data must be redacted | YES |
| `sourceContext.sourceType` | approved Source context | parsing context | INTERNAL | NO | YES |
| `sourceContext.language` | observed Source context | language handling | INTERNAL | NO | OPTIONAL |
| `sourceContext.observedAt` | Source chronology | temporal interpretation | INTERNAL | NO | OPTIONAL |
| `sourceContext.allowedUse` | approved purpose/policy projection | enforce intended use | INTERNAL | NO | YES |
| `existingContext[]` | approved Property/Location candidate projection | normalize ambiguous references | CONFIDENTIAL_BUSINESS at most unless stricter source classification applies | NO; contact fields prohibited | OPTIONAL |

### AI-004

| Field | Canonical source | Purpose | Sensitivity | PII | Required |
|---|---|---|---|---|---|
| `inputReference` | authorized Requirement input ref/version | bind output to exact input | INTERNAL reference metadata | tokenize if identifying | YES |
| `originalRequirementText` | approved client Requirement text projection | requirement parsing | `RESTRICTED_PERSONAL` when personal context is present; otherwise trusted source classification | YES/POSSIBLE | YES |
| `language` | approved input metadata | language handling | INTERNAL | NO | OPTIONAL |
| `locationVocabulary[]` | approved vocabulary projection | canonical candidate suggestion | INTERNAL | NO | OPTIONAL |
| `propertyTypeVocabulary[]` | approved vocabulary projection | controlled type interpretation | INTERNAL | NO | OPTIONAL |
| `minimumConversationContext[]` | explicitly purpose-selected excerpts | resolve local ambiguity only | source classification, potentially `RESTRICTED_PERSONAL` | YES/POSSIBLE | OPTIONAL |

Client identity, contact channels, unrelated history, sensitive notes and full conversation archives are denied.

### AI-005

| Field | Canonical source | Purpose | Sensitivity | PII | Required |
|---|---|---|---|---|---|
| `requirementProjection` | exact authorized Requirement revision | match factors and hard constraints | CONFIDENTIAL_BUSINESS / possible RESTRICTED_PERSONAL | POSSIBLE; identity/contact fields denied | YES |
| `candidateProjection[]` | eligible exact Candidate/Offer revisions | compare approved property/offer factors | CONFIDENTIAL_BUSINESS | NO unless source contains personal data; such fields denied | YES |
| `cohortReference` | authorized cohort/run identity | bind rank semantics | INTERNAL reference metadata | NO | YES |
| `matchingPolicyVersion` | approved matching policy/config | factor/weight interpretation | INTERNAL | NO | YES |
| `evidenceReferences[]` | safe minimized evidence refs | explanation grounding | INTERNAL reference metadata | NO raw evidence body | OPTIONAL |

Protected/sensitive attributes and proxies, client/contact identity, permission decisions, unrestricted rows and raw evidence bodies are denied.

## 8. Network destination and provider terms

| Required evidence | Current result | Blocking reason |
|---|---|---|
| exact provider | `UNKNOWN / BLOCKING` | named provider not approved |
| exact HTTPS domain | `UNKNOWN / BLOCKING` | provider unselected; wildcard prohibited |
| endpoint/API class and method | `UNKNOWN / BLOCKING` | provider contract absent |
| region/data residency | `UNKNOWN / BLOCKING` | current provider evidence absent |
| API input/output retention | `UNKNOWN / BLOCKING` | no evidence-backed current terms |
| training/model improvement use | `UNKNOWN / BLOCKING` | no evidence-backed current terms |
| abuse/security logging and storage | `UNKNOWN / BLOCKING` | no evidence-backed current terms |
| enterprise/API controls | `UNKNOWN / BLOCKING` | no evidence-backed current terms |
| deletion/control options | `UNKNOWN / BLOCKING` | no evidence-backed current terms |
| pricing basis | `UNKNOWN / BLOCKING` | no current pricing evidence |

External network authorization cannot be requested until these values are evidence-backed and AO-approved.

## 9. First live validation limit proposal

| Capability | Proposed maximum | Retry | Fallback | Load/batch |
|---|---:|---:|---:|---:|
| `AI-001` | 2 calls | 0 | 0 | 0 |
| `AI-004` | 2 calls | 0 | 0 | 0 |
| `AI-005` | 2 calls | 0 | 0 | 0 |
| **Total** | **6 calls** | **0** | **0** | **0** |

Exact counts are `PROPOSED_OWNER_VALUES`. Pricing unit, token ceiling, currency/cost ceiling, account/project boundary and stop owner remain `UNKNOWN / BLOCKING` until a provider is selected. Current authorized maximum remains `0` calls.

## 10. Final owner decision table

| Decision | Recommended value | Evidence | AO approval required |
|---|---|---|---|
| 1. Provider | no selection; obtain evidence for a managed structured-generation provider first | Book 4 allows capability class only; named providers `0` | YES |
| 2. Model(s) | no named model; evaluate one shared structured-output model first, then split only with comparative evidence | three capabilities share strict structured-output boundary; equivalence unproven | YES |
| 3. Timeout(s) | AI-001 30,000 ms; AI-004 30,000 ms; AI-005 45,000 ms (`PROPOSED_OWNER_VALUES`) | bounded first-validation proposal; no provider latency evidence | YES |
| 4. Credential references | `FEAT022_STAGING_<APPROVED_PROVIDER>_API_KEY`, resolved only by provider adapter | DEC-156 credential containment; provider token unresolved | YES |
| 5. Prompt assets | author three versioned assets at proposed section 6 paths; content/checksum/evaluation required | physical assets currently `0/3` | YES |
| 6. Outbound projection | approve or revise section 7 field rows; everything else denied | capability docs define required concepts but current approved provider-bound fields are `0/3` | YES |
| 7. Destination / retention / billing/request limit | domain/endpoint/region/terms/pricing remain blocking; propose 2/2/2 calls, total 6 after closure | provider-specific current evidence unavailable; calls currently 0 | YES |

## 11. Disposition

Final Recommendation:

`INSUFFICIENT_EVIDENCE_FOR_PROVIDER_SELECTION`

The packet is ready for AO review, but provider/model, destination, current provider terms, pricing, exact credential reference and physical prompt assets cannot be approved from repository evidence alone. `DEC-162` remains `IN REVIEW`; network activation readiness remains `0/3 NOT_READY`.

- Production changes: `0`
- Network calls: `0`
- Credential use: `0`
- Provider execution: `0`
- Commit: `NOT_AUTHORIZED`
