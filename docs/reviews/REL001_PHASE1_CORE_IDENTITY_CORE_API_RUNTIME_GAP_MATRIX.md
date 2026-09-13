# REL-001 Phase 1 Core Identity / Core API Runtime Gap Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-160 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Security Owner / Development Owner |
| Baseline | `eccabb4cb55295815a5ad2e9e78929ec9ecd93e6` |
| Release / environment | `REL-001 / Staging` |
| Parent design | [REL-001 Phase 0 Topology](../implementation/REL001_PHASE0_STAGING_RUNTIME_TOPOLOGY_DESIGN.md) |
| 성격 | Production 변경 전 implementation gap inventory |

## 1. Objective

`API-001~010`을 승인된 `Staging Platform Host`에 연결할 수 있는지 canonical contract, current application façade, authorization, persistence와 transport evidence로 검증한다. `RUNTIME WIRING != NEW API SEMANTICS` 원칙에 따라 exact transport contract가 없는 operation은 노출하지 않는다.

## 2. Canonical evidence

- [API Registry](../00_API_REGISTRY.md) 26~35행은 `API-001~010`의 capability, owner, version/idempotency와 test mapping을 등록한다.
- [Authentication API](../book-6/02_AUTHENTICATION_API.md) 15~56행, [Source and Intake API](../book-6/03_SOURCE_AND_INTAKE_API.md) 15~53행, [Property and Listing API](../book-6/04_PROPERTY_AND_LISTING_API.md) 15~54행, [Contact API](../book-6/05_CONTACT_API.md) 15~51행, [Client and Requirement API](../book-6/06_CLIENT_AND_REQUIREMENT_API.md) 15~51행, [Matching API](../book-6/07_MATCHING_API.md) 15~51행은 logical operation/method/resource와 narrative request/response rules를 정의한다.
- [API Principles](../book-6/01_API_PRINCIPLES.md) 13행은 구체 serialization schema와 framework를 범위 밖으로 명시한다. 18~24행은 logical HTTP convention만, 26~35행은 logical field/rule만 제공한다.
- [API Error Standard](../book-6/14_API_ERROR_STANDARD.md) 20~34행의 response는 documentation-only logical shape이며 JSON Schema/OpenAPI가 아니다. Stable error-to-HTTP status mapping도 닫혀 있지 않다.
- [Current composition](../../apps/api/src/composition.ts) 125~218행은 application façade를 in-process로 조립하지만 Core Node HTTP executable/dispatcher/adapter는 없다.
- [REL-001 artifact inventory](../../modules/operations/src/release-candidate-artifact.ts) 87행은 `CORE_APIS_FEAT_001_011`을 `INCOMPLETE_RUNTIME_SURFACE`로 유지한다.

## 3. Cross-cutting findings

| Boundary | Current evidence | Finding |
|---|---|---|
| Executable/server | `apps/api/src`의 production server/composition은 API-014/015/018/019 전용이다. Generic 재사용 가능한 server primitive도 Publication-specific request/response/config type을 사용한다. | Core executable root `ABSENT`; existing compatible Core HTTP host `ABSENT`. |
| Transport schema | Book 6은 logical endpoint와 narrative model만 제공하고 serialization schema를 scope 밖으로 둔다. Core용 exact recursive parser, unknown-field policy, body/query bounds, result DTO와 status map이 없다. | Thin adapter 구현은 새 canonical request/response vocabulary를 결정해야 하므로 pure wiring이 아니다. |
| Trusted Session | [contracts.ts](../../apps/api/src/contracts.ts) 37~87행의 `RequestContext.sessionId`/`requireSessionId()`와 각 façade의 injected `sessionReader`가 body actor를 무시한다. | In-process identity derivation은 재사용 가능하다. HTTP header name/extraction/Session delivery contract는 미정이다. |
| Live authorization | Domain services가 `AuthorizationService.evaluate()`를 호출하고 tenant/team/purpose/version을 전달한다. | Existing rule은 재사용 가능하나 transport가 current Session을 공급해야 한다. |
| MFA/SoD | `AuthorizationService`의 current assignment/obligation logic과 domain-specific checks에 존재한다. | Host가 duplicate policy를 만들면 안 되며 current service path만 호출해야 한다. |
| Persistence | Session, Source, Intake, Property, Listing, Contact, Client/Requirement, Matching state는 process-local `Map/Set`이다. | Restart-safe Staging authority가 없으며 existing Core repository/UoW port도 없다. Durable correction은 새 persistence boundary 결정 없이는 불가하다. |
| Health/readiness | FEAT-023 vocabulary/store는 존재하지만 Core Host composition/readiness projection은 없다. | Wiring은 가능하나 mandatory dependency definition과 component aggregation contract가 필요하다. |
| Telemetry/errors | `executeBoundary()`는 일부 domain errors를 safe generic message로 정규화한다. | HTTP envelope/status, full code registry coverage, SQL/path/stack sanitization integration이 닫혀 있지 않다. |
| Startup/shutdown | `composeApiModulesBeforePublication()`는 object graph만 만든다. | config → persistence → identity → APIs → listener 및 reverse close를 수행하는 lifecycle owner가 없다. |
| Staging config | Phase 0은 ownership/schema identity만 승인했다. | Exact closed fields, defaults, path policy와 listener contract는 아직 구현 contract가 아니다. |

