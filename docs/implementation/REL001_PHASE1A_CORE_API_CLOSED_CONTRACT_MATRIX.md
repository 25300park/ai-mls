# REL-001 Phase 1A Core API Closed Contract Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-052 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / API Owner / Security Owner |
| Baseline | `eccabb4cb55295815a5ad2e9e78929ec9ecd93e6` |
| Release / environment | `REL-001 / Staging` |
| Parent evidence | [Phase 1 Gap Matrix](../reviews/REL001_PHASE1_CORE_IDENTITY_CORE_API_RUNTIME_GAP_MATRIX.md) |

## 1. Scope and precedence

이 문서는 frozen Book 6의 logical operations를 변경하지 않고 `API-001~010`의 transport canonicalization 후보를 닫는다. Book 6 operation이 current Domain/Application contract로 정확히 표현되지 않으면 `NOT_TRANSPORT_READY`로 유지한다. In-process method 존재는 route 생성 권한이 아니다.

## 2. Shared closed transport profile

| Concern | Closed rule |
|---|---|
| Media type | `application/json; charset=utf-8` only; body가 없는 query는 body 금지 |
| Version | frozen logical path의 `{major}`는 implementation 전 별도 explicit configuration으로 공급한다. 값이 없으면 bind 금지 |
| Authentication | protected operation은 `x-session-id` header 하나만 Session locator로 사용한다. body/query의 actor, role, capability, MFA, tenant authority는 거부한다 |
| Correlation | `x-correlation-id` required non-empty string; `x-request-id` optional non-empty string |
| Idempotency | table에서 `REQUIRED`인 command만 `idempotency-key` required; 같은 key/different canonical fingerprint는 `IDEMPOTENCY_CONFLICT` |
| Unknown fields | top-level과 nested object 모두 reject; arrays는 declared item schema만 허용 |
| Bounds | 모든 string/array/page size는 implementation 전 named numeric limit이 승인되어야 한다. 승인값 부재 시 affected operation은 bind 금지 |
| Success envelope | `{ ok: true, data: <operation DTO>, meta: { requestId?: string, correlationId: string } }` |
| Error envelope | `{ ok: false, error: { code: string, message: string }, meta: { requestId?: string, correlationId: string } }`; rejected values, stack, SQL, path, token 미포함 |
| Concealment | tenant/scope/resource visibility 실패는 존재 여부를 드러내지 않는 `NOT_FOUND` 또는 owning API의 canonical concealed code |
| Success status | create `201`; accepted async handoff `202`; read/list/decision/action `200`; response body 없는 성공은 사용하지 않음 |
| Safe status classes | malformed/unknown/bounds `400`; authentication `401`; non-concealed authorization `403`; concealed/missing `404`; version/idempotency/state conflict `409`; unavailable policy/dependency `503`; unhandled `500` with `REQUEST_REJECTED` |

Exact numeric bounds와 initial API major는 canonical source가 없어 implementation gate로 남는다. 이 두 값은 adapter가 임의 선택할 수 없다.

## 3. Schema notation

- `ContextHeaders` = `x-session-id?`, required `x-correlation-id`, optional `x-request-id`, conditional `idempotency-key`.
- `Ref` = `{ entityType: string, entityId: string, version: integer >= 1 }`.
- `PageQuery` = allowlisted filters plus opaque `cursor?` and bounded `limit?`; unknown query parameter reject.
- `SessionView`, aggregate DTO와 history DTO는 current immutable Domain/Application return contract의 declared fields만 reconstruct한다. Runtime object를 그대로 serialize하지 않는다.
- Optional fields are marked `?`; every unmarked field is required.

## 4. API-001~010 operation contract matrix

