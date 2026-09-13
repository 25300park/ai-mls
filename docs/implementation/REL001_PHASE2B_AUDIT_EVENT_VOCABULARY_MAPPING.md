# REL-001 Phase 2B Audit Event Vocabulary Mapping

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-116 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Audit Owner / Domain Owners |
| 기준 commit | `e5a2cfc9a17cdb20c0c3db1e79e3184e7a09052f` |

## 1. Mapping rule

Only event types already emitted by the corresponding canonical domain service are allowed. The v1 `classificationRef` is not used as a final type. Every v2 intent carries one exact allowlisted tuple; mismatched tuples fail closed.

## 2. Closed source mappings

| Source | Existing eventType | action | targetType | category |
|---|---|---|---|---|
| Source Registry | `SOURCE_POLICY_PROPOSED` | `source.propose` | `SourceRegistry` | `COMMAND_ACCEPTED` |
| Intake | `INTAKE_CREATED` | `intake.create` | `Intake` | `COMMAND_ACCEPTED` |
| Intake | `RAW_ATTACHMENT_LINKED` | `intake.attach-evidence` | `Intake` | `EVIDENCE_APPENDED` |
| Intake | `INTAKE_VALIDATED` | `intake.validate` | `Intake` | `STATE_CHANGED` |
| Intake | `INTAKE_AI_REQUESTED` | `intake.request-ai` | `Intake` | `COMMAND_ACCEPTED` |
| Intake | `INTAKE_AI_RESULT_ROUTED` | `intake.validate` | `Intake` | `STATE_CHANGED` |
| Intake | `INTAKE_MANUAL_FALLBACK` | `intake.validate` | `Intake` | `STATE_CHANGED` |
| Intake | `INTAKE_REVIEWED` | `intake.review` | `Intake` | `STATE_CHANGED` |
| Property | `PROPERTY_PROPOSED` | `property.propose` | canonical Property entity type | `COMMAND_ACCEPTED` |
| Property | `PROPERTY_DECIDED` | `property.decide` | canonical Property entity type | `STATE_CHANGED` |
| Property | `PROPERTY_ALIAS_PROPOSED` | `property.propose` | `PropertyAlias` | `COMMAND_ACCEPTED` |
| Listing | `CANDIDATE_CREATED` | `candidate.create` | `CandidateListing` | `COMMAND_ACCEPTED` |
| Listing | `CANDIDATE_REGISTERED_FROM_INTAKE` | `candidate.create` | `CandidateListing` | `STATE_CHANGED` |
| Listing | `CANDIDATE_REVISED` | `candidate.revise` | `CandidateListing` | `STATE_CHANGED` |
| Listing | `LISTING_OFFER_CREATED` | `offer.create` | `ListingOffer` | `COMMAND_ACCEPTED` |
| Listing | `LISTING_OFFER_REVISED` | `offer.revise` | `ListingOffer` | `STATE_CHANGED` |
| Listing | `DUPLICATE_SUGGESTED` | `duplicate.suggest` | `DuplicateGroup` | `COMMAND_ACCEPTED` |
| Listing | `DUPLICATE_DISPOSED` | `duplicate.dispose` | `DuplicateGroup` | `STATE_CHANGED` |
| Contact | `CONTACT_CREATED` | `contact.create` | `Contact` | `COMMAND_ACCEPTED` |
| Contact | `CONTACT_CORRECTED` | `contact.edit` | `Contact` | `STATE_CHANGED` |
| Contact | `CONTACT_CHANNEL_ADDED` | `contact.edit` | `ContactChannel` | `STATE_CHANGED` |
| Contact | `CONTACT_CHANNEL_REVOKED` | `contact.edit` | `ContactChannel` | `STATE_CHANGED` |
| Contact | `CONTACT_ATTEMPT_RECORDED` | `contact.attempt` | `ContactCase` | `EVIDENCE_APPENDED` |
| Client / Requirement | `CLIENT_CREATED` | `client.create` | `Client` | `COMMAND_ACCEPTED` |
| Client / Requirement | `REQUIREMENT_DRAFT_CREATED` | `requirement.create` | `Requirement` | `COMMAND_ACCEPTED` |
| Client / Requirement | `REQUIREMENT_ACTIVATED` | `requirement.activate` | `Requirement` | `STATE_CHANGED` |
| Client / Requirement | `REQUIREMENT_REVISED` | `requirement.revise` | `Requirement` | `STATE_CHANGED` |
| Client / Requirement | `REQUIREMENT_TRANSITIONED` | `requirement.transition` | `Requirement` | `STATE_CHANGED` |
| Matching | `MATCH_RUN_CREATED` | `matching.request` | `MatchRun` | `COMMAND_ACCEPTED` |
| Matching | `MATCH_RESULT_REVIEWED` | `matching.review` | `MatchResult` | `STATE_CHANGED` |
| Matching | `MATCH_RESULT_STALE` | `matching.stale` | `MatchResult` | `STATE_CHANGED` |

## 3. Explicit exclusions and blocker

- Read-only and standalone advisory-validation events are not Phase 1G durable mutation intents.
- Rejected/denied commands that never commit a domain transaction require their existing direct security-audit path; no durable mutation intent is fabricated.
- `DurableClientRequirementStore.updateClient()` has no corresponding existing canonical event type. `CLIENT_UPDATED` or an equivalent name is not invented. This operation is `NEW_AUDIT_EVENT_TYPE_REQUIRED`, so the combined Client / Requirement source remains `NOT_MATERIALIZATION_READY`.
- System-originated events are excluded because the current canonical principal types are only `HUMAN | SERVICE` and none of the mapped operations requires a new SYSTEM principal.

## 4. Result

Closed source mappings are resolved for `6/7`. Client / Requirement has an explicit Audit Owner blocker for `updateClient()`.
