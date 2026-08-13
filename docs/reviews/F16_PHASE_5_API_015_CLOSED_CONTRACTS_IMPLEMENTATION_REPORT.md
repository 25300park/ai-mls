# F16 Phase 5 API-015 Closed Contracts Implementation Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-091 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Development Reviewer |
| 완료일 | 2026-08-14 |
| Brief | F16-PHASE-5 — API-015 Closed Contracts Implementation |

## Final Recommendation

`APPROVE_F16_PHASE_5_API_015_CONTRACTS`

API-015 closed contract layer는 구현·검증됐다. 이 승인은 FEAT-016 전체 완료가 아니며 persistence, live authority, Runtime/HTTP, Console write 및 Phase 6 구현을 승인하지 않는다.

## 1. Objective

Phase 4 canonical alignment를 기준으로 API-015의 단일 closed operation surface, command/query 분리, closed request/response schema, Session-derived Actor, privileged human/MFA 및 two-person precondition, expected version, idempotency fingerprint, safe error/concealment, immutable DTO와 ownership boundary를 구현했다.

Baseline은 branch `main`, commit `b618ca23219e7e2ca4675970b98e61793f767e4f`, initial working tree clean이며 Node.js `v24.18.0`, pnpm `11.9.0`을 사용했다.

## 2. Documents read

- [F16 Phase 4 Canonical Alignment](F16_PHASE_4_CANONICAL_SCOPE_ALIGNMENT_REPORT.md)
- [FEAT-016 Traceability Matrix](../implementation/FEAT016_TRACEABILITY_MATRIX.md)
- [Decision Register](../00_DECISION_REGISTER.md), [Change Request Register](../00_CHANGE_REQUEST_REGISTER.md), [API Registry](../00_API_REGISTRY.md), [Canonical Traceability Matrix](../00_CANONICAL_TRACEABILITY_MATRIX.md)
- [Administration and Audit API](../book-6/10_ADMIN_AND_AUDIT_API.md), [API Registry](../book-6/16_API_REGISTRY.md), [Screen Registry](../book-7/15_SCREEN_REGISTRY.md), [Security Registry](../book-8/15_SECURITY_REGISTRY.md)
- [Developer Registry](../book-11/15_DEVELOPER_REGISTRY.md), [Feature Breakdown](../book-12/03_FEATURE_BREAKDOWN.md), [Implementation Registry](../book-12/15_IMPLEMENTATION_REGISTRY.md)
- 기존 구현: `modules/administration/`, `modules/authorization/`, `modules/identity/`, `apps/api/`

## 3. Files created

- [administration-api-contracts.ts](../../apps/api/src/administration-api-contracts.ts): API-015 operation registry, request/result/view contracts, Session boundary, error/concealment 및 deterministic fingerprint.
- [administration-api-validation.ts](../../apps/api/src/administration-api-validation.ts): closed object, ID, version, strict ISO timestamp, reason 및 evidence validation.
- [administration-api-contracts.test.ts](../../apps/api/src/administration-api-contracts.test.ts): direct contract/security/immutability regression.
- [administration-api-architecture.test.ts](../../apps/api/src/administration-api-architecture.test.ts): ownership 및 forbidden dependency/operation 검증.
- 이 completion report.

## 4. Files modified

- [apps/api/src/index.ts](../../apps/api/src/index.ts): API-015 closed contracts와 validation의 public export만 추가했다.
- [FEAT-016 Traceability Matrix](../implementation/FEAT016_TRACEABILITY_MATRIX.md): Phase 5 contract evidence와 `F16-GAP-005 = CONTRACT_LAYER_RESOLVED`만 반영했다.

`package.json`과 `pnpm-lock.yaml` 변경은 0이다. FEAT-015 production, Architecture Bible, Registry, database, migration, Runtime, HTTP 및 Console 파일은 수정하지 않았다.

## 5. Key decisions added

새 Architecture Decision은 추가하지 않았다. Phase 4의 `AO-16-01`~`AO-16-05`, `DEC-114`, `CR-026`을 그대로 적용했다.

### Operations implemented

- Role Assignment: propose, approve, reject, revoke, read, list.
- Role, Policy, Team/scope: read/list 및 canonical governed change proposal/approval/rejection.
- Source Registry: governance-only read/list/propose/approve/reject/pause-block-retire transition.
- Publication Target: governance-only read/list/propose/approve/reject/pause-retire transition.
- Administration proposal/decision: bounded list/read contracts.

Command와 query operation set은 disjoint이며 unknown operation과 unknown envelope/payload/nested field는 fail closed 한다.

### Actor/session and privileged governance

- 권위 Actor는 injected read-only Session resolver가 반환한 current `SessionContext`만 사용한다.
- resolver failure, missing/inactive/expired/absolute-expired Session, non-human command Actor 및 inconsistent MFA assurance는 fail closed 한다.
- body actor/role/capability/MFA claim은 schema에서 거부하며 authority로 사용하지 않는다.
- privileged command descriptor는 human Actor, MFA, reason, expected version, idempotency, current policy/live authorization 및 independent proposal precondition을 명시한다.
- proposal evidence는 `proposalId`, proposer, resource, scope, change, version, reason/evidence reference를 보존하고 self-approval을 거부한다.
- proposal result는 `PROPOSED`이며 authority가 아니다. Approval result만 atomic activation 의미의 `ACTIVE`를 표현한다.

### Closed schemas, version and idempotency

