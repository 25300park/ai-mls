# REL-001 Phase 4B Provider / Model Owner Decisions

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-178 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / AI Reviewer |
| 기준일 | 2026-09-15 |
| 기준 commit | `6b9ff6b47f6c1a1088aadf3eb542713744bb45f8` |

## 1. Canonical boundary

`AI-001`, `AI-004`, `AI-005`의 provider/model 선택은 FEAT-022 application/provider layer가 소유한다. API-017과 capability-specific Job handler의 provider/model 선택 권한은 `0`이다. Provider는 tenant identity, human principal 또는 downstream business authority를 소유하지 않는다.

## 2. Decision assessment

| Capability | Provider owner | Selection topology | Environment variation | Model authority | Result |
|---|---|---|---|---|---|
| AI-001 | FEAT-022 owner | fixed/routed/config-selected가 미결정 | 미결정 | approved provider router 또는 별도 owner decision 필요 | `OWNER_DECISION_REQUIRED` |
| AI-004 | FEAT-022 owner | fixed/routed/config-selected가 미결정 | 미결정 | approved provider router 또는 별도 owner decision 필요 | `OWNER_DECISION_REQUIRED` |
| AI-005 | FEAT-022 owner | fixed/routed/config-selected가 미결정 | 미결정 | approved provider router 또는 별도 owner decision 필요 | `OWNER_DECISION_REQUIRED` |

Book 4 Provider Abstraction은 policy-aware router 원칙만 정의하며 approved provider/model은 `0`이다. 따라서 vendor/model 이름, routing topology 또는 environment override를 이 Phase에서 만들 수 없다.

## 3. Closed invariants

- `API-017 provider selection authority = 0`
- `API-017 model selection authority = 0`
- credentials, prompt construction and raw response parsing remain behind FEAT-022
- provider/model activation requires a later explicit owner decision and scoped network authorization

## 4. Disposition

`PROVIDER_SELECTION: OWNER_DECISION_REQUIRED`

`MODEL_SELECTION: OWNER_DECISION_REQUIRED`

This document records a blocking decision gap; it does not authorize Production implementation.
