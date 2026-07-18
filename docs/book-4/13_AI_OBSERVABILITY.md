# AI Observability

| 항목 | 값 |
|---|---|
| Document ID | DOC-AI-014 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | AI Operations Owner |
| 기준일 | 2026-07-14 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Observability objectives

AI behavior must be traceable enough to diagnose quality, safety, privacy, reliability and cost without turning logs into a second uncontrolled raw-data store. Observability never substitutes for Audit Event or business history.

## AI logging

| Context | Minimum metadata | Excluded by default |
|---|---|---|
| AI Job | capability, correlation, input refs/versions/classes, prompt/config/schema intent, timestamps/status | full raw personal/source content |
| Provider call | approved provider/model, adapter version, attempt, latency, usage units, error/rate category | credentials, unrestricted request/response |
| AI Result | output/schema version, validation, confidence, warning, provider/model/prompt versions | unnecessary generated prose/raw payload |
| Human review | reviewer scope, outcome, correction category, time/escalation | sensitive correction details unless required |
| Fallback | trigger, selected route, result, compatibility/policy | hidden provider switching |

Identifiers are correlation-safe and access-controlled. Model/provider metadata is observable context, not authority.

## Metrics

### Quality and accuracy

- capability-specific field/task metrics and calibration
- schema/semantic validation pass/rejection
- human acceptance/correction/rejection/escalation
- false merge, hard-constraint violation, explanation faithfulness
- drift/out-of-distribution and cohort/language quality

### Latency and reliability

- queue wait, provider and end-to-end latency distributions
- success/timeout/rate-limit/transient/terminal failure
- retry, fallback, manual fallback and backlog age
- provider/model/config version and capability cohorts

### Safety and governance

- prohibited authority/action attempts and validator blocks
- sensitive-data/prompt-injection findings
- outputs missing confidence/evidence/version
- stale-input and unauthorized-capability rejection
- audit/trace completeness

## Cost monitoring

Track capability/provider/model, usage unit, estimated/actual cost where available, retry/fallback amplification, cost per validated/reviewed useful output and budget variance. Cost optimization cannot weaken data minimization, evaluation or controls. Budget alerts/caps and owner are `OPEN DECISION`.

## Monitoring and alerting

| Severity candidate | Example | Response |
|---|---|---|
| CRITICAL | autonomous authority path, sensitive data exposure, unauthorized external effect | disable capability/provider, incident/escalation, preserve minimal evidence |
| HIGH | repeated unsafe output, severe quality regression, audit/validation bypass | stop affected cohort/version, rollback/manual fallback |
| MEDIUM | latency/error/cost threshold breach, localized drift | investigate, route/fallback, review threshold |
| LOW | isolated non-material formatting or expected transient issue | trend and normal remediation |

Exact thresholds and response SLA require operations/security approval.

## Dashboards and review cadence

Views separate capability, provider/model, prompt/config/schema version, language/source/property cohort, reviewer and time. Operational monitoring is continuous where implemented; quality/safety/cost reviews use approved cadence and sufficient sample/evidence. Aggregates must not hide critical subgroup failures.

## Privacy and retention

- log purpose/data class/retention/access owner is explicit.
- raw prompt/output sampling needs separate approval and redaction.
- contact/client/source content is referenced/minimized; unmask/export is audited.
- provider logs and local telemetry deletion/retention are reconciled.
- diagnostic System Error payloads are scrubbed and never store secrets.

## Failure observability

Provider outage, invalid result, retry exhaustion, dead-letter/manual fallback, review backlog, stale result and rollback are linked by correlation to AI Job, AI Result and System Error without duplicating business data.

> **OPEN DECISION:** telemetry platform, metric formulas/thresholds, budget/cost source, alert owner/SLA and diagnostic sampling policy.

