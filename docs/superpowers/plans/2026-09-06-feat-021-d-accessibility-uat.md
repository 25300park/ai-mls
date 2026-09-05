# FEAT-021-D Keyboard / AX / Reflow / Role UAT Plan

**Goal:** Existing 13 Console routes에 대해 keyboard, accessibility tree, narrow reflow 및 current-role presentation evidence를 완성한다.

**Scope:** Existing renderer/server/browser surface only. Dependency-ready missing screen은 현재 0이므로 new screen, route, API, authority 또는 dependency를 추가하지 않는다.

## TDD slices

1. All 13 shells: one labelled main, Primary/Breadcrumb navigation, current route, skip target.
2. Role boundary: read-only routes expose no executable command; UI-036 retains backend-authorized confirmation only.
3. Reflow/high-contrast: 320px/narrow notice and badges wrap; forced-colors retains current/focus/status differentiation.
4. Browser: 13/13 routes, first-Tab skip, AX landmark/title, narrow viewport and safe-output checks.
5. Final: focused/Console/full gates, docs, independent review, one local commit, no push, fast-forward main.
