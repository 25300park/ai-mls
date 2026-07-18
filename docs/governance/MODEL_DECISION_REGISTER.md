# AI-MLS Platform Model Decision Register (MDR)

| Field | Value |
|---|---|
| Version | 1.0 |
| Status | Approved |
| Document Lifecycle | APPROVED |
| Effective From | Before SP-004 |

## Purpose

The Model Decision Register records every architectural decision related to AI models, prompts, embeddings, confidence thresholds, evaluation strategy, and provider selection.

Business logic must remain provider-neutral, while AI-specific decisions are documented and reviewable.

## Decision Lifecycle

Each MDR entry shall use one of:

- Proposed
- Accepted
- Deferred
- Superseded
- Rejected

`Proposed` entries do not authorize implementation. `Accepted` entries authorize the exact approved scope. `Deferred` and `Rejected` decisions cannot be silently implemented. An accepted decision replaced by a successor becomes `Superseded`.

## MDR Record Structure

Each entry shall include:

- MDR ID
- Title
- Status
- Context
- Decision
- Alternatives Considered
- Selection Rationale
- Expected Benefits
- Risks
- Operational Impact
- Evaluation Criteria
- Rollback Strategy
- Related ADRs
- Related Requirements
- Approval Date
- Architecture Owner Approval

## Initial Open Decisions

The following decisions are intentionally left open:

- Production AI Provider
- Production AI Model
- Embedding Model
- Confidence Threshold Strategy
- Prompt Versioning Strategy
- AI Evaluation Framework
- Model Upgrade Policy
- Cost Control Strategy
- Latency Targets
- Fallback Strategy
- Human Review Thresholds

No sprint may silently resolve these decisions.

## Model Governance Rules

Business rules must never depend on a specific AI provider.

AI outputs must remain advisory unless an approved workflow explicitly authorizes automated action.

Model upgrades require:

- regression evaluation;
- cost comparison;
- latency comparison;
- quality comparison;
- rollback plan;
- Architecture Owner approval.

## Prompt Governance

Every production prompt shall have:

- Prompt ID
- Version
- Owner
- Purpose
- Input Contract
- Output Schema
- Safety Constraints
- Change History

Prompt changes shall be version-controlled and traceable to MDR entries.

## Evaluation Policy

Every production model shall be evaluated against:

- Accuracy
- Precision
- Recall, where applicable
- Latency
- Cost
- Reliability
- Hallucination Rate
- Human Acceptance Rate

Changes to evaluation criteria require a new MDR decision.

## Exit Rule

No production AI model, provider, threshold, or prompt policy may be adopted without an Accepted MDR entry.
