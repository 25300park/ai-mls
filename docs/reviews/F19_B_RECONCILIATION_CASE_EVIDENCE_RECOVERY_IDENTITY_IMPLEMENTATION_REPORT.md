# F19-B Reconciliation Case / Evidence / Recovery Identity Implementation Report

## 1. Objective

Final Recommendation: `APPROVE_F19_B_RECONCILIATION_CASE_EVIDENCE_RECOVERY_IDENTITY_BOUNDARY`

F19-B 승인 범위인 durable recovery case linkage, 별도 append-only reconciliation finding/recovery disposition, domain-owned recovery execution identity binding 및 closed in-process application boundary를 구현·검증했다. F19 전체 완료나 F19-C 시작을 의미하지 않는다.

## 2. Documents read

- Architecture Owner 승인 `F19 Canonical Design Amendment V1`
- Architecture Owner 승인 `F19-B Decision / Recovery Binding Clarification`
- [F19-A Inventory / Gap Report](F19_A_RECONCILIATION_RECOVERY_RETRY_CANONICAL_INVENTORY_GAP_REPORT.md)
- [F19 Canonical Design V1](../implementation/F19_RECONCILIATION_RECOVERY_CANONICAL_DESIGN_V1.md)
- [F19-B Implementation Plan](../implementation/F19_B_RECONCILIATION_BOUNDARY_IMPLEMENTATION_PLAN.md)
- [Architecture v1.1 Baseline Manifest](../freeze/ARCHITECTURE_V1_1_BASELINE_MANIFEST.md)

## 3. Files created

- `docs/implementation/F19_RECONCILIATION_RECOVERY_CANONICAL_DESIGN_V1.md`
- `docs/implementation/F19_B_RECONCILIATION_BOUNDARY_IMPLEMENTATION_PLAN.md`
- `docs/implementation/FEAT019_TRACEABILITY_MATRIX.md`
- `docs/reviews/F19_A_RECONCILIATION_RECOVERY_RETRY_CANONICAL_INVENTORY_GAP_REPORT.md`
- `docs/reviews/F19_B_RECONCILIATION_CASE_EVIDENCE_RECOVERY_IDENTITY_IMPLEMENTATION_REPORT.md`
- `modules/recovery/src/index.ts`
- `modules/recovery/src/recovery-orchestration-contracts.ts`
- `modules/recovery/src/recovery-orchestration-service.ts`
- `modules/recovery/src/recovery-durable-persistence.ts`
- `modules/recovery/src/recovery-orchestration-service.test.ts`
- `modules/recovery/src/recovery-durable-persistence.test.ts`
- `modules/recovery/src/recovery-orchestration-architecture.test.ts`

## 4. Files modified

기존 tracked file 수정은 0이다. Dependency manifest와 lockfile 변경도 0이다.

## 5. Key decisions added

- `recoveryCaseId`는 domain truth가 아닌 immutable cross-domain orchestration/evidence linkage다.
- `RECONCILIATION_FINDING`과 `RECOVERY_DISPOSITION`은 서로 대체하지 않는 별도 append-only record다.
- `UNRESOLVED` finding 뒤에는 새 evidence 기반 finding을 append할 수 있지만 terminal finding은 교체할 수 없다.
- effect-producing authorization은 `recoveryId`, original origin identity, terminal decision version, finding/disposition record, action type, domain-created execution identity, idempotency, evidence와 trusted actor/time을 한 SQLite transaction으로 결합한다.
- `AUTHORIZE_RECOVERY`는 외부 execution을 수행하지 않는다. API-014/API-018 planner가 identity를 만들고 injected validator가 shape/newness를 검증한다.
- create/read/resolve/authorize 결과는 closed safe view이며 tenant/scope/actor authority metadata를 외부 DTO로 재노출하지 않는다.

## 6. Open decisions

- F19-C의 Publication `RESOLVE_RECONCILIATION` vs `RECOVER_PUBLICATION` 실행 의미 연결
- F19-D의 API-018 new invocation handoff 및 executor SoD 재검증
- F19-E의 API-019 unresolved technical conflict business handoff
- F19-F/H의 composed nested ambiguity 및 final hardening

이 항목들은 현재 구현 blocker가 아니라 승인된 후속 phase 경계다.

## 7. Inconsistencies found

초기 구현 중 승인 원문 재대조로 `reasonCode`, 별도 `recoveryActionType`, canonical `recoveryDisposition` 필드명 및 closed response 누락을 발견했다. 완료 전에 RED assertion을 추가하고 계약, durable schema와 service view를 정렬했다. 최종 unresolved Critical/Important inconsistency는 0이다.

