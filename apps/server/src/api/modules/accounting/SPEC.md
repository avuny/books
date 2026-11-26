# Accounting Module — Specification

> **Update this file** whenever a requirement changes: a new error code, a new route, a posting template, a policy change, or anything else that alters observable behavior.

---

## 1. Purpose

Double-entry bookkeeping for an organization: a chart of accounts, default account mappings, journal entries (manual and automated), opening balances, accounting periods and the financial reports (general ledger, trial balance, profit and loss, balance sheet).

Principles:

- **Everything that moves money is a balanced journal entry.** Debits equal credits, always, in integer minor units.
- **Reports read posted journals only** (`POSTED` and `REVERSED` entries, never `DRAFT`). There is no stored balance to drift out of sync.
- **Nothing posted is edited or deleted.** A mistake is corrected by a reversal, so the trail stays complete.
- **Business modules never name an account.** They name a posting role (a mapping key such as `INVENTORY_ASSET`); the organization decides which account plays it.
- **Accounting does not value stock.** The stock ledger computes the value of stock movements; accounting books the figure it is given and never recomputes it.

---

## 2. Domain Model

Tables (`packages/db/src/schema/accounting/`), every row carries `org_id` and every query filters by it.

| Table | What it is |
|---|---|
| `accounts` | The chart. `code` (unique per org, case-insensitive), `name`, `type` (ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE), `normal_balance` (DEBIT/CREDIT), `parent_id`, `system_key` (set on default accounts, unique per org), `allow_posting`, `is_active` |
| `account_mappings` | Posting role (`mapping_key`) to account, unique per (org, key) |
| `journal_entries` | Header: `entry_seq` + `entry_number` (`JE-000001`, per org), `date` (business date), `status` (DRAFT, POSTED, REVERSED), `currency`, `source_type`/`source_id`/`source_ref`, `reversal_of_id`, posted/created audit columns |
| `journal_entry_lines` | `account_id`, `debit`, `credit` (integer minor units; exactly one is non-zero), optional description |
| `accounting_periods` | `start_date`, `end_date`, `status` (OPEN, CLOSED), closed by/at; ranges never overlap per org |

Important constraints (database and service both enforce them):

- A source document is posted once: `ux_journal_entry_org_source` on (org, source_type, source_id) where the entry is not a reversal; a reversal is linked by `reversal_of_id` and an entry is reversed at most once (`ux_journal_entry_org_reversal`).
- Money columns are `money()` integers (never floats, never `numeric`); amounts on the wire are strings of minor units (`"500000"` = 5,000.00 in a two-decimal currency). Totals are summed as `BigInt`.
- Contracts own every shape: `packages/contracts/src/accounting/` (constants, default chart, errors, rules, schemas, reports, posting templates, locales `en`/`ar`).

---

## 3. Chart of Accounts

### 3.1 Default chart (single source: `DEFAULT_ACCOUNTS` in contracts)

47 accounts (10 group accounts that group, 37 that take postings): Assets (13), Liabilities (8), Equity (5), Revenue (5), Expenses (16), arranged as a tree under `1000` Assets, `2000` Liabilities, `3000` Equity, `4000` Revenue, `5000` Expenses. Each default account has a stable `systemKey`. `validateDefaultChart` checks the definitions structurally (unique codes and keys, parents exist and are groups of the same type, mappings point at allowed types).

### 3.2 Default mappings (`DEFAULT_ACCOUNT_MAPPINGS`)

37 posting roles (`ACCOUNT_MAPPING_KEYS`): cash, bank, receivable, payable, inventory, inventory in transit, input/output tax, sales revenue, other revenue, sales returns, sales discounts, cost of goods sold, inventory write-off, shrinkage, opening balance equity, goods received not invoiced, customer/supplier advances, owner's capital and drawings, retained earnings, fixed assets, accumulated depreciation, depreciation expense, salaries, rent, utilities, delivery, marketing, maintenance, bank fees, general expenses, plus prepaid expenses, long-term loans, inventory valuation adjustment, purchase price variance (added for the default chart and the supported postings). `ACCOUNT_MAPPING_ALLOWED_TYPES` says which account types may play each role. `REQUIRED_ACCOUNT_MAPPING_KEYS` (inventory, opening balance equity, COGS, receivable, payable, sales revenue, cash, bank) must resolve or initialization fails with `ACCOUNT_MAPPING_MISSING`.

