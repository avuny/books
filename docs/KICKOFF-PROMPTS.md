# Kickoff prompts for AI coding agents

One prompt per module. Paste each into a **fresh** agent session (Claude, Antigravity, or similar).

## Rules

1. **One module per session.** Never start a second module in the same chat.
2. **One PR per module**, from a feature branch into `dev`. You review and merge. Nothing goes to `main` from an agent.
3. **Order matters.** Purchasing: 1, 2, 3. Sales: 4, 5, 6. The two chains are independent, so you can run them in parallel once the shared pieces from module 1 are merged. Inside a chain, never skip ahead.
4. **Merge before you start the next one.** The next prompt checks that the previous module is merged and stops if it is not.
5. **PROGRESS.md is the memory.** Each session ends by updating it. The next session starts from it, so no tokens are wasted rediscovering.
6. If a session runs out of quota midway, start a new session with the same prompt. It resumes from PROGRESS.md.

---
## Module 1: Purchase Order & Supplier Shipment

```
You are implementing ONE module in the avuny/books monorepo: Purchase Order & Supplier Shipment.

Read these first, and nothing else upfront:
1. AGENTS.md (and .agents/workflows/new-module.md)
2. docs/modules/purchase-order/SPEC.md
3. docs/modules/purchase-order/IMPLEMENTATION-PLAN.md
4. docs/modules/purchase-order/TEST-PLAN.md
5. docs/modules/purchase-order/PROGRESS.md (resume from its "Next action")
Read other code only when a plan task needs it.

Dependency check: this is the first module. Confirm `dev` is green (`pnpm typecheck` and the unit tests) before you begin.

Scope: implement ONLY this module, exactly as its IMPLEMENTATION-PLAN says. The SPEC wins over the plan; log any deviation in PROGRESS.md. Do not refactor unrelated code or start another module. Stage 0 foundations that this plan lists (real DB transactions, money rule) may not exist yet. Phase 0 of the plan covers them: do only what Phase 0 requires and log it.

Workflow:
- Create branch feat/purchase-order off dev.
- Follow the plan phase by phase. Contracts first, then db migration, server, `pnpm codegen` and `pnpm api:generate`, then web with en and ar copy.
- Write the tests from TEST-PLAN.md alongside the code, not after.
- Small commits, one per plan task, conventional commit messages (docs/GIT.md).
- Before opening the PR run: pnpm typecheck, pnpm lint, unit tests, pnpm test:int, pnpm test:e2e, and the i18n parity check. Fix failures.
- Open a PR into dev. Never merge to main and never merge the PR yourself.

End of session, always: update docs/modules/purchase-order/PROGRESS.md (tick tasks with evidence, update counts, write the next action), commit and push it.

Done means: every SPEC acceptance criterion has a passing named test, the definition of done in docs/TESTING-PLAN.md section 4 is met, CI is green, the PR is open, and PROGRESS.md is current. If you run out of budget first, stop at a clean commit and update PROGRESS.md.
```

## Module 2: Purchase Receipt (GRN)

```
You are implementing ONE module in the avuny/books monorepo: Purchase Receipt (GRN).

Read these first, and nothing else upfront:
1. AGENTS.md (and .agents/workflows/new-module.md)
2. docs/modules/purchase-receipt/SPEC.md
3. docs/modules/purchase-receipt/IMPLEMENTATION-PLAN.md
4. docs/modules/purchase-receipt/TEST-PLAN.md
5. docs/modules/purchase-receipt/PROGRESS.md (resume from its "Next action")
Read other code only when a plan task needs it.

Dependency check: this module depends on `purchase-order`. Before anything else, confirm on `dev` that `docs/modules/purchase-order/PROGRESS.md` shows its gates passed and its code exists. If not, STOP and tell me.

Scope: implement ONLY this module, exactly as its IMPLEMENTATION-PLAN says. The SPEC wins over the plan; log any deviation in PROGRESS.md. Do not refactor unrelated code or start another module. 

Workflow:
- Create branch feat/purchase-receipt off dev.
- Follow the plan phase by phase. Contracts first, then db migration, server, `pnpm codegen` and `pnpm api:generate`, then web with en and ar copy.
- Write the tests from TEST-PLAN.md alongside the code, not after.
- Small commits, one per plan task, conventional commit messages (docs/GIT.md).
- Before opening the PR run: pnpm typecheck, pnpm lint, unit tests, pnpm test:int, pnpm test:e2e, and the i18n parity check. Fix failures.
- Open a PR into dev. Never merge to main and never merge the PR yourself.

End of session, always: update docs/modules/purchase-receipt/PROGRESS.md (tick tasks with evidence, update counts, write the next action), commit and push it.

Done means: every SPEC acceptance criterion has a passing named test, the definition of done in docs/TESTING-PLAN.md section 4 is met, CI is green, the PR is open, and PROGRESS.md is current. If you run out of budget first, stop at a clean commit and update PROGRESS.md.
```