| API | Canonical operation | C/Q | Method/path | Request schema | Response schema | Auth / tenant-scope / MFA-SoD | Persistence / idempotency / audit | Eligibility |
|---|---|---|---|---|---|---|---|---|
| API-001 | Create Session | C | `POST /v{major}/sessions` | body `{ credentialReference, requestedScope }`; no Session header authority | `SessionView` excluding raw refresh/token material unless protected delivery contract exists | authentication adapter validates evidence; Session is not business authority | Session owner; retry key only after token rotation contract; login audit | `NOT_TRANSPORT_READY` — provider/token delivery open |
| API-001 | Refresh Session | C | `POST /v{major}/sessions/{sessionId}:refresh` | path `sessionId`; protected refresh proof is not yet serializable | successor `SessionView` | current family/replay/revocation policy | Session owner; atomic rotation/replay audit | `NOT_TRANSPORT_READY` — refresh proof/token model open |
| API-001 | Revoke Session | C | `POST /v{major}/sessions/{sessionId}:revoke` | path `sessionId`; body `{ reason }`; current Session header required | revoked `SessionView` | live current actor; exact revoke authority; MFA if current policy requires | Session owner; idempotent terminal revoke; audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-001 | Read Current Principal | Q | `GET /v{major}/me` | no body | safe principal/session expiry, roles and scopes from current Session | active current Session; self only | Session owner read; audited where policy requires | `CONTRACT_READY_PENDING_BOUNDS` |
| API-002 | Evaluate Capability | Q | `POST /v{major}/authorization-decisions` | body `{ action, resource: { type,id,tenantId?,version?,teamId?,classification?,privacyScope?,purpose?,consentOrLegalBasis?,audienceRestriction? }, purpose, reason? }` | `{ effect, reasonCode, policyVersion, obligations, assignmentIds, expiresAt? }` | current Session; requested tenant/scope cannot override Session; MFA/SoD evaluated by `AuthorizationService` | no business mutation; current assignment/policy readers; decision audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-003 | List Sources | Q | `GET /v{major}/sources` | `PageQuery` with approved source filters only | immutable masked source collection | current Session; source.read; tenant/scope/purpose | Source owner read; read-safe; audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-003 | Read Source | Q | `GET /v{major}/sources/{sourceId}` | path only | immutable source projection | same as list plus concealment | Source owner read | `CONTRACT_READY_PENDING_BOUNDS` |
| API-003 | Register Source Proposal | C | `POST /v{major}/sources` | body `{ name,sourceType,allowedMethods[],allowedPurposes[],classification,reason }` | immutable non-authoritative source proposal | current Session; source.propose; no policy activation authority | Source proposal owner; idempotency key required; proposal audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-004 | Create Intake | C | `POST /v{major}/intakes` | body `{ sourceId,sourcePolicyVersion,method,purpose,evidenceReference,observedAt,capturedAt,fingerprint,language,classification,retentionClass }` | immutable Intake DRAFT | current Session; intake.create; exact source/tenant/scope | Intake owner; key required; create audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-004 | Attach Evidence Reference | C | `POST /v{major}/intakes/{intakeId}/evidence` | body `{ expectedVersion,evidenceReference,fingerprint,classification,retentionClass,safetyState }` | successor Intake | current Session; exact Intake scope/version | Intake owner; key required; evidence append audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-004 | Validate Intake | C | `POST /v{major}/intakes/{intakeId}:validate` | body `{ expectedVersion,safetyState,metadataComplete }` | validated/failed/quarantined Intake | current Session; intake.validate; live source policy | Intake owner; key required; decision audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-004 | Request AI Processing | C | `POST /v{major}/intakes/{intakeId}:request-ai` | body `{ expectedVersion,deadline }`; key header required | existing accepted job reference only | current Session; intake.request-ai; exact validated input | Intake/API-017 owning handoff; key required; request audit | `CONTRACT_READY_PENDING_API017` |
| API-004 | Submit Intake Review | C | `POST /v{major}/intakes/{intakeId}:review` | body `{ expectedVersion,decision,reason }` using current enum | successor Intake/review disposition | current Session; reviewer authority; MFA/SoD where current policy requires | Intake owner; key required; review audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-004 | Read Intake | Q | `GET /v{major}/intakes/{intakeId}` | path only | masked Intake/evidence/status projection | current Session; exact tenant/scope/purpose | Intake owner read; access audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-005 | Search Property Master | Q | `GET /v{major}/properties` | allowlisted `query`, cursor/limit pending approved bounds | immutable Property projection collection | current Session; property.read; scoped purpose | Property owner read; restricted-search audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-005 | Read Property Hierarchy | Q | `GET /v{major}/properties/{propertyId}` | path only | immutable Property hierarchy projection | current Session; property.read; concealment | Property owner read | `CONTRACT_READY_PENDING_BOUNDS` |
| API-005 | Propose Master Correction | C | `POST /v{major}/properties/{propertyId}/correction-proposals` | canonical correction delta/evidence schema absent | correction proposal | Property Data Steward; expected version/reason/evidence | Property owner; key/audit required | `NOT_TRANSPORT_READY` |
| API-006 | List Candidates | Q | `GET /v{major}/candidates` | approved `propertyId?`, cursor/limit | masked candidate collection | current Session; listing.read; tenant/team/purpose | Listing owner read | `CONTRACT_READY_PENDING_BOUNDS` |
| API-006 | Read Candidate | Q | `GET /v{major}/candidates/{candidateId}` | path only | immutable Candidate view | same plus concealment | Listing owner read | `CONTRACT_READY_PENDING_BOUNDS` |
| API-006 | Create Candidate | C | `POST /v{major}/candidates` | body `{ propertyRef?,sourceRefs[],intakeRef,aiResultRef?,unresolvedFields[] }` | Candidate view | current Session; listing create; provenance | Listing owner; key required; audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-006 | Revise Candidate | C | `POST /v{major}/candidates/{candidateId}/revisions` | body `{ expectedVersion,status,propertyRef?,unresolvedFields[],reason }` | successor Candidate | live owner/reviewer; version/SoD current rules | Listing owner; key required; append history/audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-006 | Create Offer | C | `POST /v{major}/offers` | body `{ candidateId,expectedCandidateVersion,transactionType,terms,sourceRefs[] }` | Offer view | current Session; listing owner; candidate scope | Listing owner; key required; audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-006 | Revise Offer | C | `POST /v{major}/offers/{offerId}/revisions` | body `{ expectedVersion,status,terms,reason }` | successor Offer | live owner; version/purpose | Listing owner; key required; append history/audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-006 | Request Duplicate Review | C | `POST /v{major}/duplicate-reviews` | body `{ subjectRefs[],aiResultRef,relationship,recommendation,signals[],contradictions[],confidence }` | Duplicate Group review view | current Session; advisory input is not decision authority | Listing owner; key required; audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-006 | Decide Duplicate | C | `POST /v{major}/duplicate-reviews/{groupId}:decide` | body `{ expectedVersion,decision,reason }` | decided Duplicate Group | authorized human reviewer; evidence/version/SoD | Listing owner; key required; append evidence/audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-007 | Search Contacts | Q | `GET /v{major}/contacts` | canonical allowlisted filter and result bound absent | masked contact collection | purpose-bound privacy authority | Contact owner; searched-field audit | `NOT_TRANSPORT_READY` |
| API-007 | Read Contact | Q | `GET /v{major}/contacts/{contactId}` | path plus required purpose context | masked Contact view only | current Session; assignment/purpose/consent; concealment | Contact owner; read audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-007 | Create Contact | C | `POST /v{major}/contacts` | body `{ displayLabel,teamId,consentRefs[],purpose }` | masked Contact view | current Session; purpose/tenant/team | Contact owner; key required; audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-007 | Correct Contact | C | `POST /v{major}/contacts/{contactId}/corrections` | body `{ expectedVersion,displayLabel,reason,purpose }` | successor masked Contact | current Session; privacy authority/version | Contact owner; key required; append history/audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-007 | Add Channel | C | `POST /v{major}/contacts/{contactId}/channels` | body `{ expectedContactVersion,channelType,value,useScope,purpose }` | masked Channel view; raw value never returned | live purpose/consent authority | Contact owner; key required; protected write/audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-007 | Revoke Channel | C | `POST /v{major}/contacts/{contactId}/channels/{channelId}:revoke` | body `{ expectedVersion,reason,purpose }` | masked revoked Channel | live purpose/privacy authority | Contact owner; key required; audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-007 | Record Contact Attempt | C | `POST /v{major}/contact-cases/{caseId}/attempts` | path existing `caseId`; body `{ expectedVersion,direction,outcome,evidenceRef,purpose }`; implicit creation prohibited | case + immutable Communication evidence | current Session; exact Case tenant/scope, purpose/channel/DNC; conceal mismatch | Contact Case owner; key required; append communication/audit | `NOT_TRANSPORT_READY` — no canonical Case create path |
| API-007 | Set Do-Not-Contact | C | `POST /v{major}/contact-cases/{caseId}:do-not-contact` | path existing `caseId`; body `{ expectedVersion,reason,purpose }`; implicit creation prohibited | successor Contact Case | current Session; exact Case tenant/scope and existing privacy authority | Contact Case owner; key required; audit | `NOT_TRANSPORT_READY` — no canonical Case create path |
| API-008 | Create Client | C | `POST /v{major}/clients` | body `{ teamId,assignedAgentId,contactRef,consentRefs[],purpose }` | Client view | current Session; assigned scope/consent | Client owner; key required; audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-008 | Read Client | Q | `GET /v{major}/clients/{clientId}` | path plus purpose | Client view | current Session; tenant/team/assignment; concealment | Client owner read/audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-009 | Create Requirement | C | `POST /v{major}/clients/{clientId}/requirements` | body `{ expectedClientVersion,originalSourceRef,intent,constraints[],budget?,locations[],validationGaps[],purpose }` | Requirement DRAFT view | current Session; assignment/consent | Requirement owner; key required; audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-009 | Revise Requirement | C | `POST /v{major}/requirements/{requirementId}/revisions` | body `{ expectedVersion,reason,material,intent,constraints[],budget?,locations[],validationGaps[],purpose }` | successor Requirement | current Session; assignment/version | Requirement owner; key required; append history/audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-009 | Transition Requirement | C | `POST /v{major}/requirements/{requirementId}:transition` | body `{ expectedVersion,targetStatus,reason,purpose }` | successor Requirement | live assignment; reviewer/MFA/SoD when current policy requires | Requirement owner; key required; audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-009 | Read History | Q | `GET /v{major}/requirements/{requirementId}/history` | path plus purpose | immutable Requirement revisions | current Session; assignment/scope; concealment | Requirement owner read/audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-009 | Request Requirement Parsing | C | `POST /v{major}/requirements/{requirementId}:request-ai-parse` | exact API-017 job request/result binding absent | accepted job reference | current Session; approved input data class | Requirement/API-017 handoff; key/audit required | `NOT_TRANSPORT_READY` |
| API-010 | Request Match | C | `POST /v{major}/match-runs` | canonical background-job request does not match synchronous snapshot execution | accepted Match job/run reference | current Session; active Requirement and live admission | Matching/API-017 owner; key required; audit | `NOT_TRANSPORT_READY` |
| API-010 | Read Match Run | Q | `GET /v{major}/match-runs/{runId}` | path plus purpose | safe run status/input-version summary; no restricted nested result leakage | current Session; exact team/purpose; concealment | Matching owner read | `CONTRACT_READY_PENDING_BOUNDS` |
| API-010 | List Results | Q | `GET /v{major}/match-runs/{runId}/results` | path plus bounded cursor/limit | ranked masked Match Result collection | current Session; matching.read; privacy scope | Matching owner read | `CONTRACT_READY_PENDING_BOUNDS` |
| API-010 | Review Result | C | `POST /v{major}/match-results/{resultId}:review` | body `{ expectedVersion,decision,reason,purpose }` | successor Match Result | current Session; assigned reviewer; override SoD/MFA as current policy | Matching owner; key required; append review/audit | `CONTRACT_READY_PENDING_BOUNDS` |
| API-010 | Mark Stale | C | `POST /v{major}/match-results/{resultId}:mark-stale` | body `{ expectedVersion,reason,purpose }` | stale Match Result; no implicit recompute | current Session or approved internal causal boundary; no worker authority | Matching owner; key required; history/audit | `CONTRACT_READY_PENDING_BOUNDS` |

