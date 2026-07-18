# Retention and Deletion Model

| 항목 | 값 |
|---|---|
| Document ID | DOC-DATA-014 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Security/Privacy Reviewer / Database Reviewer |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Principles

- Every retained entity has purpose, owner, privacy class, retention class, trigger and disposition.
- indefinite retention is not the default.
- Soft Delete controls business visibility; it is not proof of privacy deletion.
- deletion is authorized, auditable, dependency-aware and recoverability-aware.
- legal hold suspends eligible deletion only within explicit scope and does not authorize new use.

## Policy entities

| Concept | Purpose | Required content |
|---|---|---|
| Retention Policy | entity/data class별 retention rule | policy ID/version, purpose/legal/business basis, trigger, period/rule, disposition, owner/reviewer |
| Archive Policy | active store에서 historical store로 이동 규칙 | eligibility, access class, integrity, location class, restore path, archive retention |
| Deletion Policy | logical/physical/anonymization disposition | scope, approval, dependency behavior, index/export/backup treatment, evidence |
| Recovery Policy | accidental/failure recovery boundary | recovery window, authorized requester, restored-state validation, downstream reconciliation |
| Legal Hold | normal deletion을 일시 중지하는 explicit control | scope/query, reason/legal reference, owner/approver, start/review/end, access restriction |
| Retention Job | policy execution unit | policy/version, target scope, operation identity, status, attempt, outcome/error, audit reference |

## Data classes and default posture

| Data category | Default posture | Deletion concerns |
|---|---|---|
| Raw Source/Attachment | bounded source/privacy policy | object, extracted text, AI copy, search, backup |
| Property master/Alias | active while referenced; supersession history | downstream identity and provenance integrity |
| Candidate/Offer | lifecycle + operational/dispute policy | verification, match, publication history |
| Contact/Client/Requirement | purpose/consent/legal-basis bounded | derived/search/export/AI and identity tombstone |
| Verification/Permission/Publication | evidence and dispute policy | active external representation and revocation trace |
| Audit/Decision/Status History | category-specific accountability policy | pseudonymization, legal hold, tamper evidence |
| AI Job/Result/System Error | operational/evaluation policy with minimization | raw prompt/output, provider copy, sensitive diagnostic |

Exact periods are `OPEN DECISION`; no generic number is invented.

## Deletion workflow

1. authorized request or policy trigger identifies scope and subject.
2. resolve legal hold, authority, privacy class and current use.
3. enumerate canonical record, child/dependent history, source/attachment, index, cache, export, AI and external publication impact.
4. choose archive, anonymize, redact, tombstone, physical delete or reject/defer with reason.
5. execute idempotent Retention Job and record per-target outcome.
6. validate search/index removal and active workflow/publication consistency.
7. handle backups according to approved expiry/restore re-deletion procedure.
8. store minimal deletion evidence and close/escalate failures.

## Soft delete

- default active query excludes deleted record.
- actor, reason, deletion time and policy reference are required.
- restore is allowed only inside Recovery Policy window and cannot silently reactivate expired permission/publication.
- unique identity conflicts after restore are reviewed, not overwritten.

## Archive

Archive is read-only historical preservation with narrower access, integrity verification and restore procedure. Archived personal/raw data remains subject to privacy and retention. archive is not a place to evade deletion.

## Legal hold

- scope is the minimum data required and periodically reviewed.
- hold issuance/release is audited and separation of duties may apply.
- deletion jobs detect hold before destructive action and report blocked targets.
- release resumes normal policy evaluation; it does not require immediate deletion without revalidation.

## Recovery and external effects

Restoring internal data does not republish, regrant permission or mark verification current. deleted external Publication may remain outside control; the unresolved state is reconciled/escalated. backup restore must reapply deletions that became effective after backup time.

## Capability

`DB-015`: retention/deletion execution is policy-versioned, idempotent, auditable and dependency-complete, with legal hold and recovery semantics.

> **OPEN DECISION:** exact periods, legal/privacy basis, archive location, backup deletion behavior, recovery windows and final destruction approver.

