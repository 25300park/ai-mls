# Threat Model

| 항목 | 값 |
|---|---|
| Document ID | DOC-SEC-012 |
| 문서 버전 | v1.0 |
| 상태 | FROZEN |
| 소유 역할 | Security Owner / Architecture Owner |
| 기준일 | 2026-07-14 |

## Method and boundary

Logical assets, trust boundaries, threat actors, abuse scenarios, preventive/detective/recovery principles와 residual risk를 검토한다. Specific product vulnerability, penetration test 또는 quantitative likelihood는 Phase 9 범위 밖이다.

## Assets

- identity, role, session, credential, key/secret와 authorization policy
- raw source/provenance, contact/client/requirement와 property/listing data
- Verification, Permission, Publication Approval와 exact published representation
- AI Job/Result/prompt/model/provider context와 derived data
- Audit Event/history/security log, incident와 compliance evidence
- connector/integration contract, job/checkpoint, export와 external publication state
- backup, recovery material, retention/legal hold와 system availability

## Threat actors

| Actor | Capability/intent |
|---|---|
| External attacker | credential attack, enumeration, injection, exfiltration, disruption |
| Malicious/curious insider | need-to-know bypass, bulk access/export, unauthorized approval/publication |
| Compromised account/device | legitimate session misuse, privilege escalation, token replay |
| Compromised service/connector | forged intake/delivery, mass extraction, replay, boundary bypass |
| Third-party/provider | over-retention, unauthorized use/training, breach, misleading response |
| Accidental user/operator | wrong recipient/version, misclassification, destructive recovery/configuration |
| AI-induced error/attack | prompt/content injection, fabricated field, sensitive inference, output manipulation |

## Threat scenarios and mitigations

| Scenario | Assets | Mitigation principles | Residual risk |
|---|---|---|---|
| Credential stuffing/phishing/session theft | identity/session | MFA, throttle, secure recovery, step-up, revocation, anomaly detection | human/social engineering remains |
| Privilege escalation/role stacking | authority/policy | default deny, scoped RBAC, SoD, independent grant, recertification/audit | misconfigured policy/owner error |
| IDOR/enumeration/hidden UI bypass | all entities | API-002 per-object/field, generic deny, opaque ID, audit | inference through timing/count if poorly implemented |
| Restricted contact/client export | personal/business data | purpose scope, masking, export approval, volume detection, expiry | authorized insider misuse |
| Approval/publication bypass | public representation | separate Verification/Permission/Approval, exact version, API/workflow guard, reconciliation | social collusion/incorrect evidence |
| Source/AI content injection | candidate/AI/operator | quarantine, schema/semantic validation, provenance, human review, safe rendering | persuasive/adversarial content |
| AI/provider data leakage | raw/personal/derived | classification, minimization, provider approval, retention/training constraints, no secrets | third-party control failure |
| Connector/service compromise | boundary/core | unique identity, narrow API, isolation, rate/volume/checkpoint, revoke/fail closed | authorized channel misuse |
| Audit/log tampering | accountability | append-oriented evidence, restricted access, integrity verification, backup, alert | privileged collusion/implementation flaw |
| Key/secret compromise | encrypted data/services | separation, rotation/revoke, no repository/log, incident process | past data exposure/availability loss |
| Backup theft/unsafe recovery | full corpus | encryption, isolated access, integrity test, dual authorization, recovery audit | latent compromise restored |
| Availability/ransomware/accidental loss | service/data | defense in depth, immutable/isolated backup, tested recovery, least privilege | extended outage, data freshness loss |

## Trust boundaries

Browser/device ↔ UI/API, core ↔ data store/object store, core ↔ AI provider, connector ↔ intake/publication boundary, administration/security plane ↔ business plane, primary ↔ backup/recovery와 future partner/SSO boundary를 각각 authenticate, authorize, classify, validate, encrypt와 audit한다.

## Residual risk governance

Residual risk는 owner, affected asset/control, likelihood/impact rationale, compensating control, review/expiry와 acceptance authority를 가진다. Constitutional no-publication/no-AI-approval/no-audit-bypass control의 residual risk를 단순 accept하여 우회할 수 없다. Quantitative assessment와 threat validation은 Book 10/implementation security testing으로 이관한다.

