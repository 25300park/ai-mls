# Architecture v1.1 Baseline Manifest

| 항목 | 값 |
|---|---|
| Document ID | DOC-FREEZE-009 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner / Release Owner |
| 기준일 | 2026-07-26 |
| Candidate | Architecture Bible v1.1 |
| Immutable content commit | `426f6de0cdcf8c384f70c3e333f7b6483616bd15` |
| Git tree | `02db8c3599ac1d9463ac6f521a2fd288aa2bf768` |
| Baseline checksum | `76ad7f9de4e62ee2701baf52f9fd1e809edeacc93abdde9f216a8113bebed778` |

## 1. Purpose

Phase 12 remediation 결과의 immutable candidate baseline을 정의한다. 기존 [Architecture v1.0 Freeze Manifest](FREEZE_MANIFEST_V1.md)는 변경하지 않으며, 이 manifest는 v1.0 위에 Book 0~9와 Phase 11 canonical Registry 정렬을 추가하는 v1.1 후보 증거다.

## 2. Baseline scope

| Scope | Files | Integrity source |
|---|---:|---|
| `docs/book-0/` ~ `docs/book-9/` Markdown | 143 | immutable content commit의 Git blob |
| Canonical Registry | 10 | 아래 Frozen Registry Snapshot |
| Total primary architecture scope | 153 | sorted path/blob checksum |

Review report, index, source code, database schema, runtime configuration과 FEAT-015 implementation은 checksum scope가 아니다. 이 제외는 삭제나 권한 변경을 뜻하지 않는다.

## 3. Frozen Registry Snapshot

`Frozen Registry Snapshot`은 아래 파일 내용을 immutable content commit의 Git blob으로 고정한다는 뜻이다. 각 문서의 lifecycle status는 User Approver 승인 전까지 `IN REVIEW`이며, 이 snapshot 자체가 `APPROVED` 또는 `FROZEN` 전환을 대신하지 않는다.

| Registry | Version | Lifecycle status | Git blob |
|---|---|---|---|
| `docs/00_API_REGISTRY.md` | v0.1 | IN REVIEW | `1fb3d316c96e0f365af64e7f378233b9e999e445` |
| `docs/00_CANONICAL_TRACEABILITY_MATRIX.md` | v1.4 | IN REVIEW | `ff4260207f63948e08074236fdb20c1ed2fcaa04` |
| `docs/00_DECISION_REGISTER.md` | v1.3 | IN REVIEW | `b02f94efb3204b8a330c90fba835cce7c4dcdd0a` |
| `docs/00_EVENT_REGISTRY.md` | v0.1 | IN REVIEW | `fbcc7a0abc71cf8db9f48f4ad49c778bedef6bbb` |
| `docs/00_OPERATIONS_REGISTRY.md` | v0.1 | IN REVIEW | `a6e0d04eba35ad4f069db41077ebe082a1c465db` |
| `docs/00_PROJECTION_REGISTRY.md` | v0.1 | IN REVIEW | `9b4ddd1ca4bfb5e4a12ea7af1d007c4b254f8acd` |
| `docs/00_PUBLICATION_REGISTRY.md` | v0.1 | IN REVIEW | `b4eae0d0b36be4e0bbbae1dbfc639df3124f1485` |
| `docs/00_SECURITY_REGISTRY.md` | v0.1 | IN REVIEW | `d2c187e41af526cd776507bed8235882cbfcadcd` |
| `docs/00_TEST_REGISTRY.md` | v0.1 | IN REVIEW | `50fd36bc821c024a4de30835a5b213771e66c986` |
| `docs/00_WORKFLOW_REGISTRY.md` | v0.1 | IN REVIEW | `e4064bef178286c20aff7d2117d3cdbc65268088` |

## 4. Canonical identity inventory

| Namespace | Count | Duplicate |
|---|---:|---:|
| DEC | 112 | 0 |
| TRACE | 24 | 0 |
| Publication lifecycle state | 8 | 0 |
| WF | 12 | 0 |
| API | 19 | 0 |
| SEC | 34 | 0 |
| PRJ | 8 | 0 |
| EVT | 12 | 0 |
| OPS | 32 | 0 |
| TST | 10 | 0 |

## 5. Checksum algorithm

1. Immutable content commit에서 `docs/book-0/`~`docs/book-9/`의 Markdown과 위 10개 Registry를 선택한다.
2. Git path를 ordinal ascending으로 정렬한다.
3. 각 행을 `path<TAB>git-blob-oid<LF>` UTF-8로 직렬화한다.
4. 전체 byte stream에 SHA-256을 적용한다.
5. 결과는 [Baseline Checksum](ARCHITECTURE_V1_1_BASELINE_CHECKSUM.sha256)과 일치해야 한다.

## 6. Freeze disposition

- Content integrity: VERIFIED.
- Cross-Registry mapping: VERIFIED 9/9.
- Lifecycle approval: PENDING — User Approver가 10개 Registry의 `APPROVED` 전환과 v1.1 freeze를 명시적으로 승인해야 한다.
- Candidate status: FREEZE-READY CONTENT / NOT FROZEN.

## 7. Related evidence

- [Architecture Remediation Report](../reviews/PHASE12_ARCHITECTURE_REMEDIATION.md)
- [Cross-Registry Final Validation Report](../reviews/PHASE12_CROSS_REGISTRY_FINAL_VALIDATION.md)
- [Freeze Readiness Report](../reviews/PHASE12_FREEZE_READINESS.md)
- [Phase 12 Completion Report](../reviews/PHASE12_ARCHITECTURE_REMEDIATION_COMPLETION.md)