## Module 3: Vendor Bill & Vendor Payment

```
You are implementing ONE module in the avuny/books monorepo: Vendor Bill & Vendor Payment.

Read these first, and nothing else upfront:
1. AGENTS.md (and .agents/workflows/new-module.md)
2. docs/modules/vendor-bill-payment/SPEC.md
3. docs/modules/vendor-bill-payment/IMPLEMENTATION-PLAN.md
4. docs/modules/vendor-bill-payment/TEST-PLAN.md
5. docs/modules/vendor-bill-payment/PROGRESS.md (resume from its "Next action")
Read other code only when a plan task needs it.

Dependency check: this module depends on `purchase-receipt`. Before anything else, confirm on `dev` that `docs/modules/purchase-receipt/PROGRESS.md` shows its gates passed and its code exists. If not, STOP and tell me.

Scope: implement ONLY this module, exactly as its IMPLEMENTATION-PLAN says. The SPEC wins over the plan; log any deviation in PROGRESS.md. Do not refactor unrelated code or start another module. This module covers both the bill and the payment; do both in this session, bill first.

Workflow:
- Create branch feat/vendor-bill-payment off dev.
- Follow the plan phase by phase. Contracts first, then db migration, server, `pnpm codegen` and `pnpm api:generate`, then web with en and ar copy.
- Write the tests from TEST-PLAN.md alongside the code, not after.
- Small commits, one per plan task, conventional commit messages (docs/GIT.md).
- Before opening the PR run: pnpm typecheck, pnpm lint, unit tests, pnpm test:int, pnpm test:e2e, and the i18n parity check. Fix failures.
- Open a PR into dev. Never merge to main and never merge the PR yourself.

End of session, always: update docs/modules/vendor-bill-payment/PROGRESS.md (tick tasks with evidence, update counts, write the next action), commit and push it.

Done means: every SPEC acceptance criterion has a passing named test, the definition of done in docs/TESTING-PLAN.md section 4 is met, CI is green, the PR is open, and PROGRESS.md is current. If you run out of budget first, stop at a clean commit and update PROGRESS.md.
```

## Module 4: Sales Order & Reservation

```
You are implementing ONE module in the avuny/books monorepo: Sales Order & Reservation.

Read these first, and nothing else upfront:
1. AGENTS.md (and .agents/workflows/new-module.md)
2. docs/modules/sales-order/SPEC.md
3. docs/modules/sales-order/IMPLEMENTATION-PLAN.md
4. docs/modules/sales-order/TEST-PLAN.md
5. docs/modules/sales-order/PROGRESS.md (resume from its "Next action")
Read other code only when a plan task needs it.

Dependency check: this module depends on party (customer role) and the shared pieces from the purchase-order module (payment terms, LineItems). Confirm they exist on `dev`. If not, STOP and tell me.

Scope: implement ONLY this module, exactly as its IMPLEMENTATION-PLAN says. The SPEC wins over the plan; log any deviation in PROGRESS.md. Do not refactor unrelated code or start another module. The sales chain does not depend on the purchasing chain beyond the shared pieces. If a shared piece is missing, stop and report.

Workflow:
- Create branch feat/sales-order off dev.
- Follow the plan phase by phase. Contracts first, then db migration, server, `pnpm codegen` and `pnpm api:generate`, then web with en and ar copy.
- Write the tests from TEST-PLAN.md alongside the code, not after.
- Small commits, one per plan task, conventional commit messages (docs/GIT.md).
- Before opening the PR run: pnpm typecheck, pnpm lint, unit tests, pnpm test:int, pnpm test:e2e, and the i18n parity check. Fix failures.
- Open a PR into dev. Never merge to main and never merge the PR yourself.

End of session, always: update docs/modules/sales-order/PROGRESS.md (tick tasks with evidence, update counts, write the next action), commit and push it.

Done means: every SPEC acceptance criterion has a passing named test, the definition of done in docs/TESTING-PLAN.md section 4 is met, CI is green, the PR is open, and PROGRESS.md is current. If you run out of budget first, stop at a clean commit and update PROGRESS.md.
```

