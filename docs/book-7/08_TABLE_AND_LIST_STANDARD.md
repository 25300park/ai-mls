# Table and List Standard

| 항목 | 값 |
|---|---|
| Document ID | DOC-UI-009 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business Owner / Development Reviewer |
| 기준일 | 2026-07-14 |

## Purpose

queue, registry, search result, audit와 operational collection의 consistent presentation을 정의한다.

## Required elements

Collection title/scope, item count, freshness, active filters/sort, loading/error/empty state와 permitted actions를 제공한다. Row에는 stable object identity, canonical status, owner/assignee, relevant age/freshness와 exception indicator를 우선한다.

## Interaction rules

- row selection과 primary navigation을 분리하고 checkbox selection은 명확한 header를 가진다.
- sort 가능 column은 direction과 canonical comparison 의미를 표시한다.
- sticky/frozen column은 reading order와 keyboard navigation을 깨뜨리지 않는다.
- sensitive column은 기본 숨김/마스킹하고 export도 API-002/API-016 scope를 재검사한다.
- status는 icon/color만으로 표현하지 않고 text와 accessible name을 포함한다.

## Column policy

Default column은 task decision에 필요한 identity, status, owner, freshness와 blocker만 포함한다. Optional column visibility/order는 preference로 저장할 수 있으나 mandatory authority/status column을 제거하지 않는다. Personal/restricted column은 purpose와 permission이 있을 때만 표시한다.

## Bulk actions

Bulk action은 owning API capability가 지원하고 workflow가 허용할 때만 제공한다. Approval, Verification, Permission과 publication decision은 exact subject/version별 결과를 남기며 blanket decision을 금지한다. Partial success는 per-item success/failure/retryability와 correlation reference를 표시한다.

## Export

Export는 visible rows의 client-side copy가 아니라 API-016 또는 owning API가 authorization, field policy, row scope, audit와 asynchronous completion을 적용하는 명시적 action이다. Export file은 classification, generated-at, filter/scope와 expiry를 표시하고 restricted field를 기본 제외한다.

## Status display

Canonical `AGGREGATE.STATUS`와 plain-language description, freshness/blocker를 표시한다. Status color는 보조 정보일 뿐이며 Candidate, Verified, Client Shareable와 Published authority class를 하나의 success 색으로 합치지 않는다.

## Responsive collection

좁은 viewport에서는 우선 field를 card/summary로 재배치하되 canonical status, identity, blocker와 primary action을 숨기지 않는다. Horizontal scroll이 필요한 data grid는 header association과 keyboard alternative를 제공한다.
