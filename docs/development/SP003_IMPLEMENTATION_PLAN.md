# SP-003 Property, Candidate, Duplicate and Advisory AI Implementation Plan

**Goal:** approved property/candidate data와 duplicate/AI suggestion을 human authority 및 provenance 경계 안에서 안전하게 처리한다.

**Architecture:** `modules/property`, `modules/listing`, `modules/ai`가 각각 lifecycle과 validation을 소유하고 `apps/api`는 API-005/006 translation만 담당한다. persistence와 provider는 in-memory port/adapter로 유지한다.

**Tech Stack:** Node.js 24.18.0, TypeScript 6.0.3, pnpm 11.9.0, Node.js test runner.

## Global constraints

- FEAT-006/007/022, DEV-006/007/022, IMP-006/007/022만 구현한다.
- frozen Architecture Bible, `.env`, NAS configuration을 수정하지 않는다.
- production technology와 SP-004 이후 domain을 선택하거나 구현하지 않는다.
- 테스트를 먼저 실패시킨 뒤 최소 구현으로 통과시킨다.
- 완료 시 사용자 요구대로 단일 SP-003 completion commit을 만든다.

### Task 1: authorization capabilities

- [x] `property.read/propose/decide`, `candidate.read/create/revise`, `offer.create/revise`, `duplicate.suggest/dispose`, `ai.result.read/review` allow/deny tests를 추가한다.
- [x] human/service authority separation과 SoD를 유지하는 최소 capability를 구현한다.

### Task 2: Property master

- [x] TEST-028/040/044를 매핑한 failing tests를 작성한다.
- [x] hierarchy/alias read-search, proposal/decision, optimistic concurrency, audit를 구현한다.

### Task 3: Candidate, offer and duplicate

- [x] TEST-010/017/028/041 failing tests를 작성한다.
- [x] CandidateDraftPort handoff, offer revision, advisory duplicate group, human disposition과 provenance를 구현한다.

### Task 4: AI-001–007 advisory boundary

- [x] TEST-007/013/039–045 failing tests를 작성한다.
- [x] closed schema, evidence/version, confidence, classification, review route와 human review history를 구현한다.

### Task 5: API-005/006 adapters and view states

- [x] session-derived actor, safe error, exact version, immutable UI state를 검증하는 failing tests를 작성한다.
- [x] thin adapters와 additive composition/export를 구현한다.

### Task 6: review, validation and completion

- [x] scope/security review와 full regression을 수행한다.
- [x] lint, typecheck, test, build, verify, Gitleaks, audit를 실행한다.
- [x] `SP003_TEST_EVIDENCE.md`와 `SP-003_COMPLETION.md`를 작성한다.
- [x] 단일 `feat(sp-003): property candidate duplicate and advisory AI` commit 후 clean tree를 확인한다.
