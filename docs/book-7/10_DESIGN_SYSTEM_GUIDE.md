# Design System Guide

| 항목 | 값 |
|---|---|
| Document ID | DOC-UI-011 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business Owner / Development Reviewer |
| 기준일 | 2026-07-14 |

## Purpose

화면 간 meaning, hierarchy, state와 action safety를 유지하는 implementation-independent design system contract를 정의한다.

## Semantic foundations

| Foundation | Required semantics |
|---|---|
| Color | text/background/border/action/status semantic token; color-only meaning 금지 |
| Typography | page/section/object/label/body/metadata hierarchy |
| Spacing | density mode와 touch/keyboard target을 보존하는 scale |
| Elevation | overlay/context change만 표현; authority importance 표현 금지 |
| Motion | focus/context/feedback 보조; reduced-motion 지원 |
| Iconography | visible label 또는 accessible name; destructive icon 단독 사용 금지 |

## Design principles

Clarity before density, evidence before assertion, visible authority, reversible safe progress, consistent language와 accessible-by-default를 적용한다. Visual prominence가 permission/verification/approval을 의미하지 않도록 semantic label과 evidence를 함께 제공한다.

## Status color rules

Color token은 `informational`, `attention`, `blocking`, `critical`, `completed`, `neutral`, `advisory` 의미만 보조한다. Canonical status text와 icon/description을 함께 사용하며 green 하나로 verified, permitted, approved, published를 합치지 않는다. Contrast는 Accessibility Guide의 WCAG 2.2 AA 목표를 따른다.

## Icons

Icon은 공통 vocabulary와 accessible name을 사용하고 같은 의미에는 같은 icon을 사용한다. Icon 단독으로 approval, destructive action, status 또는 AI confidence를 전달하지 않는다.

## Component contract

Button, link, input, select, date/amount control, status badge, alert, dialog, table/list, tabs, breadcrumb, pagination, evidence panel, AI suggestion panel과 audit timeline은 공통 semantics를 사용한다. Variant 이름은 visual color가 아니라 `primary`, `secondary`, `danger`, `approval`, `advisory`, `read-only` 같은 intent를 반영한다.

## Domain-specific patterns

- **Authority badge:** Candidate/Verification/Permission/Publication을 서로 다른 canonical 설명으로 표현.
- **Evidence panel:** source, as-of, version, provenance, limitation과 restricted classification.
- **Decision panel:** decision maker/scope, exact version, prerequisite, rationale, consequence와 audit.
- **AI panel:** capability, input/result version, confidence, validation, limitation, correction과 human disposition.
- **External-state panel:** internal command와 externally reconciled state를 분리.

## Governance

새 pattern은 중복 여부, accessibility, authority implication, data disclosure와 affected screens를 review한다. Design token 값, brand palette, font, framework와 component library는 `OPEN DECISION`이며 Phase 8 산출물이 아니다.
