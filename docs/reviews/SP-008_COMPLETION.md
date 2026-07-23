# SP-008 Completion Report

| 항목 | 값 |
|---|---|
| Document ID | DOC-REVIEW-SP008-COMPLETION |
| Version | v0.1 |
| Status | DRAFT |
| Owner | Development Owner / Architecture Owner |
| Completion date | 2026-07-23 |
| Brief | SP-008 — Client Proposal and Publication Approval |

## AGENTS.md 필수 완료 항목

### 1. Objective

`FEAT-014`의 Client Proposal, immutable Publication Representation Snapshot, Publication Approval, `API-013`, `UI-029`, `UI-030`을 구현하고 human PUA authority, actor-level SoD, immutable audit와 FEAT-015 no-execution boundary를 검증했다.

### 2. Documents read

- [Architecture Decision Register](../governance/ADR_REGISTER.md)
- [Definition of Done](../governance/DEFINITION_OF_DONE.md)
- [Requirements Traceability Matrix](../governance/REQUIREMENTS_TRACEABILITY_MATRIX.md)
- [Model Decision Register](../governance/MODEL_DECISION_REGISTER.md)
- [Canonical Traceability Matrix](../00_CANONICAL_TRACEABILITY_MATRIX.md)
- [Decision Register](../00_DECISION_REGISTER.md)
- [Change Request Register](../00_CHANGE_REQUEST_REGISTER.md)
- [Publication API](../book-6/09_PUBLICATION_API.md)
- [API Registry](../book-6/16_API_REGISTRY.md)
- [Security Registry](../book-8/15_SECURITY_REGISTRY.md)
- [Test Registry](../book-10/15_TEST_REGISTRY.md)
- [Implementation Registry](../book-12/15_IMPLEMENTATION_REGISTRY.md)
- SP-008 Implementation Brief v1.0

### 3. Files created

- `apps/api/src/proposal-approval-api.ts`
- `apps/api/src/proposal-approval-api.test.ts`
- `modules/proposal/src/index.ts`
- `modules/proposal/src/proposal-service.ts`
- `modules/proposal/src/proposal-service.test.ts`
- `modules/publication-approval/src/index.ts`
- `modules/publication-approval/src/publication-approval-service.ts`
- `modules/publication-approval/src/publication-approval-service.test.ts`
- `docs/development/SP008_IMPLEMENTATION_PLAN.md`
- `docs/development/SP008_TEST_EVIDENCE.md`
- `docs/reviews/SP-008_COMPLETION.md`

### 4. Files modified

- `apps/api/src/composition.ts` — `API-013` composition
- `apps/api/src/contracts.ts` — privacy-safe semantic error allowlist
- `apps/api/src/index.ts` — API export
- `modules/authorization/src/authorization-service.ts` — Proposal/Approval capability, privileged human gate, Effective Approval consumer capability
- `docs/governance/REQUIREMENTS_TRACEABILITY_MATRIX.md` — SP-008 implementation evidence only
- `docs/book-12/15_IMPLEMENTATION_REGISTRY.md` — post-freeze progress overlay only

GOV-001에서 이미 존재하던 governance 변경 파일은 보존했으며 SP-008 architecture decision으로 다시 수정하지 않았다.

### 5. Key decisions added

새 architecture decision은 추가하지 않았다. `DEC-096`–`DEC-099`를 구현했으며 representation source는 authoritative/team-bound port, target/channel은 FEAT-015-owned read-only policy port로 유지했다. Effective Approval은 `OPS`/`SVC` consumer의 session Actor와 mandatory duty를 검증하지만 delivery를 실행하지 않는다.

### 6. Open decisions

- **OPEN DECISION:** Production database, target/provider, connector, queue/object storage, deployment topology
- **OPEN DECISION:** FEAT-015 Publication execution, delivery, reconciliation, external reference lifecycle
- **OPEN DECISION:** Production AI provider/model/prompt/threshold; SP-008 business authority에는 사용하지 않음

### 7. Inconsistencies found

None found after GOV-001 alignment. Frozen lifecycle에는 pending Approval의 `EXPIRED` 전이가 없으므로 만료된 `REQUESTED`/`UNDER_REVIEW`는 active queue에서 제외하되 status를 조용히 변경하지 않았다.

### 8. Validation performed

| 검증 | 결과 |
|---|---|
| Focused SP-008 tests | PASS, 30/30 |
| Full regression | PASS, 168/168 |
| Lint | PASS, warnings 0 |
| Typecheck | PASS |
| Build | PASS |
| Aggregate verify | PASS |
| Gitleaks | PASS, actual secrets 0, unexplained findings 0 |
| Dependency audit | PASS — `pnpm audit`, exit code 0, no known vulnerabilities |
| Independent code review | PASS, remaining Critical/Important 0 |

### 9. Known limitations

- 승인된 in-memory persistence approach를 유지하여 database schema/migration은 없다.
- UI는 repository convention에 따른 framework-neutral screen projection이며 complete application-wide accessibility program은 범위 밖이다.
- `CheckEffectiveApproval`은 exact gate result일 뿐 delivery 요청/성공/Publication 상태가 아니다.

### 10. Next brief prerequisites

Architecture Owner가 SP-008 evidence와 implementation을 검토·승인해야 한다. FEAT-015 또는 다음 Sprint는 별도 명시적 authorization 전 시작할 수 없다.

## SP-008 Required Codex Completion Report

### 1. Baseline Verification

- Branch: `main`
- HEAD: `c1cdbfcdd2108c320829df4f5d8ba65f50b56cfd`
- Initial working tree: GOV-001 documentation changes가 존재하여 clean하지 않았고 모두 보존함
- GOV-001: `DEC-096`–`DEC-099` ACCEPTED, `CR-021`–`CR-024` 존재, SP-008 `PLANNED_NOT_IMPLEMENTED` trace 확인
- Frozen baseline: `pnpm verify` PASS, 138/138 tests PASS