## 8. Validation performed

| Gate | Result |
|---|---|
| Node / pnpm runtime | Node `v24.18.0`; pnpm `11.9.0` |
| Focused F19-B tests | 12/12 PASS |
| Affected Publication/Connector/API-019 regression | 52/52 PASS |
| Full regression | 921/921 PASS |
| Lint | PASS |
| Typecheck | PASS |
| Build | PASS |
| Verify-equivalent local gate | PASS — lint + typecheck + build + compiled full tests |
| Architecture checksum | 153/153 PASS; `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778` |
| Gitleaks current tree | 0 findings |
| `git diff --check` | PASS |
| Dependency/lockfile changes | 0 |
| Production audit | PASS — exit 0; no known vulnerabilities |
| Full audit | exit 1 — 기존 승인 development-only transitive `brace-expansion` High 4건 |
| New unapproved High/Critical | 0 |

`pnpm.cmd build`의 최초 RED 확인 시 Corepack/pnpm이 registry metadata fetch 및 install 경로를 시도하여 당시 승인 경계를 벗어났으므로 재시도하지 않았다. 이후 모든 로컬 gate는 이미 설치된 repository-pinned TypeScript/ESLint와 compiled test runner로 수행했다.

F19-B 전용 audit network 승인 후 `registry.npmjs.org`에 dependency/lockfile audit metadata만 전송했다.

| Advisory | Package / dependency path | Severity / classification | Result |
|---|---|---|---|
| `GHSA-mh99-v99m-4gvg` | `eslint → minimatch → brace-expansion@1.1.16` — 36 paths | High / development-only transitive | 기존 승인 finding, unchanged |
| `GHSA-mh99-v99m-4gvg` | `typescript-eslint → typescript-estree → minimatch → brace-expansion@5.0.7` — 7 paths | High / development-only transitive | 기존 승인 finding, unchanged |
| `GHSA-rgw5-rvv9-x895` | 동일 ESLint 1.x path — 36 paths | High / development-only transitive | 기존 승인 finding, unchanged |
| `GHSA-rgw5-rvv9-x895` | 동일 typescript-eslint 5.x path — 7 paths | High / development-only transitive | 기존 승인 finding, unchanged |

Audit 전후 `package.json` SHA-256은 `666E5CBA934BE459D0BC0C43635B05A39D33162FE02D0550927F7F706871F9B9`, `pnpm-lock.yaml` SHA-256은 `245E7A25E2B2D4939BF2DA84115061E0BAF9997D1C5D175F6A32D58F94C22A11`로 동일하다. Dependency/lockfile 변경은 0이다.

## 9. Security, atomicity and bounded review

- Trusted Session-derived identity, current session lifetime/assurance, tenant/scope concealment, purpose, injected live authorizer, human+MFA 및 evidence-submitter SoD를 확인했다.
- body actor/authority claim과 unknown nested field는 closed parser에서 거부한다.
- stale version, idempotency collision, terminal finding replacement, malformed/non-new domain identity 및 cross-scope lineage는 mutation 없이 fail closed한다.
- injected idempotency persistence failure는 finding, evidence와 version을 전부 rollback한다.
- append-only database trigger는 evidence/finding/disposition/recovery/idempotency의 update/delete를 차단하고 case identity 변경/삭제도 차단한다.
- provider/network/credential, API/HTTP, Publication/Connector/API-019 store import와 external execution path는 0이다.

Fresh bounded review 결과: Critical 0, Important 0, Minor 0, `READY`.

## 10. Known limitations and next brief prerequisites

- F19-B는 in-process orchestration/persistence boundary만 제공한다. Runtime/HTTP/public API는 추가하지 않았다.
- Recovery authorization 뒤 current live execution prerequisite 및 resolver/executor SoD 재검증은 owning API-014/API-018 handoff phase에서 수행해야 한다.
- Full audit의 기존 승인 development-only transitive High 4건은 Production vulnerability가 아니며 F19-B 범위에서 dependency를 변경하지 않았다.
- Commit: 본 report와 verified change set을 포함하는 승인된 단일 local F19-B commit이며 full hash는 Git metadata로 확인한다.
- Push: `NOT_PERFORMED`
- Main workspace: `UNCHANGED`
- F19-C: `NOT_STARTED`

다음 단계는 Architecture Owner가 본 evidence를 검토한 뒤 별도 승인하는 F19-C다. 현재 단계는 보고서 제출 후 중단한다.