## 4. API-by-API matrix

| API | Canonical owner | Current implementation / composition | Current transport | Exact missing runtime wiring | Identity / authorization | Persistence owner/state | New transport contract required | Pure wiring | AO amendment |
|---|---|---|---|---|---|---|---|---|---|
| API-001 Authentication and Session | FEAT-001/002, Security Owner | `IdentityApi.createSession()` only at [identity-api.ts](../../apps/api/src/identity-api.ts) 38~50; `SessionService` has create/read/refresh/revoke at [session-service.ts](../../modules/identity/src/session-service.ts) 133~241; composed at [composition.ts](../../apps/api/src/composition.ts) 171~174 | none | Refresh, revoke and `/me` application façade; exact header/token delivery, parser, DTO, errors/status; executable registration | Create consumes authentication evidence; protected reads require authoritative Session. Exact protocol/provider/token format is `OPEN DECISION` in frozen Authentication API. | Identity owner, currently `Map/Set` at session-service 120~122 | **YES** | **NO** | **YES** — identity protocol/serialization/durable session boundary |
| API-002 Authorization Decision | FEAT-001/003, Security Owner | `IdentityApi.evaluateAuthorization()` at identity-api 52~74 calls current Session and `AuthorizationService.evaluate()`; composed with API-001 | none | closed request/resource parser, response DTO, status/error mapping and route registration | authoritative `sessionId` → current Session; action/resource/purpose evaluated live | Authorization policy/assignment readers; Session remains process-local | **YES** | **NO** | **YES** — exact serialized resource/action contract and Staging Session ingress |
| API-003 Source Registry Access | FEAT-004, Source Policy Owner | `SourceIntakeApi.listSources/readSource/proposeSource()` at [source-intake-api.ts](../../apps/api/src/source-intake-api.ts) 29~67; composed at composition 181~189 | none | closed query/body schemas, pagination/filter contract, response DTO, HTTP errors/status | injected current Session; Source service authorizes actor/purpose | Source owner, currently `Map` at [source-registry-service.ts](../../modules/source/src/source-registry-service.ts) 89 | **YES** | **NO** | **YES** — transport schema and durable owner |
| API-004 Manual/Source Intake | FEAT-005, Intake Owner | create/attach/read/validate/requestAi/review at source-intake-api 47~115 | none | exact body/evidence bounds, upload/reference serialization, async job response mapping, parser/dispatcher | injected current Session; Intake service validates source/purpose/version and authorization | Intake owner, currently `Map` at [intake-service.ts](../../modules/intake/src/intake-service.ts) 149 | **YES** | **NO** | **YES** — transport schema, durable owner; AI request must not expand API-017 |
| API-005 Property Master Access | FEAT-006, Property Data Steward | propose/decide/alias/search/read at [property-listing-api.ts](../../apps/api/src/property-listing-api.ts) 25~29; composed at composition 190~194 | none | canonical “correction proposal” versus current direct propose/decide mapping must be resolved; exact search filters/cursor/DTO/parser | current Session and domain live authorization | Property owner, currently nodes/aliases `Map` at [property-service.ts](../../modules/property/src/property-service.ts) 19 | **YES** | **NO** | **YES** — operation mapping plus schema/durable boundary |
| API-006 Candidate, Offer and Duplicate | FEAT-007, Listing Data Owner | candidate/offer/duplicate operations at property-listing-api 30~38 | none | exact candidate/offer/duplicate request schemas, offer read semantics if required, list pagination, immutable safe DTO and status map | current Session; domain version, senior-review/SoD and live authorization preserved | Listing owner, currently four `Map` stores at [listing-service.ts](../../modules/listing/src/listing-service.ts) 21 | **YES** | **NO** | **YES** — closed schemas and durable owner |
| API-007 Contact and Communication | FEAT-008, Privacy/Contact Owner | create/correct/channel/case/attempt/DNC/read/history/reveal at [contact-client-api.ts](../../apps/api/src/contact-client-api.ts) 25~34 | none | canonical Search Contacts is absent; current open-case/history/reveal operations need canonical route ownership check; masked/unmasked DTO, field/purpose policy and status map | current Session; service enforces team/purpose/consent/MFA-authorized reveal path | Contact owner, all records/channel values/DNC are process-local maps/sets at [contact-service.ts](../../modules/contact/src/contact-service.ts) 21 | **YES** | **NO** | **YES** — privacy-sensitive transport and durable owner |
| API-008 Client Relationship | FEAT-009, Business Owner/Assigned Agent | create/read at contact-client-api 36~37; composed at composition 195~199 | none | closed body/response DTO, consent reference validation surface, status/error map | current Session; service checks assignment/team/consent and live authorization | Client owner, currently `Map` at [client-requirement-service.ts](../../modules/client/src/client-requirement-service.ts) 23 | **YES** | **NO** | **YES** — schema/durable owner |
| API-009 Requirement Lifecycle | FEAT-010, Assigned Agent/Human Reviewer | create/activate/revise/transition/read/history plus advisory-result validators at contact-client-api 38~45 | none | canonical `request-ai-parse` job handoff absent; current `activateRequirement` and validator methods require route ownership mapping; exact revision/transition DTO/status map | current Session; assignment/team/purpose/version/live authorization in service | Requirement owner, same process-local maps/history at client-requirement-service 23 | **YES** | **NO** | **YES** — operation mapping, durable owner and API-017 boundary |
| API-010 Matching | FEAT-011, Matching Owner | request/read run/read result/history/review/stale/validate at [matching-api.ts](../../apps/api/src/matching-api.ts) 23~29; composed at composition 200~204 | none | canonical list-results and background-job semantics do not exactly match current direct requestMatch; exact cohort/body bounds, safe DTO, status map | current Session; trusted resolver supplies input snapshots; service checks team/purpose/version/live authorization | Matching owner, four process-local maps at [matching-service.ts](../../modules/matching/src/matching-service.ts) 31 | **YES** | **NO** | **YES** — job/operation mapping, schema and durable owner |

