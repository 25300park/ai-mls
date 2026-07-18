# Architecture Decision Record Workflow

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-008 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |

ADR은 중요한 architecture 결정, 대안과 영향을 변경 불가능한 이력으로 남긴다. 문서 change control은 [Document Governance](../00_DOCUMENT_GOVERNANCE.md), 형식은 [ADR Template](../templates/ADR_TEMPLATE.md)을 따른다.

## 생성 대상

- 여러 Book, module 또는 팀에 영향을 주는 결정
- 보안, 개인정보, provenance, retention, 권한 또는 publication boundary 변경
- 기술 stack, repository boundary, data store, integration contract 선택
- 승인 또는 동결된 결정을 대체하는 변경
- 되돌리기 어렵거나 장기 비용이 큰 선택

단순 편집, 승인된 결정의 비기능적 명확화, 국소적인 가역 구현 세부는 ADR 없이 review 기록으로 처리할 수 있다.

## 이름과 번호

- 파일명: `ADR-NNN-SHORT-TITLE.md`
- 번호는 세 자리의 다음 미사용 순번이며 재사용하지 않는다.
- 제목과 기술 식별자는 English를 사용하고 설명은 Korean을 기본으로 한다.
- 폐기된 ADR도 삭제하지 않고 status와 대체 ADR 링크를 남긴다.

## 흐름

1. Author가 `DRAFT` ADR을 만들고 context, decision, alternatives, consequences, security/privacy impact를 작성한다.
2. 영향받는 문서를 연결하고 `OPEN DECISION`을 명시한다.
3. Architecture Owner와 필요한 Product/Security/Privacy reviewer가 검토한다.
4. 승인 시 status와 decision date를 기록하고 영향 문서 및 [Version History](../00_VERSION_HISTORY.md)를 갱신한다.
5. 동결 결정을 변경하려면 새 ADR이 이전 ADR을 `SUPERSEDED`하며 과거 기록은 보존한다.

ADR status는 [Document Lifecycle](../00_DOCUMENT_LIFECYCLE.md)의 canonical document status를 사용한다.

## ADR register

| ADR | 제목 | 상태 | 대체 관계 |
|---|---|---|---|
| [ADR-001](ADR-001-SEPARATE-AI-MLS-REPOSITORY.md) | Separate AI MLS Repository | FROZEN | None |
| [ADR-002](ADR-002-MODULAR-MONOLITH-MVP.md) | Modular Monolith MVP | FROZEN | None |
| [ADR-003](ADR-003-POSTGRESQL-PREFERRED.md) | PostgreSQL Preferred | IN REVIEW | None |
| [ADR-004](ADR-004-HUMAN-APPROVAL-FOR-PUBLICATION.md) | Human Approval for Publication | FROZEN | None |
| [ADR-005](ADR-005-CONNECTOR-ISOLATION.md) | Connector Isolation | FROZEN | None |
| [ADR-006](ADR-006-PROVIDER-INDEPENDENT-AI-LAYER.md) | Provider-independent AI Layer | FROZEN | None |

ADR-001/002/004/005/006은 Phase 16에서 v1.0 baseline으로 동결되었다. ADR-003은 provider/data/security/operations evidence가 없어 `IN REVIEW`로 유지한다. Frozen ADR도 구현 시작 권한을 뜻하지 않으며 정식 decision status는 [Decision Register](../00_DECISION_REGISTER.md)에서 관리한다.
