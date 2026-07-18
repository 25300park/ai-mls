# Prompt Governance

| 항목 | 값 |
|---|---|
| Document ID | DOC-AI-013 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | AI Reviewer / Security Reviewer |
| 기준일 | 2026-07-14 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

This document defines governance metadata and process only. It contains no production prompt text, system instruction, few-shot content or deployable template.

## Prompt ownership

Each prompt asset has a Prompt Owner, Capability Owner, AI Reviewer and required Security/Privacy/Data/Business reviewers. Author cannot self-approve a material production prompt. Prompt owner is responsible for purpose, input/output contract, evaluation, data policy, rollback and retirement.

## Prompt identifier and versioning

Logical ID format proposal: `PRM-<CAPABILITY>-NNN`; version uses immutable semantic revision such as `v0.x` draft and approved release version. The registry binds prompt ID/version, capability, provider/model compatibility, schema version, config/dependency versions and content checksum. Exact registry implementation is deferred.

## Prompt lifecycle

`DRAFT → TESTING → IN REVIEW → APPROVED → ACTIVE → DEPRECATED → RETIRED`

Document lifecycle status and runtime activation are distinct. Prompt content is immutable after approval; change creates a new version. Emergency disable does not delete evidence.

## Prompt approval

Approval candidate includes immutable content checksum (stored outside this guide), purpose, data classes, supported capability/provider/model, output schema, test/evaluation results, known limitations, security/privacy review, cost/latency impact, rollout and rollback. Activation requires all blocking findings resolved and named approval evidence.

## Prompt testing

- contract/schema and prohibited-authority negative tests
- representative quality/evaluation corpus by language/property/source cohort
- injection/adversarial/unsafe-content and sensitive-data tests
- missing/conflicting/long/malformed input and deterministic fallback
- regression against active version, calibration and human correction
- latency/cost/rate-limit and provider/model compatibility

Production raw personal/source data is not copied into fixtures without explicit approved handling.

## Prompt rollback

Rollback selects a previously approved compatible prompt/config/schema/provider combination, records reason/actor/time and verifies no incompatible downstream state. If safe rollback is unavailable, disable capability and use manual/deterministic fallback. Rollback does not erase failed version evidence.

## Sensitive data rules

- classify/minimize/redact before prompt construction.
- credentials, secrets and unrestricted contact/client/raw data are prohibited.
- untrusted source content is delimited as data and cannot redefine system policy.
- provider retention/training/log settings must match approved data policy.
- prompt/output logs use references or redacted samples, not full sensitive content by default.
- new data class/provider/cross-border condition triggers Security/Privacy review.

## Change and release control

Material behavior, authority, data flow, schema or provider changes require CR/decision/ADR triage and re-evaluation. Minor editorial change still creates a new checksum/version. A/B or shadow evaluation needs approved exposure, cohort and stop criteria; it is not a bypass around approval.

## Access and audit

prompt read/edit/approve/activate/rollback/export access is least-privilege and audited. Provider secret and prompt content are separate assets. Retention supports incident/release reproduction without indefinite unnecessary sensitive examples.

> **OPEN DECISION:** named owners, prompt registry/store, semantic version policy, approval quorum, evaluation retention and emergency disable authority.