- operation별 command/query schema, resource/scope/status vocabulary와 response result invariant를 exact-key validation으로 제한했다.
- authority-changing command는 canonical expected version과 idempotency key를 요구한다.
- fingerprint는 tenant, operation과 normalized intent를 SHA-256으로 묶으며 set-like array 순서가 달라도 동일 intent로 정규화한다.
- response/view/collection은 deep-clone 및 deep-freeze되어 caller mutation과 authoritative state 공유를 차단한다.

### Safe errors and concealment

외부 error vocabulary는 `AUTHENTICATION_REQUIRED`, `AUTHORIZATION_DENIED`, `NOT_FOUND`, `VALIDATION_FAILED`, `SELF_APPROVAL_FORBIDDEN`, `MFA_REQUIRED`, `VERSION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `INVALID_STATE`, `POLICY_DENIED`, `INTERNAL_ERROR`로 제한했다. 접근 불가와 존재하지 않음은 동일한 `NOT_FOUND` 외부 object로 conceal하며 stack, path, secret, Session token, raw evidence 및 내부 authorization graph를 반환하지 않는다.

### Ownership boundary

Source contract는 governance metadata만 다루고 ingestion/crawler/parser/scheduler/connector 실행을 포함하지 않는다. Publication Target contract는 governance만 다루고 publish/republish/withdraw/reconciliation/recovery/connector command를 포함하지 않는다. Retention/Legal Hold mutation, AI authority, physical persistence, Repository/UoW, Event/Projection mutation, Runtime/HTTP 및 UI write는 구현하지 않았다.

## 6. Open decisions

- **OPEN DECISION:** physical database, ORM 및 migration framework는 기존 deferred 상태를 유지한다.
- **OPEN DECISION:** development-only transitive `brace-expansion` toolchain advisory remediation 시점은 별도 Architecture Owner dependency review 대상이다.

## 7. Inconsistencies found

구현을 차단하는 canonical inconsistency는 발견되지 않았다. 독립 리뷰에서 발견된 Session expiry, response closure, result semantics, scope, concealment, descriptor, fingerprint 및 ISO timestamp findings는 TDD로 수정했고 최종 finding은 0이다.

## 8. Validation performed

| 검증 | 결과 |
|---|---|
| Focused API-015 + existing Administration | PASS — 30/30 |
| Full regression | PASS — 627/627, failed/skipped 0 |
| `pnpm.cmd lint` | PASS |
| `pnpm.cmd typecheck` | PASS |
| `pnpm.cmd build` | PASS |
| `pnpm.cmd verify` | PASS |
| Architecture checksum | PASS — 153/153, `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778` |
| Gitleaks 8.30.1 | PASS — findings 0 |
| `pnpm.cmd audit --prod` | PASS — exit 0, known vulnerabilities 0 |
| `pnpm.cmd audit` | REVIEWED — exit 1, 기존 승인 dev-only transitive High 4건만 존재 |
| `git diff --check` | PASS |
| Independent review | READY — Critical 0 / Important 0 / Minor 0 |

### Dependency audit evidence

Production audit는 공식 `https://registry.npmjs.org/` advisory endpoint에서 알려진 vulnerability 0건이다. Full audit은 기존 승인 baseline과 동일한 development-only transitive `brace-expansion` finding만 보고했다.

| Advisory | Package path | Severity | Scope | Disposition |
|---|---|---|---|---|
| `GHSA-mh99-v99m-4gvg` | `eslint → minimatch → brace-expansion` 1.x | High | development / transitive | previously approved |
| `GHSA-mh99-v99m-4gvg` | `typescript-eslint → typescript-estree → minimatch → brace-expansion` 5.x | High | development / transitive | previously approved |
| `GHSA-rgw5-rvv9-x895` | `eslint → minimatch → brace-expansion` 1.x | High | development / transitive | previously approved |
| `GHSA-rgw5-rvv9-x895` | `typescript-eslint → typescript-estree → minimatch → brace-expansion` 5.x | High | development / transitive | previously approved |

신규 미승인 High/Critical, direct dependency finding 및 production path는 0이다. Audit fix, dependency update, manifest 변경 또는 lockfile 변경을 수행하지 않았다.

## 9. Known limitations

- `F16-GAP-003`: live authority resolver integration은 미구현이다.
- `F16-GAP-004`: durable authoritative state와 Repository/UoW는 미구현이다.
- `F16-GAP-006`: durable idempotency는 미구현이다.
- `F16-GAP-007`: atomic audit persistence는 미구현이다.
- `F16-GAP-008`: Runtime/HTTP adapter는 미구현이다.
- `F16-GAP-009`: UI-006/UI-036 integration과 controlled write는 미구현이다.
- `F16-GAP-010`: full FEAT-016 integration/security/UAT acceptance는 미구현이다.
- 기존 approved development-only transitive audit risk는 남아 있다.

## 10. Next brief prerequisites

다음 권장 Brief는 `F16-PHASE-6 — Administration Repository / UoW Ports`다. Architecture Owner가 Phase 5를 승인한 뒤 별도로 시작해야 한다. Phase 6, FEAT-016 Runtime/HTTP, Console write, physical adapter 및 FEAT-015 변경은 시작하지 않았다.

## Completion statement

`F16-GAP-005`의 API-015 contract layer만 `CONTRACT_LAYER_RESOLVED`로 기록한다. 정확히 한 개의 local completion commit이 이 report와 evidence를 포함하며 Push 및 Git tag는 수행하지 않는다.
