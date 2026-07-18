# AI-MLS Platform Architecture Decision Register (ADR)

| Field | Value |
|---|---|
| Version | 1.0 |
| Status | Approved |
| Document Lifecycle | APPROVED |
| Effective From | After SP-003 Acceptance |
| Owner | Architecture Owner |

## Purpose

This Architecture Decision Register records all significant architectural decisions that affect the AI-MLS platform.

Every future architectural change must either reference an existing ADR or create a new ADR entry. No sprint may silently alter an accepted architectural decision.

## Decision Status

| Status | Meaning |
|---|---|
| Proposed | Under discussion. No implementation allowed. |
| Accepted | Approved by Architecture Owner. Implementation allowed. |
| Deferred | Intentionally postponed. |
| Superseded | Replaced by another ADR. |
| Rejected | Explicitly rejected. |

## Current Accepted Decisions

### ADR-001: Architecture First

**Status:** Accepted

Implementation follows the approved Architecture Bible. Architecture precedes implementation.

### ADR-002: TypeScript Baseline

**Status:** Accepted

TypeScript shall remain pinned to the newest officially supported version compatible with the approved toolchain.

Current baseline: TypeScript 6.0.3.

### ADR-003: Security Model

**Status:** Accepted

- Default Deny
- Session-derived Actor
- Human Authority
- Service Authority
- Immutable Audit
- Provenance Tracking
- Classification Inheritance

### ADR-004: AI Boundary

**Status:** Accepted

AI is advisory only. Business decisions always require deterministic validation. Human approval is required where defined by workflow.

### ADR-005: Provider Neutrality

**Status:** Accepted

No business logic may directly depend on any AI provider. Providers must be replaceable without domain changes.

### ADR-006: Closed Schema AI Contracts

**Status:** Accepted

AI responses must conform to explicit schemas. Free-form responses are prohibited inside domain workflows.

### ADR-007: Immutable Audit

**Status:** Accepted

Business events must never overwrite historical records. Audit history is append-only.

### ADR-008: Security Gates

**Status:** Accepted

Every sprint must pass the following gates before implementation is accepted:

- Lint
- Type Check
- Build
- Tests
- Gitleaks
- Dependency Audit

## Current Deferred Decisions

The following remain intentionally unresolved:

- Production Database
- Queue System
- Object Storage
- HTTP Framework Integration
- AI Provider
- AI Model
- AI Confidence Threshold
- Production Deployment Topology

No implementation may silently resolve these items.

## ADR Lifecycle and Process

Every future architectural decision must include:

1. Context
2. Decision
3. Alternatives Considered
4. Consequences
5. Status
6. Approval Date
7. Architecture Owner Approval

The lifecycle is `Proposed → Accepted`, `Deferred`, or `Rejected`. An Accepted ADR may only be replaced by a new Accepted successor ADR and then becomes `Superseded`. No sprint may modify an Accepted ADR in place.

## Architecture Owner Approval

| Field | Value |
|---|---|
| Approval Status | Approved |
| Approval Authority | Architecture Owner |
| Approval Date | 2026-07-19 |
| Effective Condition | After SP-003 Acceptance |

This register persists the Architecture Owner-approved ADR v1.0 baseline.
