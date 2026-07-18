# AI Prompt Library Guide

| 항목 | 값 |
|---|---|
| Document ID | DOC-AI-016 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | AI Reviewer |
| 기준일 | 2026-07-14 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

This guide defines library structure and metadata only. It deliberately includes no reusable prompt wording, role instruction, few-shot example or production template.

## Prompt categories

| Category | Capability mapping | Allowed purpose |
|---|---|---|
| LISTING_PARSE | AI-001 | evidence-grounded candidate field proposal |
| PROPERTY_NORMALIZE | AI-002 | canonical/alias/location candidate proposal |
| DUPLICATE_ASSESS | AI-003 | relationship/similarity recommendation |
| REQUIREMENT_PARSE | AI-004 | structured client requirement proposal |
| MATCH_EXPLAIN | AI-005 | grounded match factors/rank explanation |
| SEARCH_INTERPRET | AI-006 | bounded read-only search interpretation |
| VALIDATION_SUPPORT | AI-007 | advisory consistency/quality classification only |

Provider-specific tuning is a variant under a capability prompt, not a new business authority.

## Prompt naming

Proposed logical name: `PRM-<CAPABILITY>-<NNN>-<SHORT_NAME>`. Filename/registry key is stable, ASCII and version-independent. Environment/provider/model names are metadata, not embedded into permanent identity. Prompt ID issuance follows a dedicated registry after approval.

## Required documentation metadata

| Field | Requirement |
|---|---|
| Identity | prompt ID, title, owner, version, checksum, status |
| Purpose | capability, intended/non-intended use and authority boundary |
| Contract | input data classes, output schema ID/version, validation/confidence policy |
| Compatibility | provider/model/adapter/config and language/domain cohorts |
| Governance | reviewers, approvals, change/rollback/retirement links |
| Evaluation | dataset/version, metrics/thresholds, results, known limitations |
| Operations | timeout/cost class, fallback, monitoring, disable route |
| Security/privacy | threat/data-flow review, redaction, retention/log settings |

## Prompt lifecycle

Authoring occurs outside production registry, then `DRAFT → TESTING → IN REVIEW → APPROVED → ACTIVE → DEPRECATED → RETIRED`. Active pointer references one immutable approved version per supported capability/provider/model cohort. Shadow/canary versions remain non-authoritative and require approved exposure.

## Prompt testing

The library links each version to contract, representative, adversarial, privacy, authority-boundary, regression, cost/latency and fallback tests. Test cases store minimized synthetic/approved data and expected structured properties, not credentials or unrestricted production content.

## Prompt documentation

Documentation records intent and constraints, not secrets. Content storage location, access policy and checksum are separate. Changes include rationale, comparison to prior version, affected schemas/evaluations and rollback compatibility.

## Prompt review

AI Reviewer checks quality/contract; Domain Owner checks semantics; Security/Privacy checks data/injection/provider terms; Architecture checks boundary; Business checks user impact where relevant. Material unresolved finding blocks approval. Review evidence binds exact checksum/version.

## Prohibited library content

- credentials/secrets or real unrestricted contact/client/raw data
- prompt that instructs verification, permission, publication or authoritative write
- hidden provider action/tool access
- unversioned production instruction or mutable “latest” content without checksum
- output contract that bypasses [AI Output Schemas](14_AI_OUTPUT_SCHEMAS.md) and validation

> **OPEN DECISION:** registry implementation, prompt ID allocator, content storage/access, environment promotion and approved synthetic dataset policy.

