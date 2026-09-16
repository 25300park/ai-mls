# REL-001 Blocker 2C Component Fingerprint Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-264 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Release Owner / Quality Owner |
| 기준일 | 2026-09-16 |

## Algorithm

기존 FEAT-024 직렬화와 SHA-256 알고리즘은 변경하지 않았다. `generatedAt`은 logical identity에서 제외된다. 동일 exact candidate의 반복 materialization은 같은 identities를 반환하며 포함 runtime byte 변경은 component/artifact/candidate identities를 변경한다.

## Exact component results

| Component | Files | SHA-256 |
|---|---:|---|
| `ADMIN_CONSOLE_STAGING` | 16 | `06f1fd8c66295c9f592c05339a3faaec7a143dedb19240b6cfaea0d024c3348a` |
| `API-015_ADMINISTRATION_HTTP` | 19 | `4a0900d5fbedc3a7889e9679d5b84107f30e68e80760cb2a214966eaf34db5b4` |
| `API-016_AUDIT_RUNTIME` | 7 | `2cc2cd66f9e86c21f8c5e1a9d860e68aa14d161ad20a848949e2dbafcbc1a5e9` |
| `API-017_JOB_RUNTIME` | 4 | `74d0e47db7c3be636ee98276c33215e8d1daf9115f660334d959ec0a5cc0c599` |
| `CORE_API_001_002_HTTP` | 14 | `683f9817c3d71342f1c8e8aee05be471e28c4e676c4b1c5da72624b5ae92b030` |
| `CORE_CLIENT_REQUIREMENT_STORE` | 1 | `3f80bec24dd5639b27bd258ce21422cf3f68722177386427f09d0a7209edf928` |
| `CORE_CONTACT_STORE` | 3 | `2355bbce23473fe8db8efdc5c69b5499e0410a78befd4b8a96e1556cc52a9642` |
| `CORE_INTAKE_STORE` | 3 | `ae04b5e7b94812d3da85b5eb2e833fcfa06960d9e0560ff9775479ccbba19189` |
| `CORE_LISTING_STORE` | 3 | `37f75f376d5f6ded5b1ce68f3b732a1b41eb92486ec14503b4853f1dcdbda81e` |
| `CORE_MATCHING_STORE` | 3 | `e3d79020e7438767acdaa5ed7616525953ba8bf799f2bd2eeeacb6b15d2009c1` |
| `CORE_PROPERTY_STORE` | 3 | `77d417c7d869e629ed46670895c548b34d42e508d109570b0e89b7af1da90777` |
| `CORE_SOURCE_REGISTRY_STORE` | 3 | `9a826644b9897719af4f294302af04673b6d02d9debaaf3756cc8e4be0c07263` |
| `FEAT-022_ADVISORY_DURABLE_RUNTIME` | 6 | `876f84793e9af8f27f92137cc887f0657dd05f0bd31a737d69b6dbf656672d03` |
| `FEAT-022_PROVIDER_INDEPENDENT` | 8 | `2b29188389fcb8b4f030bd3fbdcceaff34db0b1b76dd51afc53a89dfee060bc0` |
| `OPERATIONAL_EVIDENCE_STORE` | 5 | `824034c82046ce3dc529530a49f19eb3c63d27a60a7fe442b409e1062b28c7cb` |
| `OPERATIONAL_READINESS_EVIDENCE` | 3 | `47717295bab46d9d1a4e08297c499a3617fec77e109a496270dcd883a09ae1e1` |
| `OPERATIONAL_SECURITY_CONTROLS` | 5 | `df0b075a85923b6f2044b81488d4bf8f0a5b8f04bd58ba2dd63d99bcf0494832` |
| `SESSION_AUTH` | 6 | `4242338d4453d3eb827f60844bb711b4a4e6411ad21c71703a98461178e7789a` |
| `STAGING_INTEGRATED_COMPOSITION` | 1 | `ac477b7d6e420bbc97be51744c14bb49d5693a7c62fb6abb2f028b6004d7b8ec` |

API-001과 API-002는 canonical shared component `CORE_API_001_002_HTTP`에 함께 묶인다. Session/Auth는 `SESSION_AUTH`, UI-006 live Core adapter와 presentation path는 `ADMIN_CONSOLE_STAGING`, API-015/016/017 및 FEAT-022 provider-independent paths는 각각의 기존 component로 계산했다. 별도 component vocabulary나 중복 root는 추가하지 않았다.

## Candidate identity

| Identity | Value |
|---|---|
| Artifact fingerprint | `7fef924f0178d732ca4a1bd4ee5c83c0eea7a5dafb8b1a2a28747784bbe5c659` |
| Release candidate ID | `3ad9f7a3ed241f2e04745c55cbd94a1058d5afac1c652d8c4b5830da5e24e5c1` |
| Candidate fingerprint | `c8874506b7c4a0b815210ca5bb0e8514ef06c42d391dd26c4c503037d0a65d8d` |

Historical Phase 7 및 Blocker 1C identities와 문서는 수정하지 않았다. Current runtime bytes를 historical source SHA로 재물질화하지 않는다.

Related: [Runtime Inventory](REL001_BLOCKER2C_RUNTIME_CLOSURE_INVENTORY.md), [Blocker 1C Matrix](REL001_BLOCKER1C_COMPONENT_FINGERPRINT_MATRIX.md).
