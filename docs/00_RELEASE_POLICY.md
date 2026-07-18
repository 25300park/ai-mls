# Documentation Release Policy

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-023 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-07-13 |

이 policy는 Architecture Bible 문서 set의 draft, review, frozen release와 version/approval/archive 규칙을 정의한다. 개별 문서 상태는 [Document Lifecycle](00_DOCUMENT_LIFECYCLE.md), 승인 evidence는 [Approval Workflow](00_APPROVAL_WORKFLOW.md)를 따른다.

## Version format

문서와 release version은 `vMAJOR.MINOR` 또는 patch가 필요할 때 `vMAJOR.MINOR.PATCH`를 사용한다.

- 기존 `v0.1`은 `v0.1.0`과 의미상 동일한 shorthand이며 문서를 소급 수정하지 않는다.
- 기존 freeze 목표 `v1.0`은 initial frozen release `v1.0.0`의 shorthand다.
- 같은 release 안에서 문서별 version이 다를 수 있으나 manifest가 각 Document ID/version/checksum을 기록한다.
- version만으로 lifecycle status를 추론하지 않고 metadata와 release manifest를 확인한다.

## Release classes

| Release class | Document status | 목적 | 외부 기준선 여부 |
|---|---|---|---|
| Draft release | `DRAFT` | author collaboration과 early feedback | 아니요 |
| Review release | `IN REVIEW` | 고정된 review candidate에 대한 역할별 검토 | 아니요 |
| Approved release candidate | `APPROVED` | required approval을 얻은 freeze 후보 | 아직 아님 |
| Frozen release | `FROZEN` | manifest/checksum으로 고정된 architecture baseline | 예 |

Draft/Review release에는 `DRAFT` watermark 또는 status 표기를 유지한다. Approved document라도 F1 freeze와 manifest에 포함되기 전에는 frozen baseline이 아니다.

## Change level

| Level | 증가 규칙 | 예 | 적용 기준 |
|---|---|---|---|
| Major release | `v1.x → v2.0` | `v2.0` | 원칙, authority boundary, 호환되지 않는 contract 또는 governance precedence 변경 |
| Minor release | `v1.0 → v1.1` | `v1.1` | 호환되는 capability/Book 추가 또는 의미 있는 normative 확장 |
| Patch release | `v1.1 → v1.1.1` | `v1.1.1` | 의미·contract를 바꾸지 않는 정정, link/clarity 수정 |

v1.0 이전 draft iteration은 기존 governance에 따라 `v0.1`, `v0.2`처럼 minor를 올린다. change level이 불명확하면 Architecture Review Board가 결정하고 Decision Register에 근거를 남긴다.

## Release checklist

| ID | 검사 | Required evidence |
|---|---|---|
| REL-CHK-001 | scope와 target version이 명시됨 | release plan/CR |
| REL-CHK-002 | included Document ID, version, path가 canonical registry와 일치 | Master Index/manifest |
| REL-CHK-003 | required review와 user approval 완료 | approval evidence |
| REL-CHK-004 | `CRITICAL`/`HIGH` finding 없음 | Review Checklist/report |
| REL-CHK-005 | decision, CR, ADR, risk와 assumption disposition 최신 | registers |
| REL-CHK-006 | end-to-end trace와 open `N/A` rationale 검증 | trace matrix |
| REL-CHK-007 | Markdown link, Mermaid, terminology와 naming 검증 | validation log |
| REL-CHK-008 | security/privacy review 완료 | specialist sign-off |
| REL-CHK-009 | release notes와 known limitations 작성 | release notes |
| REL-CHK-010 | manifest/checksum 및 archive copy 생성 | immutable manifest/archive evidence |

## Release approval

- Draft release: Document Author가 생성하고 status를 명시한다.
- Review release: Architecture Owner가 completeness check 후 `IN REVIEW` 전환을 승인한다.
- Approved release candidate: Architecture, Business, required specialist와 User Approver의 evidence가 필요하다.
- Frozen release: ARB recommendation, User Approver의 freeze approval, manifest/checksum과 Architecture Owner의 release attestation이 모두 필요하다.
- author는 자신의 normative release를 단독 승인할 수 없다.

## Release notes

각 approved/frozen release는 다음을 포함한다.

- release ID/version/date/status와 approvers
- added, changed, superseded, archived Document ID
- 신규·변경 decision/ADR/CR
- breaking change, migration/transition 및 rollback 영향
- risk, deferred item, known limitation과 `POST-MVP` 항목
- validation summary와 manifest link

## Archive policy

- frozen release마다 read-only manifest, checksum, release notes와 문서 snapshot을 보존한다.
- superseded document는 대체 ID/version을 연결한 뒤 [Document Lifecycle](00_DOCUMENT_LIFECYCLE.md)에 따라 `ARCHIVED`할 수 있다.
- archive는 삭제가 아니며 audit, 과거 release 재현과 legal/retention 요구를 위해 접근 가능해야 한다.
- archive 경로와 보존 기간은 F1 및 Book 9에서 정하고, credential/contact/raw source data는 documentation archive에 포함하지 않는다.
- archived artifact 복원은 새 working copy/version으로 수행하며 archive 원본을 직접 수정하지 않는다.

> **OPEN DECISION:** release artifact의 저장 위치, signing 방식과 archive retention period는 F1 전에 확정한다.
