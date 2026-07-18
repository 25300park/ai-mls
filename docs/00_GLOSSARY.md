# Glossary

| 항목 | 값 |
|---|---|
| Document ID | DOC-CORE-006 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-07-13 |

이 용어집은 모든 Architecture Bible 문서의 표준 용어를 정의한다. lifecycle state의 상세 값은 향후 Book 5에서 정의하며, 이 문서와 충돌하면 review를 통해 함께 수정한다.

| 표준 용어 | 정의 | 구분/주의 |
|---|---|---|
| AI MLS | 여러 출처의 부동산 후보를 구조화·정규화·매칭하고 사람의 검증과 승인을 지원하는 mrHOMES 내부 Property Intelligence Platform | 초기에는 내부용이며 전통적 cooperative MLS와 동일하지 않음 |
| candidate listing | 출처에서 발견 또는 입력되어 아직 외부 사용의 권위가 없는 내부 후보 기록 | verified listing 또는 publishable listing과 구분 |
| verified listing | 권한 있는 직원이 정해진 시점에 핵심 사실과 가용성을 확인하고 검증 증거를 연결한 listing | 검증은 시간 제한이 있으며 게시 승인을 뜻하지 않음 |
| publishable listing | 유효한 verification과 별도의 public-publication permission/approval을 모두 갖춘 listing | 실제 published 상태와 구분 |
| property | 주소, 건물 또는 개발 단지 등 canonical 부동산 master 개념 | source post나 offer가 아님 |
| tower | property 안에서 구별되는 개별 동/타워 | unit entity의 상위 위치가 될 수 있음 |
| unit entity | 실제 또는 업무상 식별 가능한 개별 물리 unit | source record 및 listing offer와 분리 |
| listing offer | 특정 unit entity 또는 property에 관해 특정 조건·가격·contact·기간으로 제안된 거래 가능성 | 한 unit에 여러 offer 가능 |
| source record | 원문, URL, attachment, 수집 시각과 출처 식별자를 보존하는 provenance 기록 | raw data retention 정책 적용 |
| contact | owner, broker, agent 등과 연결되는 제한된 개인 또는 조직 연락 주체와 채널 | 최소 권한, masking, access log 필요 |
| client requirement | 임대인·구매자 등 client가 원하는 위치, 예산, 유형, 시기 및 조건의 구조화된 요구 | match result의 입력 |
| match result | client requirement와 candidate/verified listing 사이의 적합도, 근거와 score를 담은 결과 | 추천이며 승인이나 사실 확정이 아님 |
| verification | 권한 있는 사람이 출처와 contact evidence를 바탕으로 사실·가용성·시점을 확인하고 기록하는 행위 | AI가 승인할 수 없음 |
| publication approval | 공개 게시를 허용하는 사람의 명시적 승인 기록 | client-sharing permission과 별개이며 verification 필요 |
| connector | 외부 system/source와 승인된 contract로 데이터를 주고받는 core 외부 integration component | core private function 또는 publication을 직접 호출하지 않음 |
| collector | 승인된 source policy 범위에서 source data를 취득해 intake boundary로 전달하는 격리 component | connector의 한 유형일 수 있으며 MVP autonomous Facebook/Viber scraping 제외 |
| provenance | 기록이 어디서, 언제, 어떤 방식으로 왔고 어떻게 변환되었는지를 추적하는 출처·계보 정보 | 중요한 record에서 보존 필수 |
| confidence score | AI 또는 규칙 기반 결과의 확신 정도를 정해진 scale로 표현한 값 | 사실, approval 또는 permission을 대체하지 않음 |
| audit log | 누가 언제 무엇을 조회·변경·승인·게시했는지 변경 불가능성 원칙으로 기록한 보안·업무 추적 정보 | source record 및 일반 application log와 구분 |
| client-sharing permission | 특정 정보를 client에게 제한적으로 공유하도록 허용하는 명시적 권한 | public-publication permission과 독립 |
| public-publication permission | 정보를 공개 채널에 게시할 수 있도록 하는 명시적 권한 | publication approval workflow에서 확인 |
| discovered data | 출처에서 발견되었으나 검증되지 않은 내부 데이터 | 외부 노출 금지 |
| raw data | 변환 전 원문 또는 attachment | retention period와 접근 통제 적용 |

## 사용 규칙

- `candidate listing`, `verified listing`, `publishable listing`을 상호 대체어로 쓰지 않는다.
- `property`, `unit entity`, `listing offer`, `source record`를 각각 master, 물리 단위, 거래 조건, 출처 증거로 분리한다.
- `verification`, `client-sharing permission`, `publication approval`을 별도 행위와 기록으로 표현한다.
- 비표준 번역이 필요하면 첫 사용에 영문 표준 용어를 병기하고 이 문서에 추가하는 변경을 제안한다.

> **OPEN DECISION:** confidence score의 공통 수치 범위와 calibration 기준은 Book 4에서 결정한다.