## 5. Mapping-only contract candidate summary

| Classification | Count |
|---|---:|
| Logical operations inventoried | `45` |
| Contract candidates aligned to current operation | `37` |
| Mapping-level `NOT_TRANSPORT_READY` | `8` |
| Staging transport-ready before Phase 1B prerequisite evaluation | `0` |

The 37 candidates still require approved numeric bounds, initial major version, Staging Session creation/resolution and durable owning persistence. Therefore none may be bound in Production yet.

## 5.1 Phase 1B version and bounds closure

| Decision area | Repository evidence | Disposition |
|---|---|---|
| API identity | `API-001~010` identities are permanent | unchanged |
| API major | frozen routes use `{major}` but no exact numeric initial major is registered | no `/v2` or invented value; every route remains unbound until an existing canonical major is identified |
| Pagination/list bounds | no authoritative Core page size, cursor length or list limit found | list/search transport remains not ready where an explicit defensive bound is required |
| Match cohort | current validated invariant rejects an eligible cohort greater than `100` | `100` may be reused for Match execution input only; it does not establish page size |
| Strings/arrays/bodies | no complete authoritative transport bounds | no inferred or convenience limits |

Phase 1B reclassification counts the complete Staging execution prerequisites, not only method/route mapping:

| Classification | Count |
|---|---:|
| Total logical operations | `45` |
| `TRANSPORT_READY` | `0` |
| `NOT_TRANSPORT_READY` | `45` |

The causes are unresolved trusted Session materialization, domain durability implementation, exact API major/numeric bounds, and absence of a canonical Contact Case creation path. API-007 mutation meaning is now singular, but the two Case-dependent routes remain unavailable. This does not remove the `37/45` mapping candidates; it prevents them from being exposed prematurely.

## 6. Prohibited exposure

Current non-canonical helpers such as direct Property activation/retirement, Contact case opening/history/raw channel reveal, Requirement advisory-result validation and synchronous Match snapshot execution are not public routes. They remain internal until a frozen/approved operation explicitly owns them.
