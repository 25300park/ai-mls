# SP-007A Test Evidence

| 항목 | 값 |
|---|---|
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| Patch | SP-007A |
| 검증일 | 2026-07-23 |
| 기준 HEAD | `1cc81670e72e715a538efb0dd0d932ac15792556` |

## 1. AO-015 regression coverage

| 요구사항 | 명시적 test | 결과 |
|---|---|---|
| Manager Override without MFA | `AO-015 denies Manager Override without MFA, preserves state and emits no business decision audit` | PASS — `REAUTHENTICATION_REQUIRED`, `UNDER_REVIEW` 유지, `PERMISSION_DECIDED` 0 |
| Empty documented reason | `AO-015 denies Manager Override with an empty documented reason and preserves state` | PASS — `REASON_REQUIRED`, state transition 없음 |
| Same verifier without override | `AO-015 rejects self-permission and the same verifier without Manager Override` | PASS — `SEPARATION_OF_DUTIES_DENIED` |
| PMR without MGR | `AO-015 denies a PMR attempting Manager Override without MGR capability` | PASS — `CAPABILITY_DENIED` |
| Different verifier | `AO-015 denies Manager Override against a different verifier` | PASS — `MANAGER_OVERRIDE_DENIED` |
| Successful override | `AO-015 successful Manager Override records immutable approval, audit and append-only history` | PASS — actor/time/reason/override flag와 immutable snapshots 확인 |
| Normal MGR revoke | `AO-015 denies normal MGR revoke authority and preserves ACTIVE state` | PASS — `PERMISSION_DECISION_DENIED`, `ACTIVE` 유지 |

`API-012` safe-error regression은 기존 privacy-safe error test에 no-MFA override case를 추가했다. 내부 `REAUTHENTICATION_REQUIRED`는 raw 또는 internal detail 없이 stable `REQUEST_REJECTED`와 generic public message로 반환된다.

## 2. RED/GREEN evidence

최초 실행에서 7개 domain regression 중 6개가 통과하고 successful override audit의 `reason` assertion 1개가 실패했다.

- Expected: `MFA manager override for verifier conflict`
- Actual: `undefined`
- Root cause: `PermissionService.#replace()`의 validated transition reason이 `PermissionService.#record()`에 전달되지 않음

최소 수정 후 동일 test와 전체 regression suite는 138/138로 통과했다.

## 3. Production fix evidence

- 수정 파일: `modules/permission/src/permission-service.ts`
- 수정 범위: `#replace()`가 validated reason을 `#record()`로 전달하고 business `AuditEvent.reason`에 기록
- authority, RoleCode, lifecycle, API, security policy 변경: 없음
- 영향: Permission transition audit가 이미 immutable history에 기록되던 동일 documented reason을 함께 보존

## 4. Quality gates

| Command | Result |
|---|---|
| `pnpm.cmd lint` | PASS — error/warning 0 |
| `pnpm.cmd typecheck` | PASS — strict TypeScript error 0 |
| `pnpm.cmd test` | PASS — 138/138, fail/skip/todo 0 |
| `pnpm.cmd build` | PASS |
| `pnpm.cmd verify` | PASS |
| `gitleaks detect --source . --config .gitleaks.toml --redact` | PASS — actual secrets 0, unexplained findings 0 |
| `pnpm.cmd audit` | PASS — known vulnerabilities 0 |

Sandbox dependency audit는 registry `EACCES`로 실패했으며, 승인된 network context에서 동일 명령을 재실행해 `No known vulnerabilities found`를 확인했다.

## 5. Scope integrity

- 신규 Feature, API, RoleCode, authority 또는 lifecycle: 없음.
- Architecture Bible, governance, RTM, MDR, `.env`, NAS, infrastructure: 변경 없음.
- SP-008 functionality: 없음.
