# REL-001 Phase 3G-A Runtime Containment Readiness Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-161 |
| 문서 버전 | v0.1 |
| 상태 | APPROVED |
| 소유 역할 | Architecture Owner / Security Owner / Operations Owner |
| 기준일 | 2026-09-15 |
| Decision | `DEC-152` (`APPROVED`) |

## 1. Readiness rule

기존 readiness vocabulary만 사용한다. Staging API-017 runtime은 다음 조건을 모두 만족할 때만 `READY`이다.

1. approved handlers `3/3`이 exact registry에 등록된다.
2. 각 handler의 typed capability requirement가 정확히 충족된다.
3. prohibited capability dependency가 `0`이다.
4. handler source inspection과 runtime containment tests가 PASS한다.
5. 기존 durable store, admission, CAS/idempotency와 audit integration이 PASS한다.

하나라도 실패하거나 증거가 없으면 `NOT_READY`이다.

## 2. Current assessment

| Gate | Required | Current evidence | Result |
|---|---:|---|---|
| closed handler identity mapping | `3/3` | Phase 3D registry mapping | PASS |
| closed capability contract | `3/3` | Phase 3G-A allowlist/matrix | PASS (design) |
| actual Production handler registration | `3/3` | concrete implementations absent | FAIL |
| prohibited official injection | `0` | implementation not yet applied | NOT VERIFIED |
| direct global network usage | `0` | no concrete handler source to inspect | NOT VERIFIED |
| direct timer/background usage | `0` | no concrete handler source to inspect | NOT VERIFIED |
| runtime network observation | `0` | later implementation test required | NOT VERIFIED |
| runtime timer/background observation | `0` | later implementation test required | NOT VERIFIED |
| durable/CAS/audit preservation | PASS | Phase 3C–3F evidence | PASS |

Current runtime composition readiness: `NOT_READY`.

## 3. Fail-closed matrix

| Condition | Required result |
|---|---|
| handler mapping missing or swapped | `NOT_READY`; execution `0` |
| undeclared capability requested | `FAIL_CLOSED`; execution `0` |
| prohibited capability required | handler `BLOCKED`; runtime `NOT_READY` |
| direct network/timer/background/process/fs/env global detected | handler `BLOCKED`; runtime `NOT_READY` |
| generic service locator exposed | composition invalid; runtime `NOT_READY` |
| handler starts detached work | containment failure; no readiness claim |
| all three implementations and containment evidence pass | runtime may project `READY` subject to existing gates |

## 4. Remaining blocker

Remaining blocker count는 `1`이다: capability-limited interface/wiring과 세 concrete handler의 implementation/source/runtime containment verification이 필요하다. Phase 3G는 별도 resume authorization 전까지 `BLOCKED`이다.
