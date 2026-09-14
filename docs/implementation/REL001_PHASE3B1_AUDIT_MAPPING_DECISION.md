# REL-001 Phase 3B.1 API-017 Audit Mapping Decision

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-138 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Audit Owner / API Owner / Security Owner |
| 기준일 | 2026-09-14 |

## 1. Decision

Phase 2의 approved source/event tuple에는 API-017 job lifecycle이 없다. `EVT-010`–`012`, Core domain events, Publication/Connector/Recovery evidence는 아래 의미를 대신하지 않는다. 따라서 required 9 points는 모두 `NEW_AUDIT_EVENT_TYPE_REQUIRED`이며 기존 mapping resolved count는 `0/9`다.

API-017은 event type을 발명하거나 final Audit Event를 직접 작성할 수 없다. 이 문서는 Audit Owner에게 필요한 tuple amendment를 요청하며 승인 자체를 주장하지 않는다.

## 2. Separate AO amendment request

Audit Owner amendment는 각 행에 대해 exact `source`, `eventType`, `action`, `targetType`, `category`, `decision`, `outcome`, safe evidence fields와 visibility binding을 승인해야 한다. 이름과 ID는 이 Phase 3B.1 문서에서 제안하거나 선점하지 않는다.

| Required point | Required semantic evidence | Classification | Status |
|---|---|---|---|
| submit | initiating principal, tenant/scope, input fingerprint, purpose/policy, job identity | `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `BLOCKED` |
| claim | not applicable to selected single-worker model | `NOT_APPLICABLE` candidate | `AO_CONFIRMATION_REQUIRED` |
| start | `jobId + attempt`, executor provenance, source chronology | `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `BLOCKED` |
| heartbeat | not applicable to selected no-lease model | `NOT_APPLICABLE` candidate | `AO_CONFIRMATION_REQUIRED` |
| result | immutable result ref/checksum, attempt, handler/downstream evidence | `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `BLOCKED` |
| fail | safe normalized classification/ref, attempt, provenance | `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `BLOCKED` |
| cancel | control actor, reason reference, expected version, resulting status | `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `BLOCKED` |
| expire | deadline/policy chronology and resulting terminal status | `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `BLOCKED` |
| retry | actor, predecessor eligibility/version, successor identity, policy | `NEW_AUDIT_EVENT_TYPE_REQUIRED` | `BLOCKED` |

Phase 3B의 baseline classification `9 NEW`는 AO가 claim/heartbeat N/A를 승인하기 전까지 보존한다. 따라서 summary는 여전히 `MAPPED_EXISTING_EVENT=0`, `NOT_APPLICABLE=0`, `NEW_AUDIT_EVENT_TYPE_REQUIRED=9`, resolved `0/9`다.

## 3. Materialization boundary

승인 뒤 API-017 mutation과 enriched `v2` audit intent는 owner-local transaction에서 원자적으로 commit한다. API-016만 final append-only Audit Event를 materialize한다. `occurredAt`은 API-017 source chronology, `materializedAt`은 API-016 processing chronology다. historical principal을 current Session/worker에서 재구성하지 않는다.

Materialization failure는 Job mutation과 이미 commit된 intent를 삭제하지 않는다. Duplicate logical intent는 final event를 추가하지 않고 conflicting content는 fail closed한다. Sensitive/raw failure나 result content는 intent/final event에 포함하지 않는다.

## 4. Blocking effect

Submit, cancel, retry 및 internal start/result/fail/expire는 audit mapping 승인 전 구현할 수 없다. Read operations는 중요한 조회 audit이 별도 정본에서 요구될 경우 그 요구를 따라야 하지만, 이 문서가 새 read audit event를 추가하지 않는다.

Required next approval: `API-017 AUDIT EVENT VOCABULARY / V2 INTENT MAPPING AMENDMENT`.
