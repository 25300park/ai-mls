# Client Requirement Workflow

| 항목 | 값 |
|---|---|
| Document ID | DOC-WF-006 |
| Workflow ID | WF-005 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Agent / Business Owner |
| 기준일 | 2026-07-14 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Purpose

Client의 original need를 privacy-aware, versioned Requirement로 등록·확인·갱신하고 matching trigger를 제어한다.

## Requirement registration

1. authorized Agent identifies Client relationship, purpose and minimum contact/consent context.
2. original wording/reference and received time are preserved.
3. manual entry or AI-004 creates structured draft with budget, location, property type, preferences, hard/soft/exclude constraints, timing and unknowns.
4. deterministic validation checks currency/frequency, contradiction, location references, prohibited/sensitive criteria and required fields.
5. human confirms material interpretations and clarification.
6. authorized Agent activates exact Requirement revision.

## Status lifecycle

`REQUIREMENT.DRAFT → ACTIVE ↔ PAUSED → FULFILLED / WITHDRAWN / EXPIRED`

Validation/correction happens within DRAFT revisions; an invalid draft never becomes ACTIVE. Terminal status may be superseded by a new Requirement, not silently reactivated.

## Update and history

- every update creates a new revision with actor, time, reason and original/client communication reference.
- hard/soft/exclude and unknown/no-preference are distinct.
- material update marks existing Match Results `STALE` and triggers optional new matching.
- prior proposal/feedback remains bound to the Requirement revision used.
- Client correction overrides AI interpretation but does not rewrite original wording/history.

## Priority

Priority has owner, reason, effective period and approved vocabulary. It may reflect client timing/service urgency but cannot override privacy, verification, permission or hard constraints. Automatic/model priority is advisory until accepted by authorized Agent/Manager.

## Matching trigger

Trigger requires `REQUIREMENT.ACTIVE`, complete minimum fields or explicit unknown handling, current revision, authorized owner and matching purpose. Trigger records cohort/audience intent; it does not guarantee results or external eligibility.

## Human checkpoints

- material budget/location/timing/hard constraint
- sensitive/prohibited attribute or ambiguous client intent
- representative/consent/identity uncertainty
- AI `MEDIUM/LOW/UNKNOWN`, contradiction or missing clarification
- status transition to ACTIVE/FULFILLED/WITHDRAWN

## Audit events

draft created, AI parse requested/reviewed, clarification/correction, activated, updated/superseded, priority changed, paused/resumed, matching triggered, fulfilled/withdrawn/expired. Restricted content is minimized.

## Exceptions and recovery

privacy/identity conflict blocks activation; invalid update leaves last active revision unchanged; system/AI failure falls back to manual entry; duplicate Client/Requirement resolution preserves histories.

> **OPEN DECISION:** minimum active fields, priority vocabulary, expiry/default review period, authorized representative and client confirmation evidence.