### 3.3 Initialization (`initializeChartOfAccounts(orgId, tx)`)

- Runs in the **caller's transaction** (organization creation); the service opens none of its own and has no actor.
- **Idempotent**: whatever exists by system key is kept exactly as it is, so a re-run never overwrites a renamed account or a changed mapping; only what is missing is created. Returns `{ accountsCreated, mappingsCreated }`.
- Every conflict (a user account already using a default code, an unusable mapping target) is detected **before the first write** and returned as a typed failure; the organization service turns it into `ORGANIZATION_INITIALIZATION_FAILED` and rolls the whole creation back.
- Serialized with an advisory lock per organization (`lockOrg`), inserts use `ON CONFLICT DO NOTHING`.
- `syncAccountingDefaults(db)` (called from `seed.ts`) back-fills the default chart for organizations that existed before this module: one transaction per organization, so one problem organization is rolled back and listed in `failed` without blocking the others. It returns `{ organizations, accountsCreated, mappingsCreated, failed }`.

### 3.4 Account rules (`accounting.rules.ts`, pure)

- `type` and `normalBalance` are fixed at creation; a contra account may use the opposite side. `normalBalance` defaults to the natural side of the type.
- A parent must exist in the organization, be a different account, have the same type, not allow posting and not sit below the account (no cycles) (`ACCOUNT_PARENT_INVALID`).
- An account with children cannot allow posting (`ACCOUNT_CANNOT_POST`); an account with journal lines must keep allowing posting (`ACCOUNT_IN_USE`).
- A system account can be renamed, recoded and described, but keeps its parent and its posting flag (`ACCOUNT_SYSTEM_READONLY`) and cannot be deleted.
- An account that is mapped cannot be deactivated or deleted (`ACCOUNT_IN_USE`); neither can one with children or journal lines.
- Codes are unique per organization, case-insensitively (`ACCOUNT_CODE_TAKEN`).
- A mapping target must exist in the organization, have an allowed type and be postable (active, allows posting) (`ACCOUNT_MAPPING_INVALID`). The same check runs again on every automated posting, so an account that was deactivated after it was mapped cannot silently break a posting.

---

## 4. Journal Entries

### 4.1 Lifecycle

`DRAFT` --post--> `POSTED` --reverse--> `REVERSED` (the reversing entry is a new `POSTED` entry with `reversal_of_id`).

