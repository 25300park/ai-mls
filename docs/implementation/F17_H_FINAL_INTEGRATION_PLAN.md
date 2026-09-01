# F17-H Final Integration / Hardening Plan

- Version: v0.1
- Status: DRAFT
- Baseline: `4db36df9f0d7cfa7ce169bd265c908d0fe9539a7`
- Branch: `codex/f17-h-final-integration`
- 실행 방식: `executing-plans`, 기존 테스트를 재사용하는 순차 검증.

## 목적과 범위

승인된 F17-B/C/D/E/F의 단일 HTTP → Runtime/Host → PublicationApi → Application → durable UoW → provider 경계를 검증한다. 기본 production 변경은 0이다. 재현된 결함만 최소 수정하며 새로운 authority/API/state/provider/recovery 의미가 필요하면 중단한다.

## 실행 계획

- [x] 기존 API-014 HTTP 테스트에 실제 production composition의 durable execution/reopen, rejection 및 caller evidence containment 검증을 보강했다. 기존 18-operation dispatch 검증을 사업 성공 증거로 과장하지 않는다.
- [x] F17-B eligibility, C durability/atomicity/restart, D HTTP, E normalization/leakage, F durable retry/replay 및 관련 regression: B–F 55/55, affected 449/449 PASS.
- [x] 실제 child process exit 검증을 추가했다. HTTP purpose/team 무시 결함을 RED로 재현하고 API adapter만 최소 수정하여 GREEN을 확인했다.
- [x] `pnpm.cmd ... run verify`: lint/typecheck/build/full 832/832 PASS. 첫 lint 실패 시 full suite는 실행되지 않았으며 수정 후 full suite를 한 번 실행했다.
- [x] architecture 153-file baseline 무변경, dependency/lockfile 무변경, `git diff --check`, Gitleaks 0을 확인했다.
- [x] F17-H 전용 audit 승인 후 production 0, full 기존 development-only transitive High 4, 신규 미승인 High/Critical 0을 확인했다. Dependency/lockfile 변경은 0이다.
- [x] Production/full audit를 기록하고 independent review Critical 0 / Important 0 / Minor 0 — READY를 확인했다.
- [x] 실제 증거만 [FEAT015 RTM](FEAT015_TRACEABILITY_MATRIX.md)과 F17-H implementation report에 기록했다. 모든 gate 통과 후 정확히 하나의 local commit을 생성한다.

## 중단 및 제외

F17-G는 DEFERRED이다. F18/F19/F20/F21을 시작하지 않는다. 실제 provider/credential/Console mutation을 추가하지 않는다. main 변경, merge, push는 하지 않는다. audit 미승인 또는 미해결 중요한 finding은 완료 승인이 아니다.

현재 checkpoint: [F17-H report](../reviews/F17_H_FINAL_INTEGRATION_HARDENING_REPORT.md). Audit 승인 및 fresh independent review 전에는 commit하지 않는다.
