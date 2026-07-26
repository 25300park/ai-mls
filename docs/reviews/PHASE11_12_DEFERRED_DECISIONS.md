# Phase 11-12 Deferred Decision Register — Review Evidence

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-068 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner / Operations Owner / Data Owner |
| 기준일 | 2026-07-26 |
| Artifact type | Freeze-review evidence; not a new canonical Registry |

## 1. Purpose and boundary

Freeze 이후 implementation/release 단계에서 결정하도록 허용된 topic이 logical architecture gap과 분리됐는지 검증한다. 이 문서는 새 Decision ID, provider 선택, schema 또는 runtime configuration을 만들지 않는다.

## 2. Deferred topics

| Deferred topic | Frozen logical constraint | Decision owner | Required future gate/evidence | Current disposition | Freeze gap? |
|---|---|---|---|---|---|
| Physical Payload Schema | closed contract, provenance, classification, version, safe error와 authority boundary 유지 | Data/API/Event Owners | schema proposal, compatibility/security review, CR/ADR where required, tests | DEFERRED | NO |
| Event Serialization | immutable Event ID/order/version/classification and no-authority replay 유지 | Event/Data Owners | serialization contract/version, compatibility, retention/security evaluation | DEFERRED | NO |
| Queue | logical durable job semantics, idempotency, retry/isolation and no business truth 유지 | Architecture/Operations Owners | product evaluation, failure/recovery/security/cost evidence and approval | DEFERRED | NO |
| Event Bus | Event Registry contract, source ownership, ordering and replay guards 유지 | Architecture/Event Owners | topology/product evaluation, delivery/order/security/operations evidence | DEFERRED | NO |
| Event Store | immutable evidence, retention/legal hold, access and replay authorization 유지 | Data/Security/Event Owners | physical model, integrity/retention/recovery evaluation and approval | DEFERRED | NO |
| Worker Topology | worker/service actor has scoped technical execution only; no business authority | Architecture/Operations/Security Owners | concurrency/lease/isolation/capacity/recovery model and tests | DEFERRED | NO |
| Runtime SLO | hard authority/security/privacy guards are not traded for SLO; DEC-062/065 remain UNDER_REVIEW | Business/Operations/Quality Owners | measured baseline, RPO/RTO/SLO approval, exercise and release evidence | DEFERRED | NO |
| Product Selection | provider-neutral contracts and isolation retained; PostgreSQL/AI/cloud/queue/tool candidates are not adopted silently | Architecture and specialist owners | alternatives, cost/quality/security/lock-in/rollback evaluation, ADR/approval | DEFERRED | NO |

## 3. Related approved open references

- ADR-003 / DEC-013 PostgreSQL preferred: `IN REVIEW / UNDER_REVIEW` and database implementation blocking.
- DEC-062 provisional recovery objectives: `UNDER_REVIEW` and recovery acceptance blocking.
- DEC-065 provisional internal SLO: `UNDER_REVIEW` and service acceptance blocking.
- AI/provider/model/prompt/threshold choices remain provider-neutral and require applicable MDR/ADR approval.
- Queue, event transport/store, worker and operational products remain logical abstractions until approved selection.

## 4. Non-gap criteria

A deferred topic is not an Architecture Gap only while all are true:

1. logical purpose, owner, authority and security boundary are fixed;
2. implementation cannot silently select a product or change business meaning;
3. affected Registry/API/Workflow/Test trace remains explicit;
4. future gate, evidence and rollback/change process are named;
5. missing decision fails closed and does not authorize FEAT-015 behavior.

## 5. Escalation triggers

다음은 deferred 범위를 벗어나 Architecture Change Request가 필요하다.

- canonical Event/Projection/Operation identity or ownership change;
- business authority assigned to queue, worker, event, projection, connector or provider;
- public API or Workflow lifecycle change;
- classification/privacy/retention weakening;
- provider-specific business rule or non-reversible lock-in without approval;
- numeric threshold/SLO used to bypass hard guardrail.

## 6. Validation result

| Check | Result |
|---|---|
| Required deferred topics | 8/8 recorded |
| Owner identified | 8/8 |
| Logical boundary identified | 8/8 |
| Future gate/evidence identified | 8/8 |
| Product/provider silently selected | 0 |
| Business authority created | 0 |
| Counted as Phase 11-11 architecture gap | 0 |

## 7. Recommendation

`MODIFY_AND_REVIEW`

Deferred separation itself is acceptable and is not the cause of freeze failure. Overall recommendation remains tied to unresolved non-deferred gaps in the Freeze Report.
