# SP-004 Test Evidence

| 항목 | 값 |
|---|---|
| 문서 버전 | v0.1 |
| 문서 상태 | DRAFT |
| Sprint | SP-004 |
| 검증일 | 2026-07-19 |
| 기준 HEAD | `38b50864192d745714a6befb90a43d5b1bd3b02c` |

## 1. Acceptance trace

| Test ID | 구현 증거 |
|---|---|
| TEST-018 | Requirement DRAFT, deterministic readiness, human activation, immutable revision/history, lifecycle transition, stale signal |
| TEST-020 | `AO-001`에 따른 Contact lifecycle subset: attempt evidence, DNC와 신규 case 차단 |
| TEST-029 | Contact masking, explicit purpose reveal, MFA/reason authorization, channel revocation와 privacy-safe audit |
| TEST-030 | assigned Client scope, API-007–009 session Actor, Requirement concurrency/lifecycle와 safe errors |
| TEST-042 | AI-004 closed-schema Requirement proposal validation과 prohibited activation rejection |
| TEST-044 | AI-006 bounded Requirement search interpretation과 no-query/no-write boundary |
| TEST-045 | AI-007 confidence route, evidence/classification/schema/authority validation |
| TEST-048 | Contact/Client team scope, classification inheritance, restricted data의 log 비노출 |

SP-004에서 16개 test case를 추가하여 repository 전체 test는 76개에서 92개가 되었다.

## 2. Required gates

| 명령 | 결과 |
|---|---|
| `pnpm.cmd lint` | PASS — error/warning 0 |
| `pnpm.cmd typecheck` | PASS — TypeScript strict error 0 |
| `pnpm.cmd test` | PASS — 92/92, fail/skip 0 |
| `pnpm.cmd build` | PASS |
| `pnpm.cmd verify` | PASS — lint/typecheck/test aggregate gate |
| `gitleaks detect --source . --config .gitleaks.toml --redact` | PASS — Gitleaks 8.30.1, `no leaks found` |
| `pnpm.cmd audit` | PASS — `No known vulnerabilities found` |

Sandbox registry access는 `EACCES`로 차단되어 `pnpm.cmd audit`를 승인된 network context에서 동일 명령으로 재실행했다.

## 3. Trace evidence

| Mapping | Implementation evidence |
|---|---|
| FEAT-008 · DEV-008 · IMP-008 | `modules/contact`, API-007 adapter, TEST-020/029/048 |
| FEAT-009 · DEV-009 · IMP-009 | `modules/client` Client contract, API-008 adapter, TEST-018/030/048 |
| FEAT-010 · DEV-010 · IMP-010 | Requirement lifecycle/readiness/stale boundary, API-009 adapter, AI-004/006/007 validation, TEST-018/030/042/044/045 |

## 4. Scope and integrity checks

- `AO-001`: TEST-020 Contact subset only; Verification/Permission source 없음.
- `AO-002`: UI-024, API-010과 Matching execution source 없음.
- `AO-003`: RTM v1.0 구조 변경 없음; SP-004 evidence rows만 추가.
- frozen Architecture Bible changes: 0.
- ADR, DoD, MDR content changes: 0.
- `.env` changes: 0.
- NAS/infrastructure changes: 0.
- production DB/queue/storage/HTTP/provider/model/prompt/threshold selection: 0.
- SP-005/SP-006 source artifacts: 0.

## 5. Known limitations

- 저장소는 승인된 기존 방식대로 process-local in-memory contract이며 production persistence/multi-process locking을 제공하지 않는다.
- AI는 provider inference를 수행하지 않고 provider-neutral closed-schema result를 검증한다.
- minimum activation policy의 미결정 값을 만들지 않고 explicit `validationGaps`, provenance, intent와 deterministic consistency만 사용한다.
- Requirement stale signal은 downstream handoff evidence이며 Match Result를 생성하거나 변경하지 않는다.
