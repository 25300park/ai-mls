# REL-001 Blocker 1C Component Fingerprint Matrix

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-256 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Release Owner / Quality Owner |
| 기준일 | 2026-09-16 |

## 1. Algorithm

기존 FEAT-024 직렬화와 SHA-256 알고리즘을 변경하지 않았다. `generatedAt`은 logical identity에서 제외된다. 동일 exact candidate를 다른 `generatedAt`으로 두 번 물질화하면 artifact, release candidate, candidate fingerprint가 모두 동일하고, 포함 runtime byte 하나가 바뀌면 모두 달라진다.

## 2. Exact component results

| Component | Root | Files | SHA-256 |
|---|---|---:|---|
| `ADMIN_CONSOLE_STAGING` | `apps/api/src/staging-admin-console-bootstrap.js` | 15 | `9d80cda190f04b3ced88b02a2349f3503592589f5995acb034326f8f938579b2` |
| `API-015_ADMINISTRATION_HTTP` | `apps/api/src/administration-production-composition.js` | 19 | `4a0900d5fbedc3a7889e9679d5b84107f30e68e80760cb2a214966eaf34db5b4` |
| `API-016_AUDIT_RUNTIME` | `apps/api/src/api016-production-composition.js` | 7 | `2cc2cd66f9e86c21f8c5e1a9d860e68aa14d161ad20a848949e2dbafcbc1a5e9` |
| `API-017_JOB_RUNTIME` | `modules/jobs/src/job-staging-composition.js` | 4 | `74d0e47db7c3be636ee98276c33215e8d1daf9115f660334d959ec0a5cc0c599` |
| `CORE_API_001_002_HTTP` | `apps/api/src/core-identity-authorization-composition.js` | 14 | `683f9817c3d71342f1c8e8aee05be471e28c4e676c4b1c5da72624b5ae92b030` |
| `CORE_CLIENT_REQUIREMENT_STORE` | `modules/client/src/client-requirement-durable-persistence.js` | 1 | `3f80bec24dd5639b27bd258ce21422cf3f68722177386427f09d0a7209edf928` |
| `CORE_CONTACT_STORE` | `modules/contact/src/contact-durable-persistence.js` | 3 | `2355bbce23473fe8db8efdc5c69b5499e0410a78befd4b8a96e1556cc52a9642` |
| `CORE_INTAKE_STORE` | `modules/intake/src/intake-durable-persistence.js` | 3 | `ae04b5e7b94812d3da85b5eb2e833fcfa06960d9e0560ff9775479ccbba19189` |
| `CORE_LISTING_STORE` | `modules/listing/src/listing-durable-persistence.js` | 3 | `37f75f376d5f6ded5b1ce68f3b732a1b41eb92486ec14503b4853f1dcdbda81e` |
| `CORE_MATCHING_STORE` | `modules/matching/src/matching-durable-persistence.js` | 3 | `e3d79020e7438767acdaa5ed7616525953ba8bf799f2bd2eeeacb6b15d2009c1` |
| `CORE_PROPERTY_STORE` | `modules/property/src/property-durable-persistence.js` | 3 | `77d417c7d869e629ed46670895c548b34d42e508d109570b0e89b7af1da90777` |
| `CORE_SOURCE_REGISTRY_STORE` | `modules/source/src/source-registry-durable-persistence.js` | 3 | `9a826644b9897719af4f294302af04673b6d02d9debaaf3756cc8e4be0c07263` |
| `FEAT-022_ADVISORY_DURABLE_RUNTIME` | `modules/ai/src/advisory-production-composition.js` | 6 | `876f84793e9af8f27f92137cc887f0657dd05f0bd31a737d69b6dbf656672d03` |
| `FEAT-022_PROVIDER_INDEPENDENT` | `modules/ai/src/advisory-readiness-composition.js` | 8 | `2b29188389fcb8b4f030bd3fbdcceaff34db0b1b76dd51afc53a89dfee060bc0` |
| `OPERATIONAL_EVIDENCE_STORE` | `modules/operations/src/durable-operational-evidence-store.js` | 5 | `824034c82046ce3dc529530a49f19eb3c63d27a60a7fe442b409e1062b28c7cb` |
| `OPERATIONAL_READINESS_EVIDENCE` | `modules/operations/src/operational-readiness-evidence.js` | 3 | `47717295bab46d9d1a4e08297c499a3617fec77e109a496270dcd883a09ae1e1` |
| `OPERATIONAL_SECURITY_CONTROLS` | `modules/operations/src/security-privacy-operational-controls.js` | 5 | `df0b075a85923b6f2044b81488d4bf8f0a5b8f04bd58ba2dd63d99bcf0494832` |
| `SESSION_AUTH` | `apps/api/src/staging-session-composition.js` | 6 | `4242338d4453d3eb827f60844bb711b4a4e6411ad21c71703a98461178e7789a` |
| `STAGING_INTEGRATED_COMPOSITION` | `apps/api/src/staging-integrated-runtime-verification.js` | 1 | `ac477b7d6e420bbc97be51744c14bb49d5693a7c62fb6abb2f028b6004d7b8ec` |

## 3. Candidate identity

| Identity | Value |
|---|---|
| Artifact fingerprint | `557af70887a1d47b956f1f480dbb726a6b054cfec5d696dea134140e623887cf` |
| Release candidate ID | `2f0044be01b5819469528e5f245c0f50b26575c6d6e1d327a5659aaf8f8373dd` |
| Candidate fingerprint | `d5bd2cb64212141a28082bc2a604d5715fcba7972f68c30e97891a9370855570` |

## 4. Historical immutability

Historical Phase 7 문서와 recorded identities — source `cd620b273c8e7672ffc1e015380ce36d486d9a9a`, artifact `0bdee557...`, release candidate `e9244c1d...`, candidate fingerprint `9a74e4d1...`, `18 roots / 65 files` — 는 수정하지 않았다. Phase 7 root/coverage definition도 유지하지만, 현재 `dist` bytes로 과거 source SHA를 재물질화하지 않는다. 새 candidate는 predecessor를 덮어쓰지 않는다.

Related: [Runtime Inventory](REL001_BLOCKER1C_RUNTIME_CLOSURE_INVENTORY.md), [Historical Fingerprints](REL001_PHASE7_COMPONENT_FINGERPRINT_MATRIX.md).
