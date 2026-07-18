# Client and Requirement API

| 항목 | 값 |
|---|---|
| Document ID | DOC-API-007 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business Owner / Privacy Reviewer |
| 기준일 | 2026-07-14 |
| API Capabilities | API-008, API-009 |

## Purpose

Client relationship과 versioned Requirement, budget/location/matching preferences 및 original communication provenance를 관리한다.

## Logical Endpoints

| Logical operation | Method/resource | Outcome |
|---|---|---|
| Create/Read Client | `POST /v{major}/clients`, `GET .../{id}` | scoped client relationship |
| Create Requirement | `POST /v{major}/clients/{id}/requirements` | `REQUIREMENT.DRAFT` |
| Revise Requirement | `POST /v{major}/requirements/{id}/revisions` | immutable successor revision |
| Transition Requirement | `POST /v{major}/requirements/{id}:transition` | active/pause/fulfill/withdraw disposition |
| Read History | `GET /v{major}/requirements/{id}/history` | provenance and revisions |
| Request Requirement Parsing | `POST /v{major}/requirements/{id}:request-ai-parse` | advisory AI job |

## Request Model

Client/contact/team owner, consent/privacy context, original communication ref, intent, hard/soft criteria, budget/currency/frequency, location preferences, timing, priority, expected version와 reason을 포함한다. AI parse request는 immutable source/version과 approved data class를 참조한다.

## Response Model

Client/Requirement IDs, canonical revision/status, normalized criteria와 raw-term provenance, validation gaps, allowed actions, history links 및 optional AI job reference를 반환한다. AI proposal과 accepted requirement fields를 분리한다.

## Business Rules

Requirement는 client need의 versioned authority이며 listing truth가 아니다. Material edit는 in-place overwrite가 아니라 revision/history다. `ACTIVE`만 matching trigger가 가능하고 terminal requirement는 새 need/version으로 대체한다. AI parse는 draft suggestion일 뿐 activation이 아니다.

## Authority

Assigned Agent가 draft/revision/pause, Senior Agent가 policy상 필요한 activation/fulfillment review, Client/authorized representative가 source confirmation을 제공한다. AI/service principal은 activation/withdrawal을 수행하지 않는다.

## Validation

client relationship/assignment/consent, required intent, criteria consistency, currency/time semantics, privacy minimization, state edge, expected version와 original source link를 검사한다.

## Audit

client create/access/status, requirement draft/revision/transition, field provenance, priority change, AI request/result linkage 및 matching trigger를 기록한다.

## Error Conditions

`CLIENT_NOT_FOUND`, `CLIENT_SCOPE_DENIED`, `REQUIREMENT_INVALID`, `CRITERIA_CONFLICT`, `CONSENT_SCOPE_DENIED`, `REQUIREMENT_NOT_ACTIVE`, `STATE_TRANSITION_INVALID`, `VERSION_CONFLICT`, `AI_INPUT_NOT_ALLOWED`.

## Related Workflow

`WF-005` Client Requirement, `WF-006` Matching, `WF-008` Client Proposal, `WF-012` Recovery.

## Related Entity

Client, Contact, Communication, Requirement, Budget, Location Preference, Matching Preference, Requirement History, Audit Event.

## Related AI Capability

`AI-004` Requirement parsing, `AI-006` natural-language search interpretation, `AI-007` validation.

