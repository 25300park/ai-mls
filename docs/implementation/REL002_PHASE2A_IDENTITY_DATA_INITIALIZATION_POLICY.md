# REL-002 Phase 2A Identity Data Initialization Policy

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-307 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Identity Owner / Security Owner |
| 기준일 | 2026-09-18 |
| Decision | DEC-174 (`APPROVED`) |

## 1. Canonical separation

Schema migration creates only schema and `identity_schema_contracts` metadata. It creates zero `identity_registered_service_workloads` rows. Identity registration is a separate governed process because each row asserts identity proof, tenant/principal binding, workload purpose, audience, lifecycle and evidence references.

## 2. Runtime prerequisite

Production bootstrap configuration supplies `requiredServiceRegistrations`. Before the five governed roots can start, authoritative rows must exist and collectively cover exact Production audiences `API-014`, `API-015`, `API-018`, `API-019` and `FEAT-022`. The exact registration IDs, principals and tenant bindings are deployment-specific owner input and are not invented by migration.

Therefore the result is `SEPARATE_PROCESS`: rows are operationally required, but not migration seed data.

## 3. Controlled registration input

Each future registration requires:

- immutable `registration_id`
- authoritative `tenant_id` and `principal_id`
- `SERVICE` / `WORKLOAD` / `PRODUCTION`
- exact approved `workload_purpose` and governed-root `audience`
- initial `registration_version = 1`
- final immutable Identity evidence reference
- final API-016 audit evidence reference bound to the same registration/version/tenant/principal
- authorized actor, change reference, MFA/SoD and append-oriented evidence

Caller-supplied readiness, role, scope, capability, credential or default principal is not accepted.

## 4. Lifecycle and replay

- new identity creation and later lifecycle transition are separate authorized operations.
- `SUSPENDED`/`REVOKED` cannot be reactivated by migration, restore or application startup.
- same registration identity with exact input is idempotent; conflicting input fails closed.
- seeding from environment variables, configuration defaults or migration SQL is prohibited.

## 5. Decision proposal

`DEC-174 = APPROVED`: Production service workload rows are provisioned only through a separately authorized, evidence-bound registration process after schema readiness; schema migration and restore never manufacture active authority.
