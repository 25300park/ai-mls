# Responsive Strategy

| 항목 | 값 |
|---|---|
| Document ID | DOC-UI-012 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business Owner / Development Reviewer |
| 기준일 | 2026-07-14 |

## Purpose

Desktop, tablet와 mobile viewport에서 정보·authority·task continuity를 보존하는 responsive 원칙을 정의한다. 특정 pixel breakpoint나 CSS 구현은 정의하지 않는다.

## Task tiers

| Tier | Suitable tasks | Required behavior |
|---|---|---|
| Wide workspace | comparison, dense queue, audit, matching, publication reconciliation | multi-panel 가능; reading/focus order 유지 |
| Compact workspace | intake, client, verification review | panels stack; subject/version/action context 고정 |
| Mobile task | triage, status 확인, simple evidence capture, notification | 한 가지 task 중심; critical context/action 유지 |

## Responsive priorities

1. principal/role/team scope, object identity/version과 canonical status를 보존한다.
2. blocker, evidence freshness, authority와 primary action을 secondary metadata보다 우선한다.
3. destructive/approval action은 좁은 화면에서도 축약 icon으로 숨기지 않는다.
4. comparison이 필수인 AI review, duplicate, approval와 reconciliation은 safe comparison을 제공할 수 없으면 read-only 안내 후 wider workspace를 요구한다.
5. draft/task context는 viewport 전환과 orientation change에서 손실되지 않아야 한다.

## Input and connectivity

Touch target, on-screen keyboard, zoom/reflow와 portrait/landscape를 고려한다. Network interruption은 unsent draft와 server-confirmed state를 분리하며 offline write/approval을 암묵 지원하지 않는다. File/media capture는 source policy, privacy와 upload validation을 그대로 적용한다.

## Future PWA

`POST-MVP`: installability, offline cache, background sync, push notification와 device integration은 별도 security/privacy/operations decision 전에는 지원을 가정하지 않는다. Future PWA도 offline approval/publication, stale authority 사용, restricted data의 무기한 device 저장 또는 connector bypass를 허용하지 않는다.

## OPEN DECISION

**OPEN DECISION:** supported device/browser matrix, breakpoint/token 값, offline draft 범위와 field verification은 implementation planning 및 Phase 9 security review에서 정한다.