### 2. Implementation Summary

Client Proposal lifecycle과 Publication Approval lifecycle을 별도 identity/namespace/authority/purpose/audit로 구현했다. Immutable Representation Snapshot은 authoritative source, checksum, provenance, classification, exact scope에 결합된다. Publication Approval은 independent authoritative entity이며 lifecycle은 `REQUESTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `REVOKED`, `EXPIRED`로 한정된다.

### 3. Files Changed

생성 11개, SP-008 직접 수정 6개다. 상세 목록은 위 `Files created`/`Files modified`에 기록했다. 별도의 GOV-001 미커밋 변경은 사용자 변경으로 보존했다.

### 4. Database or Migration Changes

None. Schema, migration, production adapter 변경이 없다.

### 5. API-013 Operations Implemented

Proposal: Create, Read, Review, Record Share, Record Feedback.

Approval reads: `ReadApproval`, `ListApprovalQueue`, `GetApprovalReviewContext`, `CheckEffectiveApproval`.

Approval mutations: `CreateApprovalRequest`, `AssignOrClaimApprover`, `ReassignOrReleaseApprover`, `DecideApproval`, `RevokeApproval`, `ExpireApproval`.

`CreateRepresentationSnapshot`은 API-013 aggregate preparation boundary로 제공하며 `API-014` behavior는 없다.

### 6. UI-029 Result

Scoped queue, status/assignment/target/date/expiry filter, actor eligibility/conflict, prerequisite validity, expiry risk, requester, representation/checksum, target/channel summary와 claim/release/reassign action projection을 구현했다. Server authorization이 authoritative하며 hidden action에 의존하지 않는다.

### 7. UI-030 Result

Exact representation, checksum, subject revision, target/channel/policy, audience/language, field/media scope, Verification/Permission validity, provenance, masking, SoD, assignment, reason과 Approval action projection을 구현했다. Publication execution/delivery/reconciliation action은 없다.

### 8. Security and SoD Controls

Default Deny, session-derived Actor, team/resource/purpose scope, current PUA eligibility, MFA, reason, expected version, idempotency, classification inheritance, privacy validation, safe errors를 적용했다. Requester/creator/editor/verifier/Permission decision actor/Approval executor/reconciler conflict를 immutable actor ID로 평가한다. MGR/ADM/SEC/REV/SVC/AI/connector는 decision authority를 상속하지 않으며 scheduler eligibility는 expiry에만 사용한다.

### 9. Audit and History Result

Request/prerequisite, assignment/claim/release/reassign, decision/rejection, revoke, expiry, privileged denial, SoD/MFA denial, idempotent replay, Effective Approval gate를 append-only audit로 기록한다. Snapshot, status, assignment, decision history는 immutable/versioned이며 API-016 general audit ownership을 침범하지 않는다.

### 10. Tests Added or Updated

신규 30개: Proposal 3, Publication Approval 20, API/UI 7. 기존 test assertion은 약화하지 않았다.

### 11. Targeted Test Results

PASS, 30/30. `TEST-021`, `TEST-022`, `TEST-033` SP-008 partition과 API-013/UI contract를 포함한다.

### 12. Full Regression Results

PASS, 168/168. Baseline 138개와 SP-008 30개가 모두 통과했다.

### 13. Verification, Type, Lint and Build Results

`pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm verify` 모두 PASS. Lint warning 0.

### 14. RTM and Documentation Updates

[Governance RTM](../governance/REQUIREMENTS_TRACEABILITY_MATRIX.md)에 `IMPLEMENTED_AWAITING_ACCEPTANCE` evidence row를 추가하고 [Implementation Registry](../book-12/15_IMPLEMENTATION_REGISTRY.md)의 post-freeze overlay에 `IMP-014` progress를 추가했다. Accepted architecture/governance 정의는 변경하지 않았다.

### 15. Deferred FEAT-015 Scope

Publication authoritative lifecycle, Publication Target mutation, connector, delivery, reconciliation, external reference, success/failure disposition, UNKNOWN/correction/withdrawal/republish, Published Listing Projection, `API-014`, `WF-010`–`WF-012`, `UI-031+`는 구현하지 않았다.

### 16. Known Issues or Risks

Acceptance를 막는 known P0/P1 또는 Critical/Important code-review issue는 없다. Production persistence와 external execution은 의도적으로 deferred다. 기존 GOV-001 변경과 SP-008 변경이 한 working tree에 함께 존재하므로 향후 commit authorization 시 scope를 구분해야 한다.

### 17. Working Tree Status

Clean하지 않다. 사용자 요청에 따라 commit을 만들지 않았고, 기존 GOV-001 변경과 의도된 SP-008 구현/evidence만 존재한다. `.env`, NAS, migration, probe, temporary artifact 변경은 없다.

### 18. Commit Status

Commit not created. Explicit commit authorization이 없었다. Current HEAD는 `c1cdbfcdd2108c320829df4f5d8ba65f50b56cfd`다.

### 19. SP-008 Completion Recommendation

구현과 technical DoD evidence가 완료되어 현재 상태는 `IMPLEMENTED_AWAITING_ACCEPTANCE`다. Architecture Owner acceptance 전 공식 `DONE`으로 승격하지 않으며 FEAT-015를 시작하지 않는다.

## Completion statement

SP-008 implementation과 기술 검증 evidence 작성을 완료했다. Architecture Owner acceptance는 남아 있으며, 다음 Brief 또는 FEAT-015를 시작하지 않는다.
