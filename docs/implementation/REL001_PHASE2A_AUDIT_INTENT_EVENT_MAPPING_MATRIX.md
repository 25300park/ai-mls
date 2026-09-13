# REL-001 Phase 2A Audit Intent → Event Mapping Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-109 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Audit Owner / Security/Governance Owner / Domain Owners |
| 기준 commit | `e5a2cfc9a17cdb20c0c3db1e79e3184e7a09052f` |

## 1. Canonical rule

Phase 1G `classificationRef`는 source-domain reference이며 final API-016 `eventType`가 아니다. Materializer는 raw intent를 전달하거나 default event를 만들지 않고, Audit Owner가 승인한 exact mapping registry에서만 immutable final event를 재구성한다.

## 2. Seven-source mapping assessment

| Source | Current classificationRef evidence | Safe subject/resource binding | Final eventType/action/classification/decision/outcome | Result |
|---|---|---|---|---|
| Source Registry | `SOURCE_POLICY_PROPOSED` 등 domain operation reference | Source Policy / exact aggregate and mutation identity | exact final mapping vocabulary absent | BLOCKED |
| Intake | `INTAKE_MUTATION` | Intake / exact aggregate and source-derived tenant | exact mutation class and final mapping absent | BLOCKED |
| Property | `PROPERTY_MUTATION` | system-bound Property master / exact aggregate | exact mutation class and final mapping absent | BLOCKED |
| Listing | `LISTING_MUTATION` | Listing-owned aggregate / derived tenant | exact mutation class and final mapping absent | BLOCKED |
| Contact | `CONTACT_MUTATION` | Contact/Channel/Communication distinction is not carried by the generic reference | exact mutation class and final mapping absent | BLOCKED |
| Client / Requirement | `CLIENT_REQUIREMENT_MUTATION` | aggregate ID exists, but exact Client versus Requirement operation is not universally encoded | exact mutation class and final mapping absent | BLOCKED |
| Matching | `MATCHING_MUTATION` | Match Run/Result distinction is not universally encoded | exact mutation class and final mapping absent | BLOCKED |

## 3. Purpose / policy / decision / outcome classification

| Field | Contract disposition | Reason |
|---|---|---|
| `purpose` | `REQUIRED_FROM_SOURCE_INTENT` or immutable trusted context reference | API-016 and Security Logging require purpose; no canonical default exists. |
| `policyVersion` | `REQUIRED_FROM_SOURCE_INTENT` or immutable policy evidence reference | Processing-time live policy must not rewrite mutation-time truth. |
| `decision` | `REQUIRED_FROM_SOURCE_INTENT` or exact mapping registry entry | `ALLOW`, `DENY`, `NOT_APPLICABLE` cannot be inferred from mutation success. |
| `outcome` | `REQUIRED_FROM_SOURCE_INTENT` or exact mapping registry entry | `ACCEPTED`, `COMPLETED`, `FAILED`, `UNKNOWN` are distinct and no universal default is approved. |
| `classification` | `REQUIRED_FROM_SOURCE_INTENT` or exact mapping registry entry | `classificationRef` is not a `DataClassification`. |

## 4. Required exact Audit Owner decision

For each actual mutation class, approve a registry row containing source domain, source classification reference, target type, action, final event type, data classification, decision, outcome, purpose source, policy-version source and safe evidence placement. Until those rows exist, mappings resolved are `0/7` and materialization must fail closed.

No `UNKNOWN`, `SYSTEM`, `ALLOW`, `ACCEPTED` or `COMPLETED` default is authorized.
