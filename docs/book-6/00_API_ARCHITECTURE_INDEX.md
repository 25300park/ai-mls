# Book 6 — API & Integration Architecture Index

| 항목 | 값 |
|---|---|
| Document ID | DOC-API-001 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner / Development Reviewer |
| 기준일 | 2026-07-14 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Purpose

Book 6는 AI MLS의 logical API boundary, request/response contract, authority, validation, audit, error, background job 및 external integration 계약을 정의한다. 여기에 적힌 route는 logical endpoint identifier이며 final URL, executable OpenAPI, controller, schema, SDK 또는 implementation commitment가 아니다.

## Navigation

| Document ID | 문서 | 책임 |
|---|---|---|
| DOC-API-002 | [API Principles](01_API_PRINCIPLES.md) | REST, identity, idempotency, query와 error conventions |
| DOC-API-003 | [Authentication API](02_AUTHENTICATION_API.md) | roles, permissions, token/session lifecycle |
| DOC-API-004 | [Source and Intake API](03_SOURCE_AND_INTAKE_API.md) | source policy, raw evidence와 manual intake |
| DOC-API-005 | [Property and Listing API](04_PROPERTY_AND_LISTING_API.md) | property master, candidate, offer와 duplicate review |
| DOC-API-006 | [Contact API](05_CONTACT_API.md) | restricted contact/channel/communication access |
| DOC-API-007 | [Client and Requirement API](06_CLIENT_AND_REQUIREMENT_API.md) | client, requirement, history와 lifecycle |
| DOC-API-008 | [Matching API](07_MATCHING_API.md) | match request, result, review와 staleness |
| DOC-API-009 | [Verification API](08_VERIFICATION_API.md) | verification, permission과 reverification |
| DOC-API-010 | [Publication API](09_PUBLICATION_API.md) | proposal, approval, delivery, reconciliation와 withdrawal |
| DOC-API-011 | [Admin and Audit API](10_ADMIN_AND_AUDIT_API.md) | policy/role administration과 immutable audit query |
| DOC-API-012 | [Background Job Contracts](11_BACKGROUND_JOB_CONTRACTS.md) | asynchronous job command/status/result contracts |
| DOC-API-013 | [Connector Contracts](12_CONNECTOR_CONTRACTS.md) | current/planned/assumed connector boundaries |
| DOC-API-014 | [External Integration](13_EXTERNAL_INTEGRATION.md) | integration inventory, data direction와 system-of-record rules |
| DOC-API-015 | [API Error Standard](14_API_ERROR_STANDARD.md) | stable error envelope and taxonomy |
| DOC-API-016 | [API Versioning](15_API_VERSIONING.md) | compatibility, deprecation and lifecycle policy |
| DOC-API-017 | [API Registry](16_API_REGISTRY.md) | API-001–019 capability source of truth and mappings |

## Mandatory principles

1. No API bypasses workflow.
2. No API bypasses authority.
3. No API bypasses audit.
4. Every write operation is traceable.
5. Every requested state transition is validated against canonical state/version.
6. Every API capability maps to at least one workflow, entity and AI capability or an explicit justified `N/A`.
7. Connectors call only scoped public contracts and cannot create Verification, Permission, Approval or Published authority.
8. AI input/output remains advisory and cannot become an authoritative write through an API shortcut.

## Common contract profile

Every domain API document defines Purpose, Logical Endpoints, Request Model, Response Model, Business Rules, Authority, Validation, Audit, Error Conditions, Related Workflow, Related Entity and Related AI Capability. Cross-cutting standards state when a field is `N/A` and point to the domain contract that owns it.

Write requests carry authenticated principal context, `request_id`, `correlation_id`, expected aggregate version and reason. Retryable commands also carry `idempotency_key`. A successful response confirms accepted canonical state or accepted asynchronous work; it never implies a downstream approval or external side effect not explicitly reconciled.

## Trace bindings

- Constitution: `REQ-CONST-001`–`013`
- Workflows: `WF-001`–`012`
- Database capabilities: `DB-001`–`015`
- AI capabilities: `AI-001`–`007`
- API capabilities: `API-001`–`019`, defined in [API Registry](16_API_REGISTRY.md)

> **OPEN DECISION:** external consumer eligibility, named API/security owner, rate/size limits, token provider, base URL, exact media types and initial compatibility window.

