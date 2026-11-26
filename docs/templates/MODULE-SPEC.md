# <Module name> — Implementation Specification

| | |
|---|---|
| Version | 1.0 · YYYY-MM-DD |
| Status | proposed / approved / implemented |
| Owner | name |
| Depends on | modules, services |

## 0. Reading order for agents
AGENTS.md, then this file sections 1 to 3, then the section for the current phase.

## 1. Goals and non-goals
## 2. Domain model and boundaries
Entities, relationships, what this module owns and must not touch.
## 3. Lifecycle and status model
States, transitions, who may trigger each, what each does to stock and accounting.
## 4. Business rules
Numbered rules (R1, R2, ...). Tests reference these ids.
## 5. Database design
Tables, columns, constraints, indexes, money as bigint minor units, org id on every row.
## 6. Contracts and API
Endpoints, request and response schemas, error codes (UPPER_SNAKE), permission per endpoint, idempotency.
## 7. UI
Screens, forms, copy keys, empty and error states, RTL notes.
## 8. Permissions
Resource and actions added to the registry, default grants for built-in roles.
## 9. Accounting and inventory effects
## 10. Reporting and reconciliation
## 11. Acceptance criteria
Numbered (AC1, ...). Each maps to a test in TEST-PLAN.md.
## 12. Implementation tasks
Phases with task ids, "done when", and gates. See PROGRESS.md.
## 13. Repository checks before implementation
## 14. Decisions to preserve
