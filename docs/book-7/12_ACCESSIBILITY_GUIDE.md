# Accessibility Guide

| 항목 | 값 |
|---|---|
| Document ID | DOC-UI-013 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business Owner / Development Reviewer |
| 기준일 | 2026-07-14 |

## Purpose and target

AI MLS UI는 [W3C Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/) Level AA를 design/review 목표로 삼는다. 이는 Phase 8의 architecture target이며 구현 conformance claim은 test evidence와 user review 전에는 하지 않는다.

## Perceivable

- text alternative, semantic heading/landmark, meaningful sequence와 reflow를 제공한다.
- text/non-text contrast를 검증하고 color, position 또는 icon만으로 상태를 전달하지 않는다.
- status/authority/AI advisory label은 readable text를 포함한다.
- zoom과 text spacing에서 content/action 손실이나 overlap이 없어야 한다.

## Operable

- 모든 기능은 keyboard로 수행 가능하고 keyboard trap이 없어야 한다.
- focus order/visible focus/focus not obscured를 보장한다.
- drag-only, hover-only, gesture-only action을 금지하고 target size를 검토한다.
- timeout/session expiry는 사전 경고와 가능한 연장/재인증 경로를 제공하되 security policy를 약화하지 않는다.

## Understandable

- page title, label, help와 navigation naming을 screen 간 일관되게 사용한다.
- error identification, suggestion, redundant-entry reduction과 legal/financial/data decision error prevention을 적용한다.
- destructive, approval, permission와 publication action은 결과를 명확히 설명하고 확인/수정 기회를 제공한다.
- accessible authentication은 인지 기능 검사에만 의존하지 않는 방식을 목표로 한다.

## Accessible forms

Form control은 persistent label, purpose/format instruction, required indicator, grouped relationship과 programmatic error association을 가진다. Error summary에서 invalid control로 이동할 수 있고 입력 실패 후 사용자가 제공한 값을 보존한다.

## Robust

Name, role, value와 status message를 assistive technology에 전달한다. Dynamic loading, async job, validation error와 notification은 적절한 live/status semantics를 사용하되 과도한 announcement를 피한다.

## Review evidence

| Stage | Evidence |
|---|---|
| Architecture | screen/action/accessibility requirement mapping |
| Design | keyboard path, focus order, text/contrast/reflow annotation |
| Implementation | automated 검사 + semantic/manual code review |
| Acceptance | keyboard-only, screen reader, zoom/reflow와 user task test |

## Known limitation

Assistive technology/browser matrix, language/localization, exact contrast/token과 conformance test는 Book 10 및 implementation phase에서 확정한다.
