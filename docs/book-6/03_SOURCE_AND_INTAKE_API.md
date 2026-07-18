# Source and Intake API

| 항목 | 값 |
|---|---|
| Document ID | DOC-API-004 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Source Policy Owner / Business Owner |
| 기준일 | 2026-07-14 |
| API Capabilities | API-003, API-004 |

## Purpose

승인된 source policy 아래 source evidence와 manual intake를 접수하고 AI/manual review workflow로 안전하게 인계한다. Connector input도 동일한 boundary를 사용한다.

## Logical Endpoints

| Logical operation | Method/resource | Workflow outcome |
|---|---|---|
| List/Read Sources | `GET /v{major}/sources[/{id}]` | allowed source/policy 조회 |
| Register Source Proposal | `POST /v{major}/sources` | source policy review 초안 |
| Create Intake | `POST /v{major}/intakes` | `INTAKE.DRAFT`와 evidence reference |
| Attach Evidence Reference | `POST /v{major}/intakes/{id}/evidence` | raw evidence link 추가 |
| Validate Intake | `POST /v{major}/intakes/{id}:validate` | validated/failed/quarantined disposition |
| Request AI Processing | `POST /v{major}/intakes/{id}:request-ai` | AI Job accepted |
| Submit Intake Review | `POST /v{major}/intakes/{id}:review` | correction/candidate draft/rejection decision |
| Read Intake | `GET /v{major}/intakes/{id}` | masked record, evidence and status history |

## Request Model

source registry ID/policy version, capture method/time, raw content or protected object reference, fingerprint, language/privacy/retention class, collector principal, expected version and trace context가 필요하다. Review request는 decision, reason, evidence refs와 corrected field provenance를 포함한다.

## Response Model

source/intake/raw evidence opaque IDs, canonical version/status, validation findings, quarantine reason category, provenance links 및 accepted `job_id`를 반환한다. Raw content는 별도 restricted projection이며 기본 응답에 포함하지 않는다.

## Business Rules

활성 source policy와 허용 capture method가 없으면 접수하지 않는다. Manual/CSV/connector 모두 동일 validation, provenance, duplicate 및 review gate를 통과한다. Intake approval은 candidate draft 등록만 허용하며 Verification 또는 외부 사용 권한이 아니다.

## Authority

Collector는 허용 scope에서 draft/capture, Source Policy Reviewer는 source activation/quarantine disposition, Agent/Senior Agent는 intake review를 수행한다. Connector/service principal은 capture만 가능하고 source policy나 candidate approval을 결정하지 못한다.

## Validation

source status/policy version, method, required provenance, fingerprint, malware/content safety reference, size/type class, privacy/retention, expected state/version 및 review authority를 검증한다. AI 요청 전 `INTAKE.VALIDATED`를 요구한다.

## Audit

source proposal/policy decision, raw capture/access, attachment/evidence link, validation, quarantine, AI request, correction, candidate registration/rejection을 actor/job, input checksum, reason과 trace IDs로 기록한다.

## Error Conditions

`SOURCE_NOT_ALLOWED`, `SOURCE_POLICY_STALE`, `PROVENANCE_REQUIRED`, `EVIDENCE_INVALID`, `CONTENT_QUARANTINED`, `STATE_TRANSITION_INVALID`, `VERSION_CONFLICT`, `AI_REQUEST_NOT_ELIGIBLE`, `FORBIDDEN`.

## Related Workflow

`WF-001` Listing Discovery, `WF-002` Manual Intake, `WF-003` AI Processing, `WF-012` Exception Recovery.

## Related Entity

Source Registry, Raw Source, Raw Attachment, Collector, Intake, Source Provenance, Listing Source, Candidate Listing, AI Job, Audit Event.

## Related AI Capability

`AI-001` Listing parsing, `AI-002` Property normalization, `AI-007` Confidence/output validation; all advisory.
