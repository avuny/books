# PROGRESS: Bill of Materials

| | |
|---|---|
| Spec | [`SPEC.md`](./SPEC.md) v1.0 · 2026-11-27 |
| Last updated | 2026-11-27 |
| Current phase | Phase 0 |
| Tasks done | 0 / 9 |
| Gates passed | 0 / 3 |

## How to use this file
Resume protocol: 1) read AGENTS.md files and SPEC sections 0 to 3 and the current phase. 2) read this file. 3) continue at Next action.
Tick a task only when its "done when" is true and evidence is in the Verification log. Log decisions and deviations; never silently edit SPEC.
Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` not applicable

## Blocked by
Inventory costing (weighted average and cost integrity): [`../inventory-costing/PROGRESS.md`](../inventory-costing/PROGRESS.md). Assembly implementation starts after its gate 6. Documentation and decisions can continue.

## Next action
> **P0-01**: owner answers Q7, Q11, Q12, Q13, Q14 in [`../assembly/README.md`](../assembly/README.md) section 5.

## Status board
| Phase | Title | Tasks | Gate | Status |
|---|---|---|---|---|
| 0 | Decisions and checks | 2 | gate 0 | [ ] |
| 3 | Backend and web | 6 | gate 3 | [ ] |
| 8 | Docs | 1 | gate 8 | [ ] |

## Tasks
| ID | Task | Done when | Status |
|---|---|---|---|
| P0-01 | Close open decisions | Decision log filled | [ ] |
| P0-02 | Run SPEC section 13.2 checks | Results in verification log | [ ] |
| P3-01 | Contracts, registry, locales, schema, migration | SPEC sections 5 to 8 match code | [ ] |
| P3-02 | Repository and service (CRUD, default, cycle check) | AC1 to AC4, AC7 | [ ] |
| P3-03 | Estimate and availability endpoints | AC5, AC6 | [ ] |
| P3-04 | Item panels endpoints | Where used correct | [ ] |
| P3-05 | Web list, form, detail | AC10 | [ ] |
| P3-06 | Permission and tenant tests | AC9 | [ ] |
| P8-01 | REGISTRY, FEATURE-TRACKING updates | Docs updated | [ ] |

## Decision log
| ID | Decision (default applied) | Status | Owner response · date |
|---|---|---|---|
| Q7 | No service items as BOM lines | open | no response yet |
| Q11 | No versions, several BOMs per item, one default | open | no response yet |
| Q12 | Seed default cost types | open | no response yet |
| Q13 | Posting does not change item `costPrice` | open | no response yet |
| Q14 | Role defaults | open | no response yet |

## Deviations
None yet.

## Verification log
| Date | Task | Command | Result |
|---|---|---|---|
