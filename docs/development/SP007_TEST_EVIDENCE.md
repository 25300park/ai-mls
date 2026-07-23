# SP-007 Test Evidence

| 항목 | 값 |
|---|---|
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| Sprint | SP-007 |
| 검증일 | 2026-07-23 |
| 기준 HEAD | `3d8285f95fa7d12525cc3b5ac30f8f6b674f2998` |

## 1. Acceptance trace

| Test ID | 구현 증거 |
|---|---|
| `TEST-001/047` | self-permission default deny, Verification/Permission 역할 분리, MFA `PMR+MGR` override와 immutable audit |
| `TEST-012` | exact subject revision, field scope, single purpose, explicit audience와 exact Verification revision binding |
| `TEST-020` | `PMR` decision authority, `REV` support-only, Contact disclosure named-audience restriction |
| `TEST-024` | type별 validity, Verification cap, expiration, revocation, immutable successor와 atomic activation |
| `TEST-029/048/051` | raw Contact 비저장, classification inheritance, privacy-safe audit, terminal lifecycle |
| `TEST-032/047` | `API-012`, default deny, team/object/purpose scope, role enforcement와 idempotent replay 재인가 |
| `TEST-038/054` | `UI-026/028/032` Permission-only role visibility, bounded states와 accessibility metadata |
| `TEST-045` | `AI-007` closed-schema advisory validation과 state mutation authority 거부 |

SP-007에서 domain 10개, API/UI 5개, authorization 1개로 합계 16개 test case를 추가했다. 전체 suite는 116개에서 132개로 증가했다.

## 2. Feature and API evidence

| Mapping | Evidence |
|---|---|
| `FEAT-013 / DEV-013 / IMP-013` | `modules/permission`, exact-scope Permission lifecycle, immutable history와 effective check |
| `API-012` | create/read/review/grant/deny/revoke/effective/history logical contracts |
| `UI-026` | purpose-scoped Permission queue portion only |
| `UI-028` | role-aware Permission detail/review contract |
| `UI-032` | Permission expiration/restriction portion only |
| `AI-007` | 기존 provider-neutral validator 재사용; decision 또는 mutation authority 없음 |

## 3. Required gates

| Command | Result |
|---|---|
| `pnpm.cmd lint` | PASS — error/warning 0 |
| `pnpm.cmd typecheck` | PASS — TypeScript strict error 0 |
| `pnpm.cmd test` | PASS — 132/132, fail/skip/todo 0 |
| `pnpm.cmd build` | PASS |
| `pnpm.cmd verify` | PASS |
| `gitleaks detect --source . --config .gitleaks.toml --redact` | PASS — actual secrets 0, unexplained findings 0 |
| `pnpm.cmd audit` | PASS — known vulnerabilities 0 |

`pnpm.cmd audit`의 sandbox 실행은 registry `EACCES`로 실패했으며, 승인된 network context에서 동일 명령을 재실행해 `No known vulnerabilities found`를 확인했다.

## 4. Security and privacy evidence

- Zero Trust, default deny, least privilege와 session-derived Actor를 유지했다.
- `PMR`만 request/review/grant/deny/revoke authority를 가지며 `REV`는 evidence support만 수행한다.
- `VER/PUA/SAG/AGT`는 Permission read context만 가지며 `MGR/SEC/ADM`은 oversight read만 가진다.
- same actor Verification/Permission exception은 `PMR+MGR`, MFA, documented reason과 immutable audit를 모두 요구한다.
- exact team, object, purpose, audience, field scope와 Verification revision을 매 호출 및 idempotent replay에서 재검증한다.
- raw phone/email pattern은 reason/history 입력에서 거부하고 audit에는 reference와 bounded metadata만 기록한다.
- `CONTACT_DISCLOSURE`는 named audience와 exact Contact scope를 요구하며 `CLIENT_SHARING` 또는 public audience를 상속하지 않는다.

## 5. RTM evidence disposition

Implementation evidence는 `REQ-CONST-002–004/010/013 → FEAT-013 → API-012 → Permission portions of WF-007–011 → Permission/Approval History/Contact Channel → AI-007 → UI-026/028/032 → TEST-001/012/020/024/029/032/038/045/047/048/051/054 → SP-007`로 확인했다.

승인된 Architecture Bible과 governance/registry는 frozen이므로 파일을 수정하지 않았다. `TRACE-013`의 기존 Sprint 값 불일치는 [SP-007 Completion Report](../reviews/SP-007_COMPLETION.md)에 기록하고, 본 evidence 문서와 completion commit으로 실제 구현 증거를 제공한다.

## 6. Scope integrity

- `FEAT-014/015`, `API-013/014`, Proposal, Publication Approval, Publication, Distribution behavior: 없음.
- `UI-025/029/030/031` behavior: 없음.
- provider/model/prompt/threshold 결정: 없음.
- production database, queue, object storage 또는 infrastructure 변경: 없음.
- frozen Architecture Bible/governance/registry, `.env`, NAS 변경: 없음.
