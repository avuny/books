# PROGRESS: Assembly Order

| | |
|---|---|
| Spec | [`SPEC.md`](./SPEC.md) v1.0 · 2026-11-27 |
| Last updated | 2026-11-27 |
| Current phase | Phase 0 |
| Tasks done | 0 / 16 |
| Gates passed | 0 / 6 |

## How to use this file
Resume protocol: 1) read AGENTS.md files and SPEC sections 0 to 3 and the current phase. 2) read this file. 3) continue at Next action.
Tick a task only when its "done when" is true and evidence is in the Verification log. Update counts, status board and Next action with every change. Log decisions and deviations; never silently edit SPEC.
Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked · `[-]` not applicable (say why)

## Blocked by
Inventory costing (weighted average and cost integrity): [`../inventory-costing/PROGRESS.md`](../inventory-costing/PROGRESS.md). Assembly implementation starts after its gate 6. Documentation and decisions can continue.

## Next action
> **P0-01**: owner answers the remaining questions in [`../assembly/README.md`](../assembly/README.md) section 5 (Q5, Q6, Q7, Q8, Q10 to Q14). Q1, Q2, Q3, Q4, Q9 are decided.

## Status board
| Phase (README section 8) | Title | Tasks | Gate | Status |
|---|---|---|---|---|
| 0 | Decisions and repository checks | 2 | gate 0 | [ ] |
| 1 | Accounting and costing groundwork | 3 | gate 1 | [ ] |
| 4 | Drafts | 3 | gate 4 | [ ] |
| 5 | Post | 3 | gate 5 | [ ] |
| 6 | Reverse | 1 | gate 6 | [ ] |
| 7 | Web UI | 2 | gate 7 | [ ] |
| 8 | Reports and hardening | 2 | gate 8 | [ ] |

Phases 2 and 3 belong to the cost type and bill of materials modules. Phase 4 starts after both.

## Tasks
| ID | Task | Done when | Status |
|---|---|---|---|
| P0-01 | Close open decisions with the owner | Decision log filled | [ ] |
| P0-02 | Run SPEC section 13.2 checks and record results | Each check has a result in the verification log | [ ] |
| P1-01 | Mapping key `ASSEMBLY_COST_ABSORBED`, account 5600 as contra expense, template `assembly_cost`, source type, per account journal builder | Unit test for the template and the netting; chart test | [ ] |
| P1-02 | Backfill for existing organizations (code collision rule) | Test with a taken code 5600 | [ ] |
| P1-03 | Use the central costing engine API (consume lines return cost, produce with inherited cost). No own costing code. | Unit and integration tests after inventory-costing gate 6 | [ ] |
| P4-01 | Contracts, registry entry, locales, schema, migration | Section 5 and 6 reviewed against code | [ ] |
| P4-02 | Repository, number generation, create, update, delete, cancel | AC1, AC3 | [ ] |
| P4-03 | BOM scaling and preview | AC2 | [ ] |
| P5-01 | Component batch pick and availability check | AC5, AC10 | [ ] |
| P5-02 | Post: movements, layers, output batch, order update | AC4, AC6, AC7, AC9 | [ ] |
| P5-03 | Journal for additional cost | AC8 | [ ] |
| P6-01 | Reverse | AC11, AC12 | [ ] |
| P7-01 | List, form, detail, actions | AC16 | [ ] |
| P7-02 | Item details panels, trace view, stock movement labels check | AC17 | [ ] |
| P8-01 | Reconciliation tests and job, reports | AC15 | [ ] |
| P8-02 | REGISTRY, FEATURE-TRACKING, TESTING-PLAN updates, post-deploy sidebar seed and smoke | Docs updated | [ ] |

## Decision log
Same ids as README section 5. Defaults apply until the owner answers.
| ID | Decision (default applied) | Status | Owner response · date |
|---|---|---|---|
| Q1 | Both in phases: single-step v1 with extension hooks (SPEC R35), staged WIP later | open | no response yet |
| Q2 | DECIDED: block when cost cannot be determined, cost integrity enforced centrally for all stock-in | decided | owner, 2026-11-27 (WhatsApp) |
| Q3 | DECIDED: implement weighted average first, no FIFO fallback, assembly reuses the central engine | decided | owner, 2026-11-27 (WhatsApp) |
| Q4 | DECIDED: Manufacturing Cost Absorbed 5600, contra expense, variance tracking and period end treatment | decided | owner, 2026-11-27 (WhatsApp) |
| Q5 | One warehouse per order | open | no response yet |
| Q6 | Output expiry from shelf life, capped by components | open | no response yet |
| Q7 | No service items as components | open | no response yet |
| Q9 | DECIDED: reverse only when the whole output is untouched, disassembly is a separate future document | decided | owner, 2026-11-27 (WhatsApp) |
| Q10 | Assembly date today or earlier, open period | open | no response yet |
| Q14 | Role defaults: inventory roles can post | open | no response yet |
Q8, Q11, Q12, Q13: see README section 5.

## Deviations
None yet.

## Verification log
| Date | Task | Command | Result |
|---|---|---|---|
