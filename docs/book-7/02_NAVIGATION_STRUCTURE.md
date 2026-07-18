# Navigation Structure

| 항목 | 값 |
|---|---|
| Document ID | DOC-UI-003 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business Owner / Architecture Owner |
| 기준일 | 2026-07-14 |

## Purpose

사용자가 role scope를 벗어나지 않고 dashboard, domain queue, object detail, decision task와 history 사이를 예측 가능하게 이동하는 논리 navigation을 정의한다.

## Navigation layers

| Layer | Content | Rule |
|---|---|---|
| Global | Home, Search, Sources, Listings, Clients, Matching, Verification, Publication, Operations | API-002 authorization 결과에 따라 visible; 숨김이 authorization을 대체하지 않음 |
| Role landing | UI-002–UI-007 dashboard | active role/team scope와 assigned task만 집계 |
| Domain local | queue/list, saved view, filters, registry | canonical domain label과 current scope 유지 |
| Object local | Overview, Evidence, AI Review, Decisions, History | object/version identity를 모든 tab에서 유지 |
| Task flow | previous/next assigned item, return to queue | decision 전 context loss 방지; task skip도 visible action으로 기록 |
| Utility | UI-001 Sign In, UI-037 Notification Center | global access, restricted content redaction |

## Global navigation

Role-authorized Home, Search와 domain groups를 일관된 순서로 제공한다. Active location, role/team scope와 unread task count를 표시하며 메뉴 visibility와 API authorization을 별도로 적용한다.

## Local navigation

Domain queue의 saved view/filter와 object detail의 Overview, Evidence, Decisions, History를 제공한다. Local tab 이동은 object ID/version과 unsaved draft를 보존한다.

## Breadcrumb

`Domain → Collection → Object → Task`의 semantic path를 사용한다. 각 segment는 authorization을 재검사하며 restricted parent label을 누설하지 않는다. Breadcrumb은 browser back 또는 task return을 대체하지 않는다.

## Quick actions

Dashboard/queue의 quick action은 visible label, affected object, API capability와 permission reason을 가진다. Create Intake, New Requirement 같은 allowed entry만 제공하고 approval/publication/destructive action은 detail context와 confirmation 없이 quick action으로 실행하지 않는다.

## Route semantics

Logical route는 screen ID와 canonical object ID를 중심으로 식별하되 exact URL은 Phase 8 범위 밖이다. Deep link는 authentication 이후 API-002를 재평가하고, stale version이면 current version과 차이를 표시하며 write를 막는다. Back/return은 source queue의 filter/sort/page context를 보존한다.

## Role-aware behavior

- 사용자가 여러 role을 가지면 active role과 team scope를 명시적으로 선택하고 화면 상단에 계속 표시한다.
- role switch는 pending edit를 경고하고 authorization/cache를 재평가한다.
- inaccessible destination은 generic unauthorized state를 제공하며 sensitive object metadata를 표시하지 않는다.
- dashboard shortcut은 workflow gate를 건너뛰지 않고 동일 screen/action contract로 이동한다.

## Cross-object navigation

Candidate → source/provenance/property/offer/duplicate/verification, Requirement → client/match/proposal, Publication → approval/representation/target/history 연결을 제공한다. 관계는 read capability를 별도로 검사하며 related count만으로 restricted object 존재를 누설하지 않는다.

## Hidden-action prohibition

Row click, icon, gesture, keyboard shortcut와 background refresh는 의미가 visible label/help에 문서화되어야 한다. Hover-only action, unlabeled destructive icon, navigation과 동시에 일어나는 write, authorization 없는 optimistic authority upgrade는 금지한다.
