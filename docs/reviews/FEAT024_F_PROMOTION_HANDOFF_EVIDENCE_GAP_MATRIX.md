# FEAT-024-F Promotion Handoff Evidence Gap Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-152 |
| 문서 버전 | v1.0 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner |
| 기준 커밋 | `55c51b3cc76cedfde29f22fd6f0b3ca5564a7fc3` |

## 1. Objective

정확히 승인된 release candidate를 후속 deployment 경계에 전달할 수 있는지 판정하는 read-only `PromotionHandoffEvidence` 경계를 정의한다. Promotion handoff는 deployment 실행, 환경 변경 또는 deployment authority가 아니다.

## 2. Canonical evidence inventory

| Evidence area | Existing source of truth | Current state | FEAT-024-F disposition |
|---|---|---|---|
| Candidate identity | `release-candidate-artifact.ts` 및 REL-001 candidate manifest | REL-001, Staging, commit/artifact/candidate fingerprint가 immutable하게 결속됨 | Exact candidate binding을 재검증한다 |
| Acceptance manifest | `release-evidence-manifest.ts` | acceptance result, actor/time provenance, readiness refs, deterministic manifest fingerprint 제공 | `ACCEPTED`만 handoff 가능하다 |
| Durable manifest authority | `DurableReleaseAcceptanceManifestStore` | candidate, manifest, replay, append-only lineage/history를 보존 | Resolver가 authoritative exact manifest와 full history를 읽는다 |
| Acceptance authority provenance | `ReleaseAcceptanceAuthorityService` | trusted Session actor, `release.accept`, MFA, producer/author SoD 및 `DEPLOYMENT_SOD_HANDOFF` evidence를 기록 | `acceptedBy`와 bounded authority/SoD evidence ref를 handoff에 보존한다 |
| Evidence composition | `ReleaseEvidenceCompositionService` | exact candidate/environment, readiness truth와 five runtime gaps를 deterministic하게 조합 | Current readiness를 authoritative source에서 다시 읽고 rewriting하지 않는다 |
| Deployment/release runbook | `docs/book-9/04_RELEASE_MANAGEMENT.md`, `05_OPERATION_RUNBOOK.md` | missing/failed/stale evidence는 promotion을 중단하고 deployment actor/result는 별도 evidence임 | F는 deployment를 호출하거나 executor를 지정하지 않는다 |
| Environment strategy | `docs/book-9/02_ENVIRONMENT_STRATEGY.md` | immutable artifact identity와 environment gate를 요구하며 REL-001은 Staging에 결속됨 | Environment rebinding을 거부한다 |
| Rollback target semantics | `docs/book-9/04_RELEASE_MANAGEMENT.md`, FEAT-023-F readiness evidence | approved compatible target 및 current integrity 재검사를 요구 | 기존 readiness ref만 소비하며 rollback semantics를 만들지 않는다 |
| CI/CD/deployment handoff contract | Repository에 executable public contract 없음 | public endpoint와 deployment executor가 정의되지 않음 | Internal derived projection만 구현한다 |
| Release receipt/evidence | Acceptance manifest와 append-only evidence refs가 존재 | Deployment receipt는 아직 존재하지 않음 | Acceptance evidence를 deployment receipt로 오인하지 않는다 |

## 3. Exact handoff source of truth

하나의 injected read-only resolver가 다음 authoritative snapshot을 제공한다.

- exact `Rel001StagingCandidate`
- exact `ReleaseAcceptanceManifest`
- 해당 candidate의 complete manifest history
- 현재 authoritative `ReleaseReadinessRef[]`

Caller-authored actor, result, fingerprint, readiness 또는 environment는 입력받지 않는다. 요청 입력은 `releaseCandidateId`와 `acceptanceManifestId`뿐이며 resolver 결과가 유일한 handoff truth다.

## 4. PromotionHandoffEvidence fields

Required canonical fields:

- `releaseCandidateId`
- `acceptanceManifestId`
- `manifestFingerprint`
- `logicalReleaseId`
- `sourceCommitSha`
- `artifactFingerprint`
- `targetEnvironment`
- `acceptanceResult`
- `acceptedAt`
- canonical ordered `readinessRefs`
- `handoffEvidenceFingerprint`

Bounded SoD carry-forward fields:

- `acceptanceActorId`
- `acceptanceAuthorityEvidenceRefs`
- `deploymentSodEvidenceRefs`

이 필드는 후속 deployment 경계가 `deploymentExecutorActorId != acceptanceActorId`를 검증하도록 할 뿐 deployment authority를 생성하지 않는다.

## 5. Durability and replay

Handoff는 authoritative candidate, manifest/history 및 current readiness에서 매번 derived된다. 별도 handoff row, queue, database 또는 lifecycle을 만들지 않는다. 현재 승인된 REL-001 candidate의 commit, repository, branch, artifact, candidate fingerprint를 재검증하며, acceptance manifest identity도 canonical FEAT-024-B 알고리즘으로 재계산한다. 동일 accepted manifest와 동일 canonical readiness refs는 동일 immutable DTO와 동일 `handoffEvidenceFingerprint`를 산출한다. Timestamp는 fingerprint 입력에 추가하지 않는다.

## 6. Validity and invalidation

Valid handoff requires all of the following:

- manifest result is `ACCEPTED` and acceptance actor/time provenance is complete
- candidate, manifest, artifact and Staging environment bindings match exactly
- selected manifest is present in authoritative history and is the latest non-superseded manifest
- manifest fingerprint and identity are internally consistent
- authoritative current readiness set exactly matches the manifest readiness identities and bindings
- every mandatory readiness is `READY` and `FRESH`
- acceptance authority and `DEPLOYMENT_SOD_HANDOFF` evidence refs are present and safe
- no candidate conflict or newer manifest exists

Any failed condition returns `null` (`NONE / NOT_AVAILABLE`) and mutates nothing. `UNKNOWN`, `NOT_READY`, stale readiness and unresolved `DEGRADED` all fail closed. F does not invent a degraded-promotion rule.

## 7. Current REL-001 truth

Current REL-001 remains `INCOMPLETE` with five `INCOMPLETE_RUNTIME_SURFACE` gaps:

1. Admin Console
2. Core APIs / FEAT-001~011 runtime
3. Audit / API-016
4. Jobs / API-017
5. AI advisory executable lifecycle

Therefore current production evidence yields no valid promotion handoff. The positive path uses only the bounded test fixture authorized by the FEAT-024-F Brief and does not enter durable production evidence.

## 8. Unresolved gaps

- Deployment executor identity/authority, CI/CD invocation and deployment receipt remain outside FEAT-024-F.
- Production environment transition semantics remain outside FEAT-024-F.
- No accepted production REL-001 manifest exists; the current truthful result remains `NOT_AVAILABLE`.

These gaps do not require scope expansion for the derived read-only F boundary.

## 9. Scope protection

New API IDs, roles/capabilities, lifecycle states, persistence systems, deployment queues, external services, credentials, dependencies, registry mutations and deployment/promotion side effects remain zero.
