# SP-006 구현 계획

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-SP006-PLAN |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| Sprint | SP-006 |
| 승인 근거 | SP-006 Implementation Brief v1.0 + AO-011 |

## Goal

`FEAT-012`, `API-011`, `WF-007`, `WF-011`과 `UI-026/027/032`의 Verification-only logical contracts를 구현한다.

## Architecture

`modules/verification`이 field-level Verification aggregate, assignment, human decision, expiry, successor reverification과 immutable history를 소유한다. `apps/api`의 `VerificationApi`는 session-derived Actor와 safe errors를 적용하고 framework-neutral UI view contracts를 제공한다. 기존 `AuthorizationService`, `AuditLog`, `AI-007` validator를 재사용하며 Permission/Proposal/Publication authority를 추가하지 않는다.

## Global Constraints

- TypeScript `6.0.3` strict mode를 유지한다.
- Decision authority는 `VER`, `MGR`뿐이며 `REV`는 evidence review support만 수행한다.
- `SAG`, AI, scheduler, service actor, connector는 Verification decision을 수행할 수 없다.
- Validity는 `AVAILABILITY=7`, `PRICE=14`, `CONTACT_REACHABILITY=30`, `LEGAL_DOCUMENTS=90` days다.
- Self-verification은 금지하며 MFA와 reason을 갖춘 `MGR` override만 허용한다.
- Expiry는 자동 renewal하지 않고 reverification은 immutable successor record를 생성한다.
- Contact raw value, Permission, Proposal, Publication, production adapter와 SP-007 기능은 구현하지 않는다.
- Frozen registry와 governance 구조는 수정하지 않는다. RTM implementation evidence도 AO-011에 따라 수정하지 않는다.

## Task 1 — Verification Domain

- [ ] Domain tests를 먼저 추가하고 missing module/behavior로 실패함을 확인한다.
- [ ] `Verification`, `Availability`, `VerifierAssignment`, `ReverificationRequest`, `ApprovalHistory`, `StatusHistory` contracts를 구현한다.
- [ ] request, assign, review support, decide, revoke, expiry, reverification과 AI-007 validation을 구현한다.
- [ ] Domain tests와 전체 regression을 통과시킨다.

## Task 2 — API-011 and UI Contracts

- [ ] API/UI tests를 먼저 추가하고 missing API/behavior로 실패함을 확인한다.
- [ ] `VerificationApi`와 `UI-026`, `UI-027`, Verification-only `UI-032` view states를 구현한다.
- [ ] session Actor, role visibility, accessibility, privacy-safe response와 safe errors를 검증한다.
- [ ] composition/export를 연결하고 API tests와 regression을 통과시킨다.

## Task 3 — Evidence and Completion

- [ ] `SP006_TEST_EVIDENCE.md`와 `SP-006_COMPLETION.md`를 작성한다.
- [ ] lint, typecheck, test, build, verify, Gitleaks, dependency audit를 새로 실행한다.
- [ ] frozen document, `.env`, NAS, SP-007 artifact 변경이 없음을 확인한다.
- [ ] `feat(sp-006): verification authority` 단일 completion commit을 생성한다.

## Self-review

- Approved Brief와 AO-011의 authority matrix를 모두 포함한다.
- `FEAT-013`, `API-012`, `UI-028–031` behavior가 없다.
- Provider/model/prompt/threshold 또는 production persistence 결정을 포함하지 않는다.
