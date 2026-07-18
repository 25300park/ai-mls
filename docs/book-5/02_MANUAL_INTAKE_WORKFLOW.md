# Manual Intake Workflow

| 항목 | 값 |
|---|---|
| Document ID | DOC-WF-003 |
| Workflow ID | WF-002 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Intake Owner |
| 기준일 | 2026-07-14 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Purpose

Manual registration으로 source evidence를 안전하게 보존하고 validation/correction 후 Candidate draft 또는 AI request를 만든다. “Approval”은 intake/candidate-draft acceptance이며 Verification 또는 external-use approval이 아니다.

## Inputs and actors

- authorized Collector/Agent/Admin acting within source/intake scope
- WF-001 Intake Request or directly supplied approved source context
- source registry/policy version, observed/captured time, raw content/reference and attachments
- privacy/retention class and intended processing purpose

## Workflow

| Step | Action | Owner/authority | Status/output |
|---|---|---|---|
| Register draft | assign operation and Raw Source draft reference | Intake actor | `INTAKE.DRAFT` |
| Validate source/evidence | policy, provenance, required metadata, type/size/safety/privacy | deterministic validator + policy owner | `VALIDATED`, `VALIDATION_FAILED` or `QUARANTINED` |
| Store evidence | preserve immutable raw/reference and attachments | Raw Data Owner | accepted Raw Source version |
| Select route | request AI-001 or use manual structured entry | authorized Intake actor | `AI_REQUESTED` or `REVIEW_REQUIRED` |
| Review/correct | compare draft with raw evidence; correct with reason | human reviewer | `CORRECTED`, `REJECTED` or review accepted |
| Approve candidate draft | authorize Candidate/Offer proposal creation | Listing Data Owner delegate | `CANDIDATE_REGISTERED` |

## Validation

- active Source Registry and allowed method/purpose
- unique operation identity and capture-time provenance
- raw reference/content integrity and attachment safety state
- required privacy/retention classification
- no credential/secret/unapproved personal data propagation
- source-reported vs observed/captured time separation
- allowed file/type/size/language handling and quarantine route

## AI request

AI request is optional and references the accepted Raw Source version, approved minimized projection, AI capability/schema/policy versions and correlation. AI failure never deletes the intake or prevents manual completion.

## Correction and approval

- correction creates lineage from raw/AI draft to human-corrected values.
- material fields with ambiguity/conflict stay unknown or require evidence; reviewers cannot invent facts.
- approval checks Candidate registration authority and provenance completeness.
- candidate draft remains `CANDIDATE` authority; Verification and Permission are separate workflows.

## Audit events

`INTAKE_DRAFT_CREATED`, `INTAKE_VALIDATION_FAILED`, `RAW_SOURCE_ACCEPTED`, `ATTACHMENT_QUARANTINED`, `AI_PROCESSING_REQUESTED`, `INTAKE_CORRECTED`, `CANDIDATE_DRAFT_APPROVED`, `INTAKE_REJECTED`.

## Exceptions and recovery

validation failure returns to `INTAKE.DRAFT` only after explicit correction; policy/security failure may remain `QUARANTINED`. duplicate operation links existing source. object-storage or worker failure follows WF-012 without claiming success.

## Exit criteria

WF-003 may start after Raw Source acceptance. WF-004 or later Candidate workflows require `INTAKE.CANDIDATE_REGISTERED`, not merely AI success.

> **OPEN DECISION:** mandatory intake fields, attachment limits, quarantine owner/SLA and candidate-draft approver role.