## Module 5: Sales Delivery

```
You are implementing ONE module in the avuny/books monorepo: Sales Delivery.

Read these first, and nothing else upfront:
1. AGENTS.md (and .agents/workflows/new-module.md)
2. docs/modules/sales-delivery/SPEC.md
3. docs/modules/sales-delivery/IMPLEMENTATION-PLAN.md
4. docs/modules/sales-delivery/TEST-PLAN.md
5. docs/modules/sales-delivery/PROGRESS.md (resume from its "Next action")
Read other code only when a plan task needs it.

Dependency check: this module depends on `sales-order`. Before anything else, confirm on `dev` that `docs/modules/sales-order/PROGRESS.md` shows its gates passed and its code exists. If not, STOP and tell me.

Scope: implement ONLY this module, exactly as its IMPLEMENTATION-PLAN says. The SPEC wins over the plan; log any deviation in PROGRESS.md. Do not refactor unrelated code or start another module. 

Workflow:
- Create branch feat/sales-delivery off dev.
- Follow the plan phase by phase. Contracts first, then db migration, server, `pnpm codegen` and `pnpm api:generate`, then web with en and ar copy.
- Write the tests from TEST-PLAN.md alongside the code, not after.
- Small commits, one per plan task, conventional commit messages (docs/GIT.md).
- Before opening the PR run: pnpm typecheck, pnpm lint, unit tests, pnpm test:int, pnpm test:e2e, and the i18n parity check. Fix failures.
- Open a PR into dev. Never merge to main and never merge the PR yourself.

End of session, always: update docs/modules/sales-delivery/PROGRESS.md (tick tasks with evidence, update counts, write the next action), commit and push it.

Done means: every SPEC acceptance criterion has a passing named test, the definition of done in docs/TESTING-PLAN.md section 4 is met, CI is green, the PR is open, and PROGRESS.md is current. If you run out of budget first, stop at a clean commit and update PROGRESS.md.
```

## Module 6: Sales Invoice & Customer Payment

```
You are implementing ONE module in the avuny/books monorepo: Sales Invoice & Customer Payment.

Read these first, and nothing else upfront:
1. AGENTS.md (and .agents/workflows/new-module.md)
2. docs/modules/sales-invoice-payment/SPEC.md
3. docs/modules/sales-invoice-payment/IMPLEMENTATION-PLAN.md
4. docs/modules/sales-invoice-payment/TEST-PLAN.md
5. docs/modules/sales-invoice-payment/PROGRESS.md (resume from its "Next action")
Read other code only when a plan task needs it.

Dependency check: this module depends on `sales-delivery`. Before anything else, confirm on `dev` that `docs/modules/sales-delivery/PROGRESS.md` shows its gates passed and its code exists. If not, STOP and tell me.

Scope: implement ONLY this module, exactly as its IMPLEMENTATION-PLAN says. The SPEC wins over the plan; log any deviation in PROGRESS.md. Do not refactor unrelated code or start another module. This module covers both the invoice and the customer payment; do both in this session, invoice first.

Workflow:
- Create branch feat/sales-invoice-payment off dev.
- Follow the plan phase by phase. Contracts first, then db migration, server, `pnpm codegen` and `pnpm api:generate`, then web with en and ar copy.
- Write the tests from TEST-PLAN.md alongside the code, not after.
- Small commits, one per plan task, conventional commit messages (docs/GIT.md).
- Before opening the PR run: pnpm typecheck, pnpm lint, unit tests, pnpm test:int, pnpm test:e2e, and the i18n parity check. Fix failures.
- Open a PR into dev. Never merge to main and never merge the PR yourself.

End of session, always: update docs/modules/sales-invoice-payment/PROGRESS.md (tick tasks with evidence, update counts, write the next action), commit and push it.

Done means: every SPEC acceptance criterion has a passing named test, the definition of done in docs/TESTING-PLAN.md section 4 is met, CI is green, the PR is open, and PROGRESS.md is current. If you run out of budget first, stop at a clean commit and update PROGRESS.md.
```

