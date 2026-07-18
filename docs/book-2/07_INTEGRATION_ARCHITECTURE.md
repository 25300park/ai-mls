# Integration Architecture

| 항목 | 값 |
|---|---|
| Document ID | DOC-ARCH-008 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-07-13 |
| Authority | [Project Constitution](../book-0/00_PROJECT_CONSTITUTION.md) |

## Integration principles

- 모든 외부 시스템은 명시적 adapter와 authorization boundary를 통과한다.
- Core domain은 외부 vendor의 data model, availability, credential 형식에 종속되지 않는다.
- 외부 입력은 신뢰하지 않고 validation, provenance, policy, rate/usage control을 적용한다.
- 외부 출력은 최소 정보와 승인된 scope만 포함하며 publication은 사람 승인을 요구한다.
- 계약의 version, idempotency, timeout, retry, reconciliation, audit 책임을 분리해 검토한다.
- Connector는 core module 저장소나 publication gate에 직접 접근할 수 없다.

## Integration inventory

| Integration | Horizon | Direction | Business purpose | Boundary and status |
|---|---|---|---|---|
| rbs-homes | MVP/Phase 1 candidate | outbound plus status reconciliation | 승인된 매물의 외부 게시 | **ASSUMPTION [ASM-014]:** 사용 가능한 API/계약 존재 여부 미확인. 계약 확인 전 구현 약속 없음 |
| AI Provider | MVP | outbound request/inbound advisory result | parsing, normalization assistance, future ranking support | provider-independent layer 필수; AI는 승인 권한 없음 |
| AI Memory Gateway | FUTURE | controlled bidirectional context | 승인된 장기 맥락과 모델 간 중개 | privacy, consent, retention, tenant isolation 결정 전 사용 금지 |
| CRM | FUTURE | selected bidirectional synchronization | 고객 관계·활동 연계 | system of record와 conflict policy 미결정 |
| Accounting | FUTURE | limited outbound/reference sync | 거래·수익 운영 연계 | financial authority와 최소 데이터 범위 미결정 |
| Marketing platform | FUTURE | approved outbound campaign data/status | 허용된 매물·고객 커뮤니케이션 | consent, channel approval, withdrawal 반영 필요 |
| Source Connectors | POST-MVP | inbound through scoped intake | 허용 source에서 후보 발견 보조 | source permission, account custody, rate, checkpoint 격리 필요 |
| Future broker network | POST-MVP | governed exchange | cooperative MLS 참여자 간 공유 | membership, trust, standards, dispute governance 선행 필요 |

## rbs-homes boundary

rbs-homes adapter는 Publication Approval에서 생성된 승인된 명령만 수신한다. adapter는 매물의 진실성, 공개 가능성 또는 연락처 노출 범위를 결정하지 않는다. 외부 reference, 요청 결과, 재시도와 reconciliation을 기록하되 core의 authoritative state를 외부 응답만으로 무조건 덮어쓰지 않는다.

> **OPEN DECISION:** rbs-homes가 실제로 제공하는 인증, API, idempotency, 상태 조회, 삭제/철회 기능과 운영 소유자를 확인해야 한다.

## AI provider boundary

AI Provider Layer는 provider별 요청·응답을 내부의 provider-neutral intent/result envelope로 변환한다. 외부 모델에 전달할 데이터는 목적에 필요한 최소 범위로 제한하고 민감정보 처리 정책을 적용한다. 잘못된 형식, 낮은 confidence, timeout, policy violation은 application validation에서 차단한다.

## Connector boundary

Future Connector는 별도 credential scope, source policy, health, checkpoint, rate control을 갖고 비활성화 가능해야 한다. 발견 결과는 동일한 Intake→Evidence→Candidate 경로로 들어오며, connector가 Verified 또는 Published 상태를 만들 수 없다. 출처 약관·로봇 정책·사용자 승인에 맞지 않는 자동 수집은 허용하지 않는다.

## Contract governance

각 integration 착수 전 owner, purpose, data classification, system of record, authentication, authorization scope, versioning, error taxonomy, retry/idempotency, reconciliation, observability, retention/deletion, shutdown 절차를 문서화하고 승인한다. 구체적 endpoint와 payload는 Book 6 범위이며 이 문서에는 포함하지 않는다.

## Assumptions and constraints

- 외부 서비스 기능과 상업 조건은 검증 전 `ASSUMPTION`이다.
- 외부 장애는 core의 검색·검증 가능한 기록을 손상시키지 않아야 한다.
- 동기 호출이 사용자 핵심 흐름을 장시간 결합시키지 않도록 비동기 전환 가능성을 유지한다.
- 새로운 integration은 [Change Request Register](../00_CHANGE_REQUEST_REGISTER.md)와 필요 시 ADR 검토를 거친다.
