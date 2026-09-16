# REL-002 Phase 1 Production Configuration Model

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-278 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner |
| 기준일 | 2026-09-17 |
| Decision | DEC-164 |

## 1. Canonical model

`ProductionRuntimeConfiguration` is one immutable, closed, typed composition input. It owns structural validation and delegates authority checks to existing identity/authorization components. It is not a business authority, secret store, environment-variable reader, infrastructure provisioner or subsystem replacement.

## 2. Environment vocabulary

Use exactly `DEVELOPMENT | TEST | STAGING | PRODUCTION`.

- Production requires explicit `PRODUCTION`; missing or unknown environment fails startup.
- Production cannot inherit or fall back to Development, Test or Staging values.
- Development session fixtures, test adapters, in-memory authority and Staging credential references are rejected.
- Environment variables may be an external delivery mechanism but are not the source of truth and are not read inside domain modules.

## 3. Configuration layers

| Layer | Content | Authority |
|---|---|---|
| Build manifest | source/artifact/release identity | Release evidence only |
| Production runtime envelope | environment, configuration version, component enablement, safe endpoints and reference IDs | composition input |
| Component config | existing closed subsystem options | owning component |
| Secret reference map | opaque references keyed by approved consumer | Security/Integration ownership |
| Resolved secret value | transient resolver output | exact adapter/driver only |

The composition root constructs the envelope, validates it once, then passes narrowed immutable views to owning components. Components must not read `process.env` or a global mutable config object.

## 4. Canonical configuration matrix

| Config ID | Name | Owner | Classification | Applicability | Required | Validation | Failure behavior | Runtime consumer | Evidence/logging |
|---|---|---|---|---|---|---|---|---|---|
| CFG-PRD-001 | `runtimeEnvironment` | Operations | `NON_SECRET_CONFIG` | all | yes | exact `PRODUCTION` | abort startup | composition root | value allowed |
| CFG-PRD-002 | `configurationVersion` | Operations | `NON_SECRET_CONFIG` | Production | yes | immutable safe identifier | abort startup | startup validator | version only |
| CFG-PRD-003 | `releaseCandidateId` | Release Owner | `NON_SECRET_CONFIG` | Production | yes | exact approved candidate reference | abort startup | release/startup gate | reference only |
| CFG-PRD-004 | `serviceInstanceId` | Operations | `NON_SECRET_CONFIG` | Production | yes | unique safe identifier | abort startup | telemetry/audit correlation | identifier only |
| CFG-PRD-005 | `tenantBindingOrigin` | Security | `NON_SECRET_CONFIG` | identity runtime | yes | approved immutable reference | abort startup | Session composition | reference only |
| CFG-PRD-006 | `authenticationAuthorityRef` | Security | `NON_SECRET_CONFIG` | identity runtime | yes | approved adapter identity | abort startup | authentication adapter | reference/status only |
| CFG-PRD-007 | `authorizationAuthorityRef` | Security | `NON_SECRET_CONFIG` | all protected runtime | yes | live authority identity | abort startup | AuthorizationService composition | reference/status only |
| CFG-PRD-008 | `databaseCredentialRefs` | Data/Security | `SECRET_REFERENCE` | activated durable components | yes per component | closed component keys; reference syntax; resolvable | abort startup | DB adapters only | reference fingerprint/status |
| CFG-PRD-009 | `adminConsoleOrigin` | Operations | `NON_SECRET_CONFIG` | Admin Console | yes if enabled | exact HTTPS/or approved internal origin | affected component unavailable | Console client | normalized origin |
| CFG-PRD-010 | `adminConsoleListener` | Operations | `NON_SECRET_CONFIG` | Admin Console | yes if enabled | approved host/port; no dev default | affected component unavailable | Phase 3 host | safe host/port |
| CFG-PRD-011 | `serviceIdentityRefs` | Security | `NON_SECRET_CONFIG` | workers/services | yes per enabled service | registered identity and exact purpose/scope | abort affected service | identity composition | identity reference only |
| CFG-PRD-012 | `externalCredentialRefs` | Integration/Security | `SECRET_REFERENCE` | approved external adapters | conditional | exact consumer binding; resolvable; environment bound | adapter `NOT_READY` | adapter only | reference fingerprint/status |
| CFG-PRD-013 | `monitoringCredentialRef` | Operations/Security | `SECRET_REFERENCE` | future external monitoring | optional until Phase 4 approval | unresolved when destination absent | monitoring remains unavailable | monitoring adapter only | status only |
| CFG-PRD-014 | `backupKeyReference` | Data/Security | `SECRET_REFERENCE` | future backup execution | optional until Phase 5 approval | exact protected-set binding | backup remains unavailable | backup adapter only | status only |

`CFG-PRD-012` does not make FEAT-022 mandatory or ready. The OpenAI reference remains unavailable under DEC-162/163.

## 5. Ownership and validation

The bounded configuration module validates syntax, closed keys, environment binding and required presence. The existing authorization system validates actors and scopes. Owning adapters validate reference compatibility. Infrastructure-specific resolution and actual values remain deferred.

## 6. Failure containment

No listener, worker, database mutation or provider execution may begin before mandatory startup validation returns one immutable success result. Errors expose stable safe codes only; raw values, paths, SQL, environment dumps and secret references are not returned.
