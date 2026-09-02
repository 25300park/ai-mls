# F19 Reconciliation / Recovery / Retry Canonical Design V1

| 항목 | 값 |
|---|---|
| Version | v1.0 |
| Status | APPROVED |
| Owner | Architecture Owner |
| Scope | F19-B~F19-H canonical baseline |
| API IDs added | 0 |
| Public HTTP operations added | 0 |

## 1. Purpose

F19은 API-014 Publication truth, API-018 Connector execution truth, API-019 external mapping/evidence truth를 대체하지 않고 reconciliation, recovery authorization 및 execution identity 사이의 durable orchestration linkage만 제공한다.

## 2. Recovery case identity

`recoveryCaseId`는 cross-domain orchestration/evidence linkage identity다. `Publication.ReconciliationCase.id`를 universal identity로 재사용하지 않는다.

Immutable case fields:

- `recoveryCaseId`
- `resourceType`
- `resourceId`
- `originDomain`: `PUBLICATION | CONNECTOR | EXTERNAL_INTEGRATION`
- `originIdentity`
- `tenantId`
- `scopeRef`
- `parentRecoveryCaseId?: string`
- `createdAt`

`originIdentity`는 Publication의 `reconciliationCaseId + attemptId`, Connector의 `invocationId`, External Integration의 `integrationContractId`와 적용 가능한 `mappingId | observationId | conflictEvidenceId`를 결합한다.

## 3. Separate append-only decisions

`RECONCILIATION_FINDING`과 `RECOVERY_DISPOSITION`은 별도 append-only record다.

Finding values:

- `CONFIRMED_EXECUTED`
- `CONFIRMED_NOT_EXECUTED`
- `UNRESOLVED`

Disposition values:

- `RECOVERY_AUTHORIZED`
- `NO_RECOVERY_REQUIRED`
- `RECOVERY_REJECTED`

Case status는 `OPEN | RESOLVED`만 사용한다. `UNRESOLVED`는 `OPEN`, 두 confirmed finding은 `RESOLVED`다. Recovery disposition은 finding을 변경하지 않는다.

`RESOLVE_RECOVERY_CASE` closed request는 `recoveryCaseId`, `expectedVersion`, `finding`, `evidenceRefs`, `idempotencyKey`, `reasonCode`만 수용한다. `UNRESOLVED` 뒤에 새 evidence가 확립되면 새 finding record를 append할 수 있지만 terminal finding은 교체할 수 없다. Closed response는 case identity, finding, case status/version, finding record/evidence 및 nullable resolution timestamp만 반환한다.

## 4. Recovery binding

Effect-producing recovery는 immutable `recoveryId`에 다음을 원자적으로 결합한다.

- `recoveryCaseId`
- original origin identity
- terminal finding decision version
- `reconciliationFindingRecordId`
- `recoveryDispositionRecordId`
- `recoveryActionType`: `PUBLICATION_RECOVERY | CONNECTOR_REEXECUTION`
- `recoveryExecutionIdentity`
- `idempotencyKey`
- evidence references
- `authorizedBy`
- `authorizedAt`

`AUTHORIZE_RECOVERY` closed request는 `recoveryCaseId`, `expectedVersion`, `recoveryDisposition`, 별도 `recoveryActionType`, `recoveryExecutionIdentity`, `evidenceRefs`, `idempotencyKey`만 수용한다. `PUBLICATION_RECOVERY` identity는 `{ attemptId, commandId }`, `CONNECTOR_REEXECUTION` identity는 `{ invocationId }`다. Action type은 identity 내부 필드가 아니다. Identity는 owning API-014/API-018 planner가 생성한다. F19은 injected domain validator로 newness와 shape를 검증하고 저장할 뿐 domain identity를 생성하지 않는다.

## 5. Closed internal commands

- `CREATE_RECOVERY_CASE`
- `RESOLVE_RECOVERY_CASE`
- `AUTHORIZE_RECOVERY`
- `READ_RECOVERY_CASE`

새 API ID나 public HTTP operation을 만들지 않는다. F19-B는 in-process application/persistence boundary만 구현한다.

`CREATE_RECOVERY_CASE` response는 `recoveryCaseId`, `status`, `version`, safe `evidenceRefs`, `createdAt`만 반환한다. `READ_RECOVERY_CASE`도 origin reference, status, finding/recovery reference, safe evidence, version/timestamps로 제한하며 tenant/scope/actor 내부 authority metadata를 DTO로 노출하지 않는다.

## 6. Authority and SoD

- Evidence submitter는 business finding을 결정하지 못한다.
- Resolver는 authenticated human, tenant/scope/purpose, capability, MFA, expected version과 trusted evidence를 만족해야 한다.
- Recovery disposition actor는 effect executor와 분리된다. 실제 executor 분리는 F19-C/D execution handoff에서 재검증한다.
- AI, API-017, API-018, API-019, connector/provider 및 body claims는 recovery authority를 생성하지 못한다.

## 7. Persistence

F19-B는 Node.js `node:sqlite` 기반 durable orchestration store 하나만 추가한다. Case identity/status/version, evidence linkage, append-only findings/dispositions, recovery binding과 idempotency만 저장한다. Publication aggregate/receipt, Connector invocation/checkpoint, API-019 mapping/observation은 복제하지 않는다.

## 8. Safety

- Same idempotency key + same fingerprint returns prior result.
- Same key + different fingerprint returns `IDEMPOTENCY_CONFLICT` without mutation.
- Expected-version mismatch returns `VERSION_CONFLICT`.
- Finding/disposition/evidence/idempotency/recovery binding is append-only.
- Terminal finding is never replaced.
- `RECOVERY_AUTHORIZED` requires terminal `CONFIRMED_NOT_EXECUTED` by default and a validated new execution identity.
- Authorization itself performs no external execution.
- Nested ambiguity creates a new child case; parent history is immutable.

## 9. Phase boundary

F19-B implements only case/evidence/finding/disposition/recovery identity persistence and its internal application boundary. Publication recovery execution, Connector reexecution, API-019 handoff, Runtime/HTTP/API-017 and F19-H hardening remain outside this phase.
