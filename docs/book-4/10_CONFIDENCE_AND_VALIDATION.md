# Confidence and Validation

| 항목 | 값 |
|---|---|
| Document ID | DOC-AI-011 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | AI Reviewer / Security Reviewer |
| 기준일 | 2026-07-14 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Confidence model

Confidence is capability-specific evidence for routing and communication. It is not fact probability, verification, permission or approval. Every material output includes a band, reason codes, basis/type and confidence-policy version.

## Confidence scale

| Band | Meaning | Default route |
|---|---|---|
| HIGH | evaluation shows strong reliability for this field/capability/cohort and no blocking conflict | draft may proceed to normal human/application review; never authority bypass |
| MEDIUM | usable suggestion with meaningful uncertainty | human review required before business use |
| LOW | unreliable/insufficient/conflicting evidence | block automated use; manual correction/review |
| UNKNOWN | confidence cannot be calculated or output unsupported/out-of-distribution | reject automated use; fallback/escalate |

If numeric scores are exposed internally, their range, calibration dataset, mapping to bands and interpretation are versioned per capability. No universal numeric threshold is approved in Phase 5.

## Validation layers

| Layer | Examples | Failure effect |
|---|---|---|
| Envelope | job/result/schema/correlation/version | reject result |
| Syntax/schema | required fields, types, enums, additional properties | reject or safe field-level quarantine only if contract allows |
| Reference | input/evidence/entity IDs and versions | reject stale/missing reference |
| Semantic | units, currency, hierarchy, contradictions, score math | block affected output/use |
| Authority | prohibited approval/mutation/action | reject, security event if attempted |
| Privacy/security | data class, sensitive output, injection/unsafe content | reject/quarantine/escalate |
| Confidence | band/reasons/calibration version/material-field coverage | route or reject |
| Business policy | eligibility, freshness, audience, hard constraints | deterministic application decision |

## Threshold policy

Threshold is a versioned tuple: `capability + field/risk class + cohort/language + metric + value/band + required route + owner + evidence`. Thresholds cannot be copied between capabilities/providers without evaluation. Lowering a threshold requires review, regression evidence and rollback; it cannot relax constitutional controls.

## Automatic rejection

Automatic rejection occurs for:

- missing/unknown schema or capability version
- unresolvable/stale input or evidence reference
- prohibited action/authority field
- invalid enum/type/range or unknown executable instruction
- sensitive data policy violation or injection/unsafe-output signal
- missing confidence for material output
- `UNKNOWN` confidence or `LOW` where policy disallows draft use
- contradictions designated blocking
- model/provider/config not approved for capability/data class

Rejected AI output does not become Candidate/Requirement/Match authority. Minimal failure evidence is retained safely.

## Human review

Human review is mandatory for MEDIUM/LOW (when draft display is allowed), material/canonical/external-use implications, conflicts, sensitive data and sampled HIGH outputs. Reviewer can accept-as-draft, correct, reject, request evidence or escalate; only a separate authorized business action changes data.

## Quality metrics

- schema/semantic validation pass and rejection reasons
- per-field precision/recall/F1 or task-appropriate quality
- calibration error/reliability by band and cohort
- human correction/acceptance/escalation and time
- false merge, hard-constraint violation, unsafe/prohibited output, privacy leakage
- out-of-distribution/unknown rate, fallback success and drift

Metric definitions, evaluation dataset/version, sample size and confidence interval are recorded. Aggregate quality cannot hide critical cohort or safety failure.

## Release gate

No capability is release-ready without approved threshold evidence, negative tests, human-review route, fallback, observability, rollback and zero unresolved critical authority/privacy findings.

> **OPEN DECISION:** numeric thresholds, evaluation sample/cohorts, HIGH-output sampling, calibration method and release-blocking metric limits.

