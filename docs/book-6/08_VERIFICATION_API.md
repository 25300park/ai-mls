# Verification API

| 항목 | 값 |
|---|---|
| Document ID | DOC-API-009 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Verification Owner / Business Owner |
| 기준일 | 2026-07-14 |
| API Capabilities | API-011, API-012 |

## Purpose

Candidate/Offer의 time- and scope-bound human Verification, 별도 Permission 및 Reverification Request를 관리한다.

## Logical Endpoints

| Logical operation | Method/resource | Outcome |
|---|---|---|
| Request Verification | `POST /v{major}/verifications` | `VERIFICATION.REQUESTED` |
| Assign/Read Review | `POST .../{id}:assign`, `GET .../{id}` | scoped reviewer context |
| Decide Verification | `POST /v{major}/verifications/{id}:decide` | verified/rejected/insufficient |
| Create Permission Request | `POST /v{major}/permissions` | `PERMISSION.DRAFT` |
| Decide Permission | `POST /v{major}/permissions/{id}:decide` | active/rejected human decision |
| Revoke Permission | `POST /v{major}/permissions/{id}:revoke` | immediate bounded revocation |
| Request Reverification | `POST /v{major}/reverifications` | scheduled/in-progress task |

## Request Model

Exact subject ID/version, verification scope/claims, evidence refs, as-of/validity proposal, verifier assignment, decision/rationale를 사용한다. Permission은 type(`CLIENT_SHARING` 또는 `PUBLIC_PUBLICATION`), purpose, audience/target, grantor, evidence, effective/expiry와 exact subject version을 요구한다.

## Response Model

Verification/Permission/Reverification IDs, canonical status/version, scope, validity, evidence references, human decision identity/time, limitations 및 downstream eligibility indicators를 반환한다. Restricted evidence는 reference/masked summary로 제공한다.

## Business Rules

Verification과 Permission은 독립 record/decision이다. AI, connector, scheduler가 verified/active를 만들 수 없다. Expired/revoked record를 재활성화하지 않고 successor를 생성한다. Verification만으로 client sharing/publication을 허용하지 않는다.

## Authority

Authorized Verifier만 Verification decision, grantor evidence를 검토할 권한이 있는 Permission Reviewer만 Permission decision을 수행한다. Scheduler는 expiring/expired와 task 생성만 가능하다.

## Validation

subject/version/current state, evidence completeness/freshness, verifier assignment, separation of duties, permission grantor/scope/audience/validity, overlap/conflict와 expected version을 검사한다.

## Audit

request/assignment, evidence access, review decision, scope/validity, Permission grant/reject/revoke, expiry signal, reverification attempt와 downstream stale/hold impact를 기록한다.

## Error Conditions

`VERIFICATION_NOT_ELIGIBLE`, `VERIFIER_NOT_ASSIGNED`, `EVIDENCE_INSUFFICIENT`, `VERIFICATION_EXPIRED`, `PERMISSION_REQUIRED`, `PERMISSION_SCOPE_INVALID`, `PERMISSION_REVOKED`, `SEPARATION_OF_DUTIES_VIOLATION`, `VERSION_CONFLICT`.

## Related Workflow

`WF-007` Contact and Verification, `WF-009` Publication Approval, `WF-011` Expiration/Reverification, `WF-012` Recovery.

## Related Entity

Verification, Verifier Assignment, Permission, Reverification Request, Availability, Candidate Listing, Listing Offer, Approval History, Audit Event.

## Related AI Capability

`N/A — human authority`; `AI-007` may support non-authoritative evidence validation but cannot decide.