- **Create** (manual journal): a date, an optional description and 2 to 500 lines, each with exactly one of debit or credit greater than zero, on postable accounts, in integer minor units. The entry takes the organization's currency (there is no currency field on a manual journal). It is saved as `DRAFT` and does not touch any report until it is posted by a separate call.
- **Update / delete**: only `DRAFT` entries (`JOURNAL_ENTRY_ALREADY_POSTED` otherwise). Fields left out stay as they are; `lines`, when present, replaces the whole set. Delete removes the draft and its lines (the only hard delete), audited.
- **Post**: the lines are validated again (accounts may have changed since the draft), the entry must balance (`JOURNAL_ENTRY_UNBALANCED`) and its date must fall in an open period (`JOURNAL_ENTRY_PERIOD_CLOSED`). The status flip is a compare-and-set on `DRAFT`.
- **Reverse**: only `POSTED` (`JOURNAL_ENTRY_NOT_POSTED` for a draft), never a reversal (`JOURNAL_ENTRY_CANNOT_REVERSE_REVERSAL`), only once (`JOURNAL_ENTRY_ALREADY_REVERSED`); writes a new entry with every debit and credit swapped (date and description from the request, defaulting to the original's date and "Reversal of JE-..."), then marks the original `REVERSED` with a compare-and-set. The lines are not re-validated against the accounts: a reversal only undoes history, so it works on accounts deactivated since. The reversal keeps the source of the original. If the compare-and-set loses a race the transaction is rolled back (`abort`), so no orphan reversal remains. The original is never edited otherwise.
- Numbers are sequential per organization (`JE-000001`); the sequence is allocated under the organization lock.

### 4.2 Validation (service + `accounting.rules.ts`)

Debits equal credits as BigInt; no line is both a debit and a credit or neither; every account exists in the organization, is active and allows posting; amounts are whole minor units, at most 15 digits (`ACCOUNTING_INVALID_AMOUNT`, `JOURNAL_ENTRY_INVALID_LINE`). Automated postings that carry a currency (opening inventory) must match the organization's (`ACCOUNTING_CURRENCY_MISMATCH`).

### 4.3 Dates and periods

Entry dates are business dates (`YYYY-MM-DD`) in the organization's timezone; a timestamp becomes its business date through `toBusinessDate(postedAt, timezone)`. Periods (`createPeriod`) have a name and a date range that must not overlap another (`ACCOUNTING_PERIOD_OVERLAP`, `ACCOUNTING_INVALID_DATE_RANGE`). `closePeriod` is OPEN to CLOSED only (`ACCOUNTING_PERIOD_ALREADY_CLOSED`); from then on nothing dated inside it can be posted, and a reversal dated inside it is refused. A date outside every period is open.

---

## 5. Automated Postings

All automated postings share one writer (`writeEntry`): closed-period check, source-uniqueness check, then the insert. They are **idempotent per (org, source type, source id)** and carry no manual-journal permission (the calling module authorized its own operation).

### 5.1 Opening balances (`postOpeningBalances`, route + permission)

A list of balances on assets (debit), liabilities and equity (credit); revenue and expense accounts carry nothing forward. The balancing line on **Opening Balance Equity** is added by the service, so callers never touch the equity account (listing it is `ACCOUNTING_OPENING_BALANCE_INVALID`). One `POSTED` entry, source `opening_balances`.

### 5.2 Opening inventory (`postInventoryOpeningBalance(actorId|null, orgId, input, tx)`)

Called by the item opening-stock workflow **inside the item-creating transaction**, after the stock ledger posted the movement:

`ItemService.create -> postOpeningStock -> BatchService.ensureBatches -> StockMovementService.post -> AccountingService.postInventoryOpeningBalance`

- Input: source (`item_opening`, item id), `postedAt`, `amountMinor` and `currency` **exactly as the stock ledger returned them** (`totalValueMinor`, `currency`).
- Journal: Dr `INVENTORY_ASSET`, Cr `OPENING_BALANCE_EQUITY`.
- Zero value writes **no journal** and returns `journalEntryId: null`. A missing or malformed amount is `ACCOUNTING_INVALID_AMOUNT`; a currency different from the organization's is `ACCOUNTING_CURRENCY_MISMATCH`; a missing mapping is `ACCOUNT_MAPPING_MISSING`.
- It joins the caller's transaction, writes no audit row (the item creation is the audited act) and returns typed failures so the item service can roll everything back.

### 5.3 Business events (`postBusinessEvent(actorId|null, orgId, event, tx?)`)

The posting templates are pure (`buildPostingTemplate` in contracts, exhaustive over `PostBusinessEventInput`) and name mapping keys only. A zero line is dropped; a template with no lines left is `ACCOUNTING_INVALID_AMOUNT` (no empty journal). Without `tx` the call opens its own transaction and audits; with `tx` the calling workflow owns both.

| Event (`source_type`) | Debit | Credit |
|---|---|---|
| `goods_receipt` | Inventory | Goods Received Not Invoiced |
| `supplier_invoice` (matches a receipt) | Goods Received Not Invoiced; Purchase Price Variance if invoiced > received; Input Tax | Accounts Payable (invoiced + tax); Purchase Price Variance if invoiced < received |
| `purchase_invoice` (no receipt) | Inventory; Input Tax | Accounts Payable |
| `supplier_return` | Accounts Payable | Inventory; Input Tax |
| `landed_cost` | Inventory (capitalized) or Delivery Expense | Accounts Payable |
| `sale_revenue` | Receivable / Cash / Bank (gross - discount + tax); Sales Discounts | Sales Revenue (gross); Output Tax |
| `sale_cost` | Cost of Goods Sold | Inventory |
| `sale_return_revenue` | Sales Returns; Output Tax | Receivable / Cash / Bank |
| `sale_return_inventory` | Inventory (restock) or Inventory Write-off | Cost of Goods Sold |
| `inventory_adjustment` shortage | Inventory Shrinkage | Inventory |
| `inventory_adjustment` damage | Inventory Write-off | Inventory |
| `inventory_adjustment` value decrease / increase | Valuation Adjustment / Inventory | Inventory / Valuation Adjustment |
| `customer_payment` | Cash or Bank | Accounts Receivable |
| `supplier_payment` | Accounts Payable | Cash or Bank |
| `customer_advance` | Cash or Bank | Customer Advances |
| `supplier_advance` | Supplier Advances | Cash or Bank |

A sale is two events with the same document id (`sale_revenue` and `sale_cost`), so each journal keeps its own idempotency key. A reversed source cannot be posted again under the same id (post a corrected document under a new id).

---

## 6. Reports (`read:accounting`, POSTED and REVERSED entries only)

All amounts are integer minor-unit strings; running and closing balances are signed on the account's normal side.

| Report | Parameters | Result |
|---|---|---|
| General ledger | `accountId`, `from?`, `to?`, `page`, `pageSize` | opening balance, paged lines with a running balance, totals and closing balance of the whole range |
| Trial balance | `asOf?`, `includeZero?` | every account's cumulative **net** balance up to the date; debit column = accounts with a net debit balance, credit column = net credit balances; totals are equal when the books balance |
| Profit and loss | `from`, `to` (required) | revenue (contra revenue negative) and net revenue, cost of goods sold, gross profit, operating expenses, net profit |
| Balance sheet | `asOf?` | current and non-current assets, current and long-term liabilities, equity with current-period earnings (revenue minus expenses to date, computed, no journal added), totals and an `isBalanced` check |

Reversed entries stay in the reports together with their reversal, so a reversal nets the original to zero.

---

## 7. Routes (`/organizations/{orgId}/...`, permission resource `accounting`)

| Method | Path | Permission | operationId |
|---|---|---|---|
| GET | `/accounts` | `read:accounting` | `listAccounts` |
| POST | `/accounts` | `create:accounting` | `createAccount` |
| GET | `/accounts/{accountId}` | `read:accounting` | `getAccount` |
| PATCH | `/accounts/{accountId}` | `update:accounting` | `updateAccount` |
| DELETE | `/accounts/{accountId}` | `delete:accounting` | `deleteAccount` |
| GET | `/account-mappings` | `read:accounting` | `listAccountMappings` |
| PUT | `/account-mappings/{key}` | `update:accounting` | `updateAccountMapping` |
| GET | `/journal-entries` | `read:accounting` | `listJournalEntries` |
| POST | `/journal-entries` | `create:accounting` | `createJournalEntry` |
| GET | `/journal-entries/{entryId}` | `read:accounting` | `getJournalEntry` |
| PATCH | `/journal-entries/{entryId}` | `update:accounting` | `updateJournalEntry` |
| DELETE | `/journal-entries/{entryId}` | `delete:accounting` | `deleteJournalEntry` |
| POST | `/journal-entries/{entryId}/post` | `create:accounting` | `postJournalEntry` |
| POST | `/journal-entries/{entryId}/reverse` (201) | `update:accounting` | `reverseJournalEntry` |
| POST | `/opening-balances` | `create:accounting` | `postOpeningBalances` |
| GET | `/periods` | `read:accounting` | `listAccountingPeriods` |
| POST | `/periods` | `create:accounting` | `createAccountingPeriod` |
| POST | `/periods/{periodId}/close` | `update:accounting` | `closeAccountingPeriod` |
| GET | `/reports/general-ledger` | `read:accounting` | `getGeneralLedger` |
| GET | `/reports/trial-balance` | `read:accounting` | `getTrialBalance` |
| GET | `/reports/profit-and-loss` | `read:accounting` | `getProfitAndLoss` |
| GET | `/reports/balance-sheet` | `read:accounting` | `getBalanceSheet` |

Permissions are the registry's `create|read|update|delete:accounting` (`packages/contracts/src/modules/registry.ts`); the sidebar maps the module to `accounting`; the system role **Accountant** has full access to accounting (`allow("accounting", "*")`) and read access to the organization, items, warehouses and stock movements. Routes use `requirePermission(...)` as middleware; services return typed failures. Validation failures answer **422** (the shared validation hook).

### Audit events (`ACCOUNTING_AUDIT_EVENTS`)

`accounting.account_created|updated|deleted`, `accounting.mapping_changed`, `accounting.journal_created|updated|deleted|posted|reversed`, `accounting.period_created|closed`. Automated postings made inside another module's transaction are audited by that module's act, not twice.

---

## 8. Error Codes

All codes live in contracts (`AccountingErrorCode`) with `en`/`ar` messages; HTTP mapping in `accounting.errors.ts` / `accounting.error-map.ts` (`statusCode` + `responseMessage`, per-route scoped maps).

| Code | HTTP | When |
|---|---|---|
| `ACCOUNT_NOT_FOUND` | 404 | Account missing or in another organization |
| `ACCOUNT_CODE_TAKEN` | 409 | Code already used in the organization |
| `ACCOUNT_SYSTEM_READONLY` | 409 | System account cannot be moved, deleted or change its posting flag |
| `ACCOUNT_IN_USE` | 409 | Has children, journal lines or a mapping |
| `ACCOUNT_PARENT_INVALID` | 422 | Parent missing, different type, allows posting, or creates a cycle |
| `ACCOUNT_CANNOT_POST` | 422 | Group account cannot take postings |
| `ACCOUNT_INACTIVE` | 422 | Inactive account cannot take postings |
| `ACCOUNT_MAPPING_MISSING` | 422 | No account mapped to a required role |
| `ACCOUNT_MAPPING_INVALID` | 422 | Mapped account has the wrong type or is not postable |
| `JOURNAL_ENTRY_NOT_FOUND` | 404 | Entry missing or in another organization |
| `JOURNAL_ENTRY_UNBALANCED` | 422 | Debits differ from credits |
| `JOURNAL_ENTRY_INVALID_LINE` | 422 | Bad line (both sides, neither, too few or too many lines) |
| `JOURNAL_ENTRY_ALREADY_POSTED` | 409 | Draft-only action on a posted entry |
| `JOURNAL_ENTRY_ALREADY_REVERSED` | 409 | Entry already reversed |
| `JOURNAL_ENTRY_NOT_POSTED` | 409 | Only posted entries can be reversed |
| `JOURNAL_ENTRY_CANNOT_REVERSE_REVERSAL` | 409 | A reversal cannot be reversed |
| `JOURNAL_ENTRY_DUPLICATE_SOURCE` | 409 | The source document is already posted |
| `JOURNAL_ENTRY_PERIOD_CLOSED` | 409 | The date falls in a closed period |
| `ACCOUNTING_INVALID_AMOUNT` | 422 | Malformed, oversized or all-zero amount |
| `ACCOUNTING_CURRENCY_MISMATCH` | 422 | Currency differs from the organization's |
| `ACCOUNTING_OPENING_BALANCE_INVALID` | 422 | Opening balance line not allowed |
| `ACCOUNTING_INVALID_DATE_RANGE` | 422 | A range ends before it starts |
| `ACCOUNTING_PERIOD_NOT_FOUND` | 404 | Period missing |
| `ACCOUNTING_PERIOD_OVERLAP` | 409 | Range overlaps another period |
| `ACCOUNTING_PERIOD_ALREADY_CLOSED` | 409 | Period already closed |

Also touched by this feature: `ITEM_OPENING_STOCK_COST_REQUIRED`, `ITEM_OPENING_STOCK_ACCOUNTING_FAILED` (item), `STOCK_MOVEMENT_INVALID_UNIT_COST`, `STOCK_MOVEMENT_COST_NOT_ALLOWED` (stock movement), `ORGANIZATION_INITIALIZATION_FAILED` (organization).

---

## 9. Public Barrel (`index.ts`)

Other modules import only from `../accounting/index.js`: `createAccountingService`, `createAccountingRepository`, `accountingService` / `getAccountingService` (lazy singleton, `deps.ts`), `getAccountingRepository`, `accountingRoutes` / `createAccountingRoutes`, `syncAccountingDefaults`, `accountingErrorsHttpMap`, `accountingErrorMap`, `DummyActivityLog`, and the types (`AccountingService`, `AccountingRepository`, `AccountingServiceDeps`, `InitializeChartResult`, ...).

Consumers today: `organization` (chart initialization), `item` (opening inventory), `seed.ts` (back-fill). Purchasing, sales and payments call `postBusinessEvent` with their transaction when those modules exist.

---

## 10. Not here yet

- Purchasing, sales and payment **document** modules: the posting templates and `postBusinessEvent` are ready, nothing calls them until those modules exist.
- Costing methods for outgoing stock (FIFO, average): the stock ledger values incoming stock only, so cost of goods sold is booked by the selling document with a cost it supplies.
- Multi-currency, tax returns, year-end closing entry, bank reconciliation, budgeting, journal attachments.
- Opening-balance entries have no source id, so the same list can be posted twice; callers (the UI) should treat it as a one-time wizard.

---

## 11. Tests

| File | Covers |
|---|---|
| `accounting.rules.spec.ts` | Pure account and opening-balance rules |
| `accounting.service.spec.ts` | Initialization idempotency and typed failures, accounts, mappings, journal lifecycle (draft, post, reverse, rollback), periods, org isolation, reports |
| `accounting.postings.spec.ts` | Every posting template, inventory opening (zero value, currency, idempotency), closed periods, duplicate sources, reversals |
| `__tests__/accounting.routes.test.ts` | Status codes (200/201/403/404/409/422), permission keys per route |
| `__tests__/fake-accounting-repository.ts`, `helpers.ts` | In-memory repository with transaction rollback, unique-index and compare-and-set behavior |
| contracts `*.test.ts` | Default chart integrity, valuation rounding, posting templates, schemas, `en`/`ar` locale parity |

---

## 12. File Structure

```
apps/server/src/api/modules/accounting/
├── SPEC.md
├── index.ts  deps.ts  testing.ts
├── accounting.errors.ts  accounting.error-map.ts
├── accounting.types.ts   accounting.rules.ts   accounting.mapper.ts
├── accounting.repository.ts  accounting.service.ts  accounting.seed.ts
├── accounting.rules.spec.ts  accounting.service.spec.ts  accounting.postings.spec.ts
├── hono-routes/
│   ├── module-routes.types.ts  index.ts
│   ├── create|list|get|update|delete-account(s).route.ts
│   ├── list-account-mappings.route.ts  update-account-mapping.route.ts
│   ├── create|list|get|update|delete-journal-entry(ies).route.ts
│   ├── post-journal-entry.route.ts  reverse-journal-entry.route.ts
│   ├── post-opening-balances.route.ts
│   ├── list-periods.route.ts  create-period.route.ts  close-period.route.ts
│   └── general-ledger | trial-balance | profit-and-loss | balance-sheet .route.ts
└── __tests__/  accounting.routes.test.ts  fake-accounting-repository.ts  helpers.ts
```

Contracts: `packages/contracts/src/accounting/`. Database: `packages/db/src/schema/accounting/` (migration generated with `drizzle-kit`, never edited by hand).
