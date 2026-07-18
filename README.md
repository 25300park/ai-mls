# mrHOMES AI MLS

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-002 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |
| Architecture Version | v1.0 Frozen |
| 기준일 | 2026-07-13 |

mrHOMES AI MLS는 여러 출처에서 부동산 후보를 발견하거나 입력받아 구조화·정규화하고, 고객 요구사항과 매칭하며, 직원 검증을 거친 정보만 고객 공유 또는 `rbs-homes.com` 게시로 연결하는 내부 Property Intelligence Platform이다. AI는 추천하고 사람이 승인한다. 미검증 후보는 내부에만 유지하며, 발견·검증·고객 공유·공개 게시 상태와 권한을 분리한다.

## Documentation-first 프로세스

이 저장소는 생산 코드보다 Architecture Bible을 먼저 완성한다. 각 Brief는 관련 문서를 먼저 읽고, 하나의 Brief만 수행하며, 검증과 완료 보고서를 남긴 뒤 중단한다. 문서 단계에서는 생산 기능, 최종 데이터베이스 스키마, 최종 API endpoint, UI, AI Parser 또는 Collector를 구현하지 않는다.

문서 탐색은 [Master Index](docs/00_MASTER_INDEX.md), 운영 규칙은 [Document Governance](docs/00_DOCUMENT_GOVERNANCE.md), 용어는 [Glossary](docs/00_GLOSSARY.md), 변경 이력은 [Version History](docs/00_VERSION_HISTORY.md)를 기준으로 한다. Codex 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

## 단계 순서

| 구간 | Brief | 결과 |
|---|---|---|
| 기반 | A0 | 문서 작업공간, 탐색, 용어, 거버넌스, 템플릿 |
| Architecture Bible | A1–A13 | Book 0–12 |
| 검토 | Phase 14–15 (`R1`–`R2` legacy alias) | 전면 검토 및 승인된 수정 |
| 동결 | Phase 16 (`F1` legacy alias) | Architecture Bible v1.0 동결 |
| 개발 시작 | D0 | 승인된 문서에 따른 Phase 0 기반 구축 |

실행 순서는 `A0 → A0.5 → A0.6 → A1 → A2 → A3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 7.5 → Phase 8 → Phase 9 → Phase 10 → Phase 11 → Phase 12 → Phase 13 → Phase 14 → Phase 15 → Phase 16 → D0`이다. `R1`, `R2`, `F1`은 각각 Phase 14, Phase 15, Phase 16의 legacy alias다. 다음 Brief를 자동으로 시작하지 않으며, 지정된 사용자 검토 gate를 통과해야 한다.

## 핵심 원칙

- AI recommends; humans approve.
- 미검증 candidate listing은 외부에 노출하지 않는다.
- client-sharing permission과 public-publication permission은 별개다.
- 중요한 기록은 provenance와 audit log를 보존한다.
- contact 정보는 제한하고 접근을 기록한다.
- connector와 collector는 AI MLS core에서 분리한다.
- MVP에는 자율 Facebook/Viber scraping을 포함하지 않는다.

## 현재 범위

현재 Architecture Bible은 [Freeze Manifest](docs/freeze/FREEZE_MANIFEST_V1.md)와 [Freeze Baseline](docs/freeze/FREEZE_BASELINE.md)에 따라 `v1.0 / FROZEN`이다. ADR-003과 대응 DEC-013, DEC-062, DEC-065는 evidence가 필요한 open status를 유지한다. 향후 변경과 개발은 [Master Index](docs/00_MASTER_INDEX.md), [Canonical Traceability Matrix](docs/00_CANONICAL_TRACEABILITY_MATRIX.md)와 frozen change process를 따른다.
