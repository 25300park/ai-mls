# REL-002 Phase 2D-0I Production DB Credential Rotation / Revocation Runbook

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-350 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Security / Operations Owner |
| 기준 Main | `e973c6e66fb53b3cfb0908b777a8af0704f64812` |

## 1. Preconditions

- named operator and AO/Security approval;
- exact Production Supabase project and Railway `ai-mls-api` service;
- backup/restore prerequisites and maintenance window;
- V2 sealed variable names approved;
- no Production value in ticket, docs, terminal output or evidence.

## 2. Planned rotation

1. Generate/obtain the successor database credential through the approved Supabase operator path; do not print it.
2. Add `AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V2` as a new sealed service variable through the Railway UI. Do not change the active reference yet.
3. Verify only key presence/sealed state and exact service/environment binding.
4. In the controlled window, change the password of `ai_mls_production_runtime` using the separately authorized migration/operator identity.
5. Stage `IDENTITY_DATABASE_CONNECTION_REF=railway-sealed-env:AI_MLS_PRODUCTION_IDENTITY_DATABASE_CONNECTION_V2` and deploy exactly one reviewed release.
6. Require `/readyz` PASS and bounded database verification. No fallback to V1 is automatic.
7. Revoke/delete the V1 sealed variable after success evidence and close pre-existing connections during bounded shutdown.
8. Record only actor reference, approvals, deployment/migration evidence references, old/new reference fingerprints, timestamps and safe outcome.

The physical backend may temporarily contain V1 and V2, but only one exact reference is authoritative for a deployment. Resolver fallback, dual read, retry with old credential and automatic downgrade are prohibited.

## 3. Failure and rollback

- Before database password change: remove unreferenced V2 and abort.
- After database password change but before new deployment readiness: deployment stays `NOT_READY`; operator must either complete V2 deployment or explicitly restore a newly controlled credential and reference under a separately recorded rollback approval.
- Never reveal the prior sealed value; sealed values are not treated as recoverable backups.
- Suspected leakage: revoke the active database password immediately under incident authority, mark runtime `NOT_READY`, rotate to a new version, inspect logs/artifacts without searching by raw secret value, and preserve safe incident evidence.

## 4. CA rotation

CA rotation uses the same successor-key pattern with `AI_MLS_PRODUCTION_IDENTITY_DATABASE_CA_CERT_V2`. Connection credential and CA may be rotated in one reviewed deployment only when their target binding is jointly verified. Empty CA, `rejectUnauthorized=false`, and system-trust fallback are prohibited.

## 5. Current execution state

This runbook is design evidence only. Credential generation, sealed variable creation, Supabase password change, Railway deployment and Production connection are all `0`.
