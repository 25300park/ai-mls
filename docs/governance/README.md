# AI-MLS Governance Baseline

| 항목 | 값 |
|---|---|
| Version | v1.0 |
| Status | APPROVED |
| Document Lifecycle | APPROVED |
| Owner | Architecture Owner |
| Effective From | Before SP-004 |

## 목적

`docs/governance/`는 AI-MLS 구현 전반에 적용되는 영구 governance baseline을 제공한다. 이 디렉터리는 architecture decision, requirement traceability, model governance와 sprint completion gate를 한 위치에서 탐색할 수 있게 하며, 동결된 Architecture Bible을 대체하거나 수정하지 않는다.

## 문서 관계

| 문서 | 역할 | 관계 |
|---|---|---|
| [Architecture Bible](../00_MASTER_INDEX.md) | 제품, domain, API, workflow, AI, security와 delivery architecture의 승인된 source of truth | 구현 범위와 canonical ID를 정의한다. governance 문서는 이를 변경하지 않는다. |
| [ADR Register](ADR_REGISTER.md) | 중요한 architecture decision과 deferred production decision 기록 | Architecture Bible을 적용하거나 변경할 때 기존 ADR을 참조하거나 successor ADR을 요구한다. |
| [Requirements Traceability Matrix](REQUIREMENTS_TRACEABILITY_MATRIX.md) | requirement에서 release까지의 완전한 trace chain 규칙 | 모든 구현 artifact가 승인된 business requirement와 연결되도록 통제한다. |
| [Model Decision Register](MODEL_DECISION_REGISTER.md) | model, provider, prompt, embedding, confidence와 evaluation decision 기록 | provider-neutral domain boundary를 유지하면서 AI-specific decision을 승인 가능하게 만든다. |
| [Definition of Done](DEFINITION_OF_DONE.md) | sprint completion과 acceptance의 mandatory gate | scope, architecture, quality, test, security, integrity, repository, documentation과 owner approval을 모두 요구한다. |

## 우선순위와 normative status

다음 문서는 normative governance document다.

1. 승인 또는 동결된 Architecture Bible
2. Accepted ADR과 이 [ADR Register](ADR_REGISTER.md)
3. 승인된 [RTM](REQUIREMENTS_TRACEABILITY_MATRIX.md)
4. Accepted MDR과 이 [MDR](MODEL_DECISION_REGISTER.md)
5. mandatory [Definition of Done](DEFINITION_OF_DONE.md)

상충 시 [AGENTS.md](../../AGENTS.md)의 source-of-truth 우선순위와 [Document Governance](../00_DOCUMENT_GOVERNANCE.md)를 적용한다. 충돌을 조용히 해석하여 변경하지 않고 Architecture Owner에게 보고한다.

## Update policy

- Accepted ADR은 in-place로 의미를 변경하지 않는다. 변경에는 successor ADR과 명시적 supersession이 필요하다.
- Requirement 또는 구현 artifact가 변경되면 같은 승인 change에서 RTM의 모든 영향 link를 갱신한다.
- AI provider, model, prompt, embedding, threshold 또는 evaluation policy를 채택·변경하려면 Accepted MDR이 필요하다.
- Definition of Done의 acceptance gate는 Architecture Owner 승인 없이 삭제하거나 완화하지 않는다.
- 모든 normative 변경은 version, status, approval date, Architecture Owner approval과 관련 ADR/RTM/MDR reference를 남긴다.
- 동결 Architecture Bible은 직접 수정하지 않는다. 승인된 change-control과 successor document를 사용한다.

## Evidence와 generated artifacts

다음은 normative decision을 정의하지 않고 준수 사실을 증명하는 evidence 또는 generated artifact다.

- [Sprint completion reports](../reviews/)
- [Development plans and test evidence](../development/)
- lint, typecheck, build, test, Gitleaks와 dependency audit output
- release manifest, checksum, coverage와 traceability validation report

Evidence document는 normative governance를 대체할 수 없으며, 재생성되더라도 source requirement와 commit/release reference를 유지해야 한다.

## Exit rule

SP-004 및 이후 sprint는 적용 가능한 ADR, 완전한 RTM link, 필요한 Accepted MDR와 Definition of Done을 충족해야 한다. 누락된 governance link 또는 승인 없는 deferred decision 선택은 implementation blocker다.
