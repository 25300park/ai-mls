# REL-002 Phase 2A Retention and Privacy Classification

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-308 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Identity Owner / Privacy Owner / Security Owner |
| 기준일 | 2026-09-18 |
| Canonical classes | `INTERNAL`, `CONFIDENTIAL_BUSINESS`, `RESTRICTED_SECURITY` |

## 1. Field classification

| Column | Classification | Retention trigger | Privacy/audit sensitivity | Log/export rule |
|---|---|---|---|---|
| `registration_id` | `INTERNAL` | registration lifecycle + linked evidence need | stable authority identifier | reference only |
| `tenant_id` | `CONFIDENTIAL_BUSINESS` | tenant relationship + legal/operational need | cross-tenant concealment critical | minimized/tokenized |
| `principal_id` | `RESTRICTED_SECURITY` | identity lifecycle + accountability | service identity correlation | never raw in ordinary log |
| `principal_type` | `INTERNAL` | row lifetime | low standalone sensitivity | metadata allowed |
| `assurance` | `RESTRICTED_SECURITY` | row lifetime | authentication assurance | bounded metadata only |
| `environment` | `INTERNAL` | row lifetime | environment isolation | metadata allowed |
| `status` | `RESTRICTED_SECURITY` | lifecycle/history need | revocation/suspension truth | bounded metadata only |
| `workload_purpose` | `CONFIDENTIAL_BUSINESS` | approved purpose lifecycle | purpose limitation | minimized |
| `audience` | `RESTRICTED_SECURITY` | binding lifecycle | trust-boundary detail | bounded metadata only |
| `registration_version` | `INTERNAL` | row/evidence lifetime | concurrency/evidence binding | metadata allowed |
| `identity_evidence_ref` | `RESTRICTED_SECURITY` | source evidence retention/legal hold | immutable authority evidence reference | reference only; no dereferenced payload |
| `audit_evidence_ref` | `RESTRICTED_SECURITY` | audit/accountability policy | final API-016 evidence reference | reference only; access audited |
| `created_at` | `INTERNAL` | row/evidence lifetime | chronology | metadata allowed |
| `updated_at` | `INTERNAL` | row/evidence lifetime | chronology | metadata allowed |

## 2. Retention posture

- `ACTIVE`: retain while the registration is authoritative and required for current operation.
- `SUSPENDED`/`REVOKED`: retain only under approved Identity/audit accountability, dispute, security and legal-hold policy; do not reactivate.
- exact numeric periods remain the existing canonical `OPEN DECISION`; no generic duration is invented.
- deletion requires policy version, owner/approval, dependency/evidence analysis, backup re-disposition and minimal deletion evidence.
- references do not authorize raw evidence duplication. Source evidence retains its owning policy and legal hold.

## 3. Protection rules

At-rest/backup protection, tenant isolation, purpose limitation, least privilege and audited access apply. No credential value, token, secret, role/scope/capability snapshot, raw Identity/API-016 evidence, stack/path/SQL or database dump may enter the table, logs, migration evidence or documentation.

## 4. Migration privacy

The schema migration processes no identity rows. Preflight and verification inspect schema metadata only. Any later registration import requires a separately approved field-level data handling and reconciliation plan.

## 5. Completion disposition

Column-level classification and handling rules are complete for design. Exact retention periods remain under existing Privacy/Data owner policy gates and do not authorize deletion or indefinite retention.
