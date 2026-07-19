# SP-006 Test Evidence

| 항목 | 값 |
|---|---|
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| Sprint | SP-006 |
| 검증일 | 2026-07-19 |
| 기준 HEAD | `bd9c37ee9373c750c6a8c67c40722729a2e23a6a` |

## 1. Acceptance trace

| Test ID | 구현 증거 |
|---|---|
| `TEST-001/047` | self-verification default deny, MFA `MGR` override와 immutable override audit |
| `TEST-010` | Candidate/Match Result와 exact field-level Verification lifecycle 분리 |
| `TEST-020` | request, assignment, evidence review, human decision과 Contact isolation |
| `TEST-024` | field validity, expiration, revocation, idempotent linked reverification |
| `TEST-032` | `API-011` Verification-only authority; `VER/MGR` decision, `REV` support, `SAG` deny |
| `TEST-038/054` | `UI-026/027/032` role visibility, empty/action states와 accessibility metadata |
| `TEST-045` | `AI-007` closed-schema advisory validation과 prohibited authority rejection |
| `TEST-048/051` | classification inheritance, evidence reference-only storage, privacy-safe audit와 cross-team denial |

SP-006에서 domain 8개와 API/UI 5개, 합계 13개 test case를 추가했다. 전체 suite는 103개에서 116개로 증가했다.

## 2. Feature and workflow evidence

| Mapping | Evidence |
|---|---|
| `FEAT-012 / DEV-012 / IMP-012` | `modules/verification`, `API-011`, field-level policy와 immutable history |
| `WF-007` | request → assign → review support → `VER/MGR` decision |
| `WF-011` | `EXPIRING/EXPIRED`, material-change revoke와 linked reverification |
| `UI-026` | bounded queue view, role actions, accessible list state |
| `UI-027` | evidence/history detail, AO-011 role action visibility |
| `UI-032` | Verification-only expiry/reverification view |
| `AI-007` | existing provider-neutral validator reuse; state mutation authority 없음 |

## 2.1 Required gates

| Command | Result |
|---|---|
| `pnpm.cmd lint` | PASS — error/warning 0 |
| `pnpm.cmd typecheck` | PASS — TypeScript strict error 0 |
| `pnpm.cmd test` | PASS — 116/116, fail/skip/todo 0 |
| `pnpm.cmd build` | PASS |
| `pnpm.cmd verify` | PASS |
| `gitleaks detect --source . --config .gitleaks.toml --redact` | PASS — actual secrets 0, unexplained findings 0 |
| `pnpm.cmd audit` | PASS — known vulnerabilities 0 |

`pnpm.cmd audit`의 sandbox 실행은 registry `EACCES`로 실패했으며, 승인된 network context에서 동일 명령을 재실행해 `No known vulnerabilities found`를 확인했다.

## 3. Security evidence

- Zero Trust, default deny와 session-derived Actor를 유지했다.
- `verification.assign/perform/override`는 MFA, reason과 audit obligations가 적용되는 privileged action이다.
- `VER/MGR`만 `VERIFIED/REJECTED/INSUFFICIENT/REVOKED`를 만들 수 있다.
- `REV`는 `REQUEST_EVIDENCE/RECOMMEND/ESCALATE` support만 가능하다.
- `SAG`, service actor, AI와 connector는 decision authority가 없다.
- Scheduler-role service actor는 deterministic expiry restriction만 수행하며 renew/decision은 수행하지 않는다.
- raw phone/email pattern은 reason/history 입력에서 거부하며 audit에는 evidence reference metadata만 기록한다.

## 4. RTM evidence disposition

Implementation evidence는 `TRACE-012 → FEAT-012 → API-011 → WF-007/011 → UI-026/027/032 → TEST-001/010/020/024/032/038/045/047/048/051/054 → SP-006`으로 확인했다.

AO-011의 명시적 `No RTM modification` 지시에 따라 [Requirements Traceability Matrix](../governance/REQUIREMENTS_TRACEABILITY_MATRIX.md)는 수정하지 않았다. Commit hash evidence는 completion report와 Architecture Owner acceptance에서 고정한다.

## 5. Scope integrity

- `FEAT-013`, `API-012`, Permission/Proposal/Publication behavior: 없음.
- `UI-028–031` behavior: 없음.
- provider/model/prompt/threshold 결정: 없음.
- production database, queue, object storage 또는 infrastructure 변경: 없음.
- frozen Architecture Bible/governance, `.env`, NAS 변경: 없음.
