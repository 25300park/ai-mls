# REL-001 Phase 4D.1 Provider Destination / Retention Decision

| 항목 | 값 |
|---|---|
| Document ID | DOC-DEV-206 |
| 문서 버전 | v0.1 |
| 상태 | DRAFT |
| 소유 역할 | Architecture Owner / Security Owner / Privacy Owner / AI Operations Owner |
| 기준일 | 2026-09-15 |

## Destination inventory

| Field | Required | Current value |
|---|---|---|
| provider | exact approved vendor/service | `CONFIG_VALUE_REQUIRED` |
| HTTPS domain | exact, no wildcard | `CONFIG_VALUE_REQUIRED` |
| endpoint class/path | inference only | `CONFIG_VALUE_REQUIRED` |
| region/data residency | exact approved region | `CONFIG_VALUE_REQUIRED` |
| TLS | HTTPS/TLS required | requirement CLOSED; destination unselected |
| HTTP method/request type | exact provider contract | `CONFIG_VALUE_REQUIRED` |

Approved external destinations are currently `0`; no wildcard destination may be authorized.

## Retention and handling inventory

| Concern | Required evidence | Current value |
|---|---|---|
| retention duration | exact provider/API term | `EVIDENCE_REQUIRED` |
| training/model improvement use | explicit permitted/prohibited term | `EVIDENCE_REQUIRED` |
| request/response logging/storage | exact behavior and controls | `EVIDENCE_REQUIRED` |
| deletion/control | supported mechanism and owner | `EVIDENCE_REQUIRED` |
| enterprise/API handling | applicable contractual terms | `EVIDENCE_REQUIRED` |
| cross-border/residency | region and approval | `EVIDENCE_REQUIRED` |

Repository evidence does not identify a provider, so no provider policy is claimed. Destination and retention remain open and network activation remains blocked.