## 5. Transport-safe inventory result

| Classification | Count | Result |
|---|---:|---|
| Existing application façade with Session-derived actor | 10/10 API capabilities have at least partial façade coverage | reusable in-process basis only |
| Existing Core HTTP adapter/dispatcher/host | 0 | missing |
| Exact closed serialization/request/response schema | 0/10 | missing by explicit Book 6 scope |
| Fully aligned canonical logical operation set | 0/10 proven complete | API-001/005/007/009/010 have explicit operation gaps or mapping ambiguity |
| Durable Core persistence boundary | 0/8 state-owning groups | missing; all current stores process-local |
| Pure transport wiring eligible now | 0/10 | **FAIL** |

The logical endpoint tables establish intent and route shape, but they do not supply the closed recursive serialization, unknown-field rejection, bounded pagination/body, immutable DTO or stable HTTP status/error mapping required by the Phase 1 Brief. Implementing those choices would create new canonical request/response vocabulary without approval.

## 6. Mandatory stop findings

| Blocker | Triggered Brief stop condition | Evidence | Required AO decision |
|---|---|---|---|
| `REL001-P1-BLOCK-001` | undefined route/request/response semantics | API Principles explicitly excludes concrete serialization; no Core contract/parser exists | Approve exact closed API-001~010 transport contracts operation by operation, including status/error mapping and bounds |
| `REL001-P1-BLOCK-002` | new authentication model / unresolved identity | Authentication API leaves protocol/provider/token format open; no Staging Session ingress contract | Approve a bounded Staging identity/session adapter using existing Session semantics, or limit exposed operations without inventing authentication |
| `REL001-P1-BLOCK-003` | new persistence subsystem | Core authoritative state is process-local and no repository/UoW ports exist | Approve per-domain persistence-port design and durable adapters without centralizing ownership |
| `REL001-P1-BLOCK-004` | new business/job operation risk | API-005/007/009/010 façade and logical operation surfaces are not exact matches | Approve exact existing-operation mapping; exclude any operation that cannot be mapped without new semantics |
| `REL001-P1-BLOCK-005` | executable host contract not established | existing Node server types/envelopes are Publication-specific; no Core runtime registry/readiness contract | Approve bounded generic/platform HTTP host reuse contract without changing API semantics |

## 7. Worker compatibility observation

No Worker transport is added. Existing in-process types that may be evaluated later are:

- trusted Session/Authorization application boundaries in `composeApiModulesBeforePublication()`;
- Intake and Requirement/Matching job-handoff intentions;
- domain-owned service ports expressed as TypeScript `Pick` interfaces.

They are not proven process-safe. They carry live object references and process-local state, and no current Core port is a cross-process contract. A full `REL001_PHASE1_WORKER_PORT_COMPATIBILITY_NOTE.md` is not created because Phase 1 stops before implementation; Phase 3 must not treat these observations as transport authorization.

## 8. Scope protection and verification

| Item | Result |
|---|---|
| Production changes | `0` |
| Test changes | `0` |
| Executable/transport/persistence implementation | `0/0/0` |
| New API/routes/operations/authority | `0/0/0/0` |
| External network/provider | `0/0` |
| Dependency/lockfile changes | `0/0` |
| Phase 0 documents preserved | `PASS` |
| Full regression/build | `NOT_RUN` — no Production/test/dependency change; mandatory design blocker reached first |
| Push | `NOT_PERFORMED` |

## 9. Final Recommendation

```text
BLOCK_REL001_PHASE1_CORE_IDENTITY_CORE_API_RUNTIME_FOUNDATION
```

Phase 1 Production implementation은 위 다섯 bounded AO decisions가 승인될 때까지 시작할 수 없다. 특히 logical route 존재를 exact transport contract로 해석하거나 process-local stores를 Staging durable authority로 승격해서는 안 된다.
