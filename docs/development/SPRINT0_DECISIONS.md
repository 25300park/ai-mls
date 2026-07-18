# Sprint 0 Decisions

| 항목 | 값 |
|---|---|
| 문서 버전 | v0.1 |
| 문서 상태 | APPROVED |
| 실행 상태 | DONE |
| Developer Task | DEV-024 |
| Feature | FEAT-024 |
| Epic | EPIC-001 |
| Sprint | SP-000 |
| Requirement | REQ-CONST-001..REQ-CONST-013 |
| Test | TEST-056 |
| Implementation ID | IMP-024 |
| 기준일 | 2026-07-15 |

## Decision boundary

아래 항목은 frozen architecture를 변경하는 architecture decision이 아니라 Sprint 0의 reversible implementation setup이다. architecture 변경이 필요하면 [Freeze Baseline](../freeze/FREEZE_BASELINE.md)의 Change Request와 Architecture Review 절차를 따른다.

## Decisions

| Decision | Resolution | Rationale | Architecture impact |
|---|---|---|---|
| S0-DEC-01 | repository를 `main` branch 기준 Git repository로 초기화 | repository initialization 요구와 frozen Git principles 적용 | None; branch protection/provider는 미결정 |
| S0-DEC-02 | Book 11의 logical zone만 만들고 business module/source file은 만들지 않음 | Sprint 0 범위와 no business logic 제한 | None |
| S0-DEC-03 | runtime, language, package manager와 monorepo tool은 `UNSELECTED`로 유지 | frozen `OPEN DECISION` 보존 | None; Sprint 1 prerequisite |
| S0-DEC-04 | CI는 provider-neutral, `enabled: false`, non-executable placeholder로 기록 | CI placeholder 요구와 provider 미결정 보존 | None; activation requires approval |
| S0-DEC-05 | `.env.example`에는 non-secret local defaults만 포함 | credential/production data 노출 방지 | None |
| S0-DEC-06 | `services/` physical zone은 생성하지 않음 | Book 11이 future service split을 premature하게 생성하지 않도록 규정 | None |
| S0-DEC-07 | frozen registry의 canonical planning row를 바꾸지 않고 execution progress overlay를 추가 | v1.0 baseline identity와 implementation progress를 분리 | None |
| S0-DEC-08 | Sprint 1 implementation baseline으로 Node.js `24.18.0`, TypeScript `6.0.3`, pnpm `11.9.0`을 사용 | 2026-07-19 사용자 환경 승인과 호환성 검증 결과 반영 | None; reversible implementation toolchain decision |

`S0-DEC-08`은 `S0-DEC-03`의 당시 `UNSELECTED` 상태를 보존하면서 language/runtime/package-manager prerequisite만 후속 해소한다. framework, monorepo tool, CI provider와 production infrastructure는 선택하지 않는다.

## Open decisions

- **OPEN DECISION:** production framework와 supported version policy. Node.js `24.18.0`과 TypeScript `6.0.3`은 Sprint 1 implementation baseline으로 승인됨.
- **OPEN DECISION:** monorepo tool과 dependency graph validator. pnpm `11.9.0`은 Sprint 1 package manager로 승인됨.
- **OPEN DECISION:** formatter, linter, compiler/static-analysis tool과 enforcement profile.
- **OPEN DECISION:** Git/CI provider, branch protection implementation과 required checks.
- **OPEN DECISION:** secret manager와 environment provisioning implementation.

이 미결정 항목은 Sprint 0 placeholder 범위에서는 차단 요소가 아니지만 실제 application artifact를 시작하는 Sprint 1 전에는 승인되어야 한다.
