# Branching and Release

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-008 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Release Owner / Development Reviewer |
| 기준일 | 2026-07-15 |

## Branch strategy

기본은 short-lived branch와 protected mainline이다. branch는 [Naming Convention](../00_NAMING_CONVENTION.md)의 `<type>/<scope>-<short-description>`를 따르고 personal/client/contact/credential 정보를 포함하지 않는다.

| Branch class | Purpose | Lifetime | Gate |
|---|---|---|---|
| mainline | accepted integration baseline | permanent | protected, releasable expectation |
| feature/fix/test/docs | bounded `DEV-*` change | short-lived | PR + mapped tests |
| release | stabilization only | bounded | release acceptance + approval |
| hotfix | production-critical correction | shortest possible | emergency authority + regression/rollback |

Long-lived environment branch는 configuration drift를 유발하므로 기본적으로 두지 않는다.

## Release branch

release branch에서는 new feature를 추가하지 않고 defect, version, documentation와 release evidence만 수정한다. 변경은 mainline으로 역반영하고 release scope/manifest를 고정한다.

## Hotfix branch

hotfix는 incident/change record, affected release, `DEV-*`, regression test와 rollback plan을 가진다. constitutional/security/privacy control을 완화하는 hotfix는 허용하지 않는다.

## Tagging

approved immutable release에 Semantic Versioning 형식 `vMAJOR.MINOR.PATCH` tag를 사용한다. tag는 manifest, commit, release note와 approval evidence에 연결하고 이동/재사용하지 않는다.

## Version policy

- MAJOR: incompatible approved contract/behavior change.
- MINOR: backward-compatible capability addition.
- PATCH: backward-compatible correction.
- pre-release identifier는 non-production validation baseline에만 사용한다.

Documentation version과 software release version은 별도 lifecycle이지만 manifest에서 서로 연결한다.

## Release gate

[Release Acceptance](../book-10/12_RELEASE_ACCEPTANCE.md), [Release Management](../book-9/04_RELEASE_MANAGEMENT.md), mapped `TEST-*`, security/operations evidence와 approvals가 필요하다.

> **OPEN DECISION:** exact release cadence, support window, pre-release naming와 deployment promotion model.
