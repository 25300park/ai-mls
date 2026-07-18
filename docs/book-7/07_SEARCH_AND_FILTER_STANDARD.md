# Search and Filter Standard

| 항목 | 값 |
|---|---|
| Document ID | DOC-UI-008 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Business Owner / Database Reviewer |
| 기준일 | 2026-07-14 |

## Purpose

authorized search, filter, sort, query interpretation와 result explanation의 logical standard를 정의한다.

## Query modes

| Mode | API / AI | Rule |
|---|---|---|
| Structured search | API-005/006/008–010/016 | canonical field/filter semantics 사용 |
| Natural-language interpretation | AI-006/007 via applicable API | interpreted constraints를 사용자가 확인/수정; 결과 authority를 변경하지 않음 |
| Exact ID lookup | owning domain API | scope check 후 exact object/version 반환 |
| Audit search | API-016 | sensitive filter와 export 권한 별도 검사 |

## Global and advanced search

Global search(UI-008)는 authorized Property, Candidate, Client/Requirement와 Match result class를 명시적으로 선택하거나 안전한 default scope를 사용한다. Advanced search는 domain-specific canonical fields, status, owner, date/freshness, location와 range 조건을 제공하고 active query를 사람이 읽을 수 있게 요약한다.

## Saved filters

Saved filter는 query definition, owner, visibility, created/updated time와 schema/version compatibility를 가진 user preference다. 공유는 별도 scope 검사를 요구하며 saved filter가 data access, workflow assignment 또는 approval을 부여하지 않는다.

## Sorting and pagination

Sort key/direction과 tie-breaker를 명시하고 pagination 중 stable ordering을 유지한다. Page/continuation token은 filter/sort/scope와 결합하며 stale token은 안전하게 재조회한다. Exact page size와 maximum은 implementation policy로 남긴다.

## Standard behavior

- active filter, sort order, result count, query scope와 last refresh를 visible하게 유지한다.
- pagination은 stable sort와 continuation context를 사용하며 result count가 approximate이면 표시한다.
- filter는 canonical status full value를 사용하고 display label과 혼동하지 않는다.
- empty result는 no match, unauthorized scope, unavailable service를 구분하되 restricted existence를 누설하지 않는다.
- saved search는 preference일 뿐 workflow task, approval 또는 authoritative entity가 아니다.

## Result integrity

각 결과는 object type, canonical ID, version/status, owner/freshness와 match reason을 필요한 범위에서 표시한다. Search index는 non-authoritative projection이므로 action 시 owning API가 current canonical state를 재검사한다. AI ranking/confidence는 deterministic filter 통과나 human decision을 의미하지 않는다.

## OPEN DECISION

**OPEN DECISION:** default filter, result limit, ranking weight, saved-search sharing과 performance target은 usage evidence와 Phase 9 privacy review 후 정한다.
