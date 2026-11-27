# PROGRESS: Assembly Cost Type

| | |
|---|---|
| Spec | [`SPEC.md`](./SPEC.md) v1.0 · 2026-11-27 |
| Last updated | 2026-11-27 |
| Current phase | Phase 0 |
| Tasks done | 0 / 4 |
| Gates passed | 0 / 1 |

## How to use this file
Resume protocol: 1) read AGENTS.md files and the SPEC. 2) read this file. 3) continue at Next action. Tick a task only when its "done when" is true and evidence is in the Verification log. Never silently edit SPEC.
Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` not applicable

## Blocked by
Inventory costing (weighted average and cost integrity): [`../inventory-costing/PROGRESS.md`](../inventory-costing/PROGRESS.md). Assembly implementation starts after its gate 6. Documentation and decisions can continue.

## Next action
> **P0-01**: owner answers Q4 and Q12 in [`../assembly/README.md`](../assembly/README.md) section 5.

## Tasks
| ID | Task | Done when | Status |
|---|---|---|---|
| P0-01 | Close Q4 and Q12, run SPEC section 13 checks | Decision log and verification log filled | [ ] |
| P2-01 | Contracts, registry, locales, schema, migration, default rows and backfill | AC3 | [ ] |
| P2-02 | Repository, service, routes, audit | AC1, AC2 | [ ] |
| P2-03 | Web list, dialog, inline shortcut | AC4 | [ ] |

## Decision log
| ID | Decision (default applied) | Status | Owner response · date |
|---|---|---|---|
| Q4 | One absorbed account for all kinds | open | no response yet |
| Q12 | Seed Labor and Overhead | open | no response yet |

## Deviations
None yet.

## Verification log
| Date | Task | Command | Result |
|---|---|---|---|
