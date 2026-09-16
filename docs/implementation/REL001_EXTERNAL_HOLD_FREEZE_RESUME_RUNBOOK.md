# REL-001 External Hold Freeze / Resume Runbook

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-273 |
| 문서 버전 | v0.1 |
| 상태 | IN REVIEW |
| 소유 역할 | Architecture Owner / Release Owner / Security Owner |
| 기준일 | 2026-09-16 |

## 1. Freeze baseline

이 문서는 repository 또는 provider 상태를 변경하지 않고 REL-001의 external hold를 운영상 동결한다. 동결은 Git tag, deployment freeze 또는 provider activation이 아니다.

| 항목 | 동결 값 |
|---|---|
| Exact Main HEAD | `585f7ec646a2bec9edca4c19a6abfff95beb96fb` |
| Repository blockers | `0` |
| External blockers | `1` |
| Blocker classification | `EXTERNAL_ACCOUNT_AND_CONTRACT_DEPENDENCY` |
| Provider-independent FEAT-022 | `3/3 READY` |
| Live provider | `0/3 NOT_READY` |
| DEC-162 | historical `IN_REVIEW` preserved |
| DEC-163 | `APPROVED / DEFERRED_EXTERNAL_DEPENDENCY` |
| Staging Acceptance | `INCOMPLETE` |
| Promotion Handoff | `UNAVAILABLE` |
| Production readiness | `NOT_AUTHORIZED` |

## 2. Resume triggers

Resume review는 다음 중 하나 이상이 authoritative account/contract evidence로 materially changed 되었을 때만 시작한다.

1. Dedicated OpenAI Staging project가 존재한다.
2. Korea residency eligibility 또는 configuration이 변경된다.
3. MAM approval이 사용 가능해진다.
4. ZDR approval이 사용 가능해진다.
5. Required retention/amendment가 완료된다.
6. Project-scoped Staging credential reference 구성이 가능해진다.

단순한 문서 재진술, 시간 경과, provider-independent code 변경 또는 동일한 account 화면의 재확인은 resume trigger가 아니다.

## 3. Resume evidence gate

첫 단계는 authenticated read-only account/contract verification이다. 다음 항목을 실제 관찰 근거로 다시 기록한다.

| Evidence | Required resume value |
|---|---|
| `OPENAI_STAGING_PROJECT` | `VERIFIED` |
| `KOREA_RESIDENCY` | `VERIFIED` |
| `MAM_STATUS` / `ZDR_STATUS` | approved required state |
| `REQUIRED_AMENDMENT_STATUS` | `VERIFIED` |
| `CREDENTIAL_REFERENCE_CONFIGURATION` | `POSSIBLE` |

하나라도 충족되지 않거나 evidence가 unavailable이면 fail closed한다. DEC-162를 activation approval로 전환하지 않고 live provider `0/3 NOT_READY`, Acceptance `INCOMPLETE`, Promotion Handoff `UNAVAILABLE`를 유지한다.

## 4. Resume procedure

모든 required account/contract evidence가 확인된 뒤에도 다음 단계를 순서대로 수행한다.

1. Authenticated read-only account evidence check를 완료한다.
2. Historical DEC-162를 보존하면서 activation eligibility를 별도 승인 절차로 재평가한다.
3. Exact provider destination, permitted metadata/data projection, call ceiling과 environment를 명시한 scoped live-provider network approval을 요청한다.
4. 승인 후에만 AI-001/AI-004/AI-005 각각 최대 2회, 총 6회의 bounded Staging validation을 실행한다. Provider retry, provider fallback, model fallback은 모두 `0`이다.
5. Validation evidence가 확정된 exact Main HEAD에서 release candidate와 artifact/candidate fingerprints를 다시 생성한다. Historical candidate evidence는 수정하지 않는다.
6. Exact-candidate evidence로 Staging Acceptance를 재평가한다.
7. Acceptance 결과가 canonical handoff prerequisites를 충족할 때만 Promotion Handoff gate를 재평가한다.

각 단계 실패 시 후속 단계를 실행하지 않으며 직전 authoritative 상태를 보존한다.

## 5. Frozen-period prohibitions

External hold가 유지되는 동안 다음은 금지한다.

- provider inference 또는 billable request;
- API key 생성, 회전, 삭제 또는 credential value 노출;
- provider network activation 또는 account/project setting 변경;
- Production activation, deployment 또는 promotion;
- external prerequisite를 우회하기 위한 code/API/authority/state 변경;
- live provider, Acceptance, Promotion Handoff 또는 Production readiness의 false READY claim;
- 자동 retry, fallback 또는 validation ceiling 확장.

## 6. Ownership and evidence preservation

- Account/project, residency, MAM/ZDR와 amendment evidence는 external owner가 제공한다.
- Architecture Owner는 activation eligibility와 Decision evidence를 승인한다.
- Security Owner는 outbound projection, credential-reference boundary와 scoped network approval을 검토한다.
- Release Owner는 exact candidate, Acceptance와 Promotion Handoff 재평가를 소유한다.
- Secret value, raw provider payload, prompt/business record 또는 Production credential은 runbook evidence에 포함하지 않는다.

Related: [External Hold Disposition](REL001_FINAL_BLOCKER_PROVIDER_EXTERNAL_HOLD_DISPOSITION.md), [DEC-162 / DEC-163 Disposition](REL001_DEC162_FINAL_DISPOSITION.md), [Acceptance Boundary](REL001_STAGING_ACCEPTANCE_BOUNDARY_UPDATE.md), [Promotion Handoff Constraints](REL001_PROMOTION_HANDOFF_EXTERNAL_DEPENDENCY_CONSTRAINTS.md).

## Final result

`REL001_EXTERNAL_HOLD_FREEZE_COMPLETE`
