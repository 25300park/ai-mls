# FEAT-021-C Current Route Hardening Plan

**Goal:** 현재 13개 Console route에서 UI-036 unavailable/form 상태, history semantics, form consequence/in-flight semantics를 canonical boundary 안에서 보강한다.

**Architecture:** Existing `renderConsoleResult()`와 thin browser client만 확장한다. API, authority, route, screen, backend authorization, persistence 및 dependency는 변경하지 않는다.

## Task 1 — Unavailable controlled forms

- RED: canonical selector가 전혀 없는 UI-036 결과에 executable form이 남지 않는지 검증한다.
- GREEN: 기존 unavailable 안내를 유지하면서 command form을 렌더하지 않는다.

## Task 2 — History semantics

- RED: 단일 열 history/evidence가 header 없는 table이 아니라 labelled list로 표현되는지 검증한다.
- GREEN: existing history helper만 semantic list로 교체한다.

## Task 3 — Form clarity and in-flight state

- RED: required field의 visible/programmatic 표시, confirmation consequence, form busy 상태를 검증한다.
- GREEN: existing form helpers/dialog/client에 최소 semantics를 추가한다.

## Task 4 — Verification and evidence

- FEAT-021-C focused → Console regression → full suite once.
- lint/typecheck/build/verify, architecture checksum, document/link validation, Gitleaks, diff check.
- independent review 후 report/RTM actual evidence만 기록한다.
- exactly one local commit, no push, main fast-forward integration.
