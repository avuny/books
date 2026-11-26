# Party Module — Specification & Implementation Plan

| | |
|---|---|
| Product | Avuny IMS |
| Module | Party — Customers & Vendors |
| Version | 1.0 · 2026-11-23 |
| Companion | `PROGRESS.md` — live tracker, updated after every task |

> **One Party identity, multiple independent business roles, one backend aggregate, one frontend feature, two role-based user experiences.**
> Customers and Vendors are not separate entities in the database. They are separate business relationships with the same underlying party.

**Contents:** 0 How to use · 1 Enhancement summary · 2 Objective, scope, invariants · 3 Contracts · 4 Database · 5 Registry, permissions, audit · 6 Backend · 7 HTTP API · 8 Web · 9 Integration · 10 Localization · 11 Testing · 12 Implementation plan · 13 Acceptance

---

## 0. How to use this document

This file is self-contained and supersedes the original Party specification.

**Read order.** Every applicable `AGENTS.md` (`packages/db`, `packages/contracts`, `apps/server` modules, `apps/web`) → this file (§0–§2, the section for your phase, §12) → `PROGRESS.md`.

**Precedence.** (1) the nearest `AGENTS.md`; (2) this spec; (3) the closest existing module (`role`, `item`). Where this spec leaves a project-specific detail open, copy the repository. Deliberate deviations from AGENTS.md templates are listed in §1.3. Any other conflict: **stop and ask**; do not work around it.

**Notation.** MUST / SHOULD / MAY are normative. `[+]` marks content added or changed while enhancing the original; unmarked content is carried over. `⚠ verify` marks an assumption about the repository that Phase 0 must confirm. IDs: decisions `A#`, hardening `H#`, invariants `INV-#`, tasks `P#-##`, gates `G#`, test groups `CT-* RU-* ST-* RT-* WT-*`, single checks `DB-## E2E-##`, acceptance `AC-##`.

**Rules for the implementing agent**
1. Work in phase order (§12). Do not start a phase until the previous gate is green.
2. After every task update `PROGRESS.md`: tick the box, record evidence (command + result), set *Next action*.
3. Never: hand-edit generated SQL or a committed migration; edit `routeTree.gen.ts`; use `any`; import `zod` (use `@avuny/zod`); deep-import across packages or features; query Party tables from another module; delete, skip or weaken a test to make it pass.
4. Stay in scope (§2.2). Do not refactor unrelated modules.
5. Record every decision, deviation and blocker in `PROGRESS.md`.

---

## 1. Enhancement summary

The original requirements are preserved. This section lists what was **resolved, corrected or added**. Review §1.1 before Phase 1: each row is a product or architecture call that already has a safe default applied.

### 1.1 Conflicts and ambiguities — default applied, please confirm

| ID | Issue in the original | Default applied |
|---|---|---|
| A1 | `PARTY_LAST_ROLE_REQUIRED` is listed as a required error, but §4.1 allows a party whose roles are all inactive, and "Customer deactivated" must work for a customer-only party. No flow can emit it. | **Not shipped in v1.** Error codes are public API; the exhaustive error map, locales and integration tests would carry a dead code. Add it later if product wants last-role protection. |
| A2 | db AGENTS: `permission_resource` / `permission_action` are pgEnums derived from the permission catalog. server AGENTS: registry names may be plain text synced by the seed. | Phase 0 settles it (P0-05). If enums (expected): a **separate, append-only migration** adds `customer` and `vendor` (one logical change per migration). |
| A3 | Transactional forms in *other* features need `usePartyOptions`, but web AGENTS forbids API hooks in a feature root and deep imports across features. | One sanctioned entry `@/features/party-module/options` exporting only `usePartyOptions`. **Confirm with maintainers before P6-09.** |
| A4 | `partyType` is not in the §8.6 list of editable shared fields. | `partyType` is **immutable** after creation (absent from `UpdatePartySchema`). |
| A5 | If Zod rejected duplicate emails, `PARTY_EMAIL_ALREADY_EXISTS` would be unreachable over HTTP, yet every mapped code needs a real integration test. | Case-insensitive duplicates inside one submitted collection are detected by `party.rules.ts` before any write → **409**. The unique index stays as a backstop. Contracts export a pure helper so the web form can warn early. |
| A6 | Reactivation has no event; "deactivated" is not a CRUD event. | `delete` action carries event `deactivated`; new event-only action `reactivate` → `reactivated`; adding the opposite role → `created`. |
| A7 | Permission for the options endpoint is not stated. | `read:<role>`. Known limit: a user holding only `create:sales-invoice` cannot pick customers — revisit with the sales module. |
| A8 | contracts AGENTS says ICU `{name}` placeholders and UI copy in contracts locales; web AGENTS shows i18next `{{name}}` and per-app namespaces ⚠. | Copy exactly what `role/locales` and `role-module` do (P0-04). |
| A9 | Response bodies of the role endpoints are not stated. | `POST …/roles` and `DELETE …/roles/{role}` return **200 + full `PartyDto`**. |
| A10 | PATCH can set a salutation on an ORGANIZATION party; Zod cannot see the stored type. | DB CHECK `ck_party_salutation_person_only` + domain error `PARTY_SALUTATION_NOT_ALLOWED` (422). |
| A11 | Built-in roles (`SYSTEM_ROLES`) may enumerate permissions; the original does not mention them. | Grant `customer` / `vendor` permissions to built-in roles the way they hold the closest business resource (`item` ⚠). Owners are unaffected. |
| A12 | Original table says "Varchar"; db AGENTS forbids duplicated limits and uses `text` + named `ck_*_len`. | `text` + checks built from contracts constants. |

### 1.2 Corrections and hardening [+]

| ID | Problem in the original | Resolution | Where |
|---|---|---|---|
| H1 | Replacement order "update → insert → remove" breaks the partial-unique primary index (two primaries mid-way) and the email unique index (swapped values; remove + re-add of the same email). | Pure plan executed as: delete omitted → demote primaries → park changed emails → update retained → insert new → verify. | §6.2, §6.3 |
| H2 | Aggregate lock mode unspecified; `FOR UPDATE` blocks FK checks of referencing documents and can deadlock with `assertActiveRole`. | `FOR NO KEY UPDATE` on the party row; `FOR SHARE` on the role row inside `assertActiveRole(tx)`. | §6.2 |
| H3 | A constraint error caught inside a Postgres transaction aborts it; returning `{ ok: false }` does not roll back. | Validate before the first write; late errors escape through the project's rollback mechanism and are translated after rollback. | §6.6 |
| H4 | `addRole` needs a permission that depends on role state, yet denied calls must not touch the repository. | Check create and update up front (neither → 403, no repository call), decide after loading state, no writes before the decision. | §6.4 |
| H5 | The options cursor must carry `lower(display_name)`; recomputing it in JS can differ from Postgres. | Repository returns the Postgres-computed `sortKey`; the cursor carries it verbatim. | §6.2 |
| H6 | Joining emails/phones for search duplicates rows and breaks counts and cursors. | `EXISTS` sub-queries with escaped `LIKE`. | §6.2 |
| H7 | `isActive` arrives as a string; `z.coerce.boolean()` turns `"false"` into `true`. | Parse it the way existing list schemas do. | §3.5 |
| H8 | `.omit()` on refined schemas is unreliable; the opposite-role checkbox is not a stored field. | `roles` stays in form state; the checkbox is a view over it. | §8.4 |
| H9 | react-hook-form `useFieldArray` reserves `id`, which would replace persisted contact ids and trigger `PARTY_CONTACT_NOT_FOUND`. | Carry the persisted id as `contactId` in form state. | §8.4 |
| H10 | PATCH semantics for clearing a field are undefined; resending whole collections can overwrite concurrent edits. | `null` clears, `""` is rejected; the web sends only changed fields and collections. | §3.5, §8.4 |
| H11 | A stored `javascript:` website becomes a clickable XSS vector. | `http(s)` only in the contract, a render guard in the UI, notes rendered as plain text. | §3.5, §8.6 |
| H12 | Audit metadata and logs could leak personal data. | Metadata = ids and field names only. | §5.3 |
| H13 | Unbounded contact arrays. | Max 10 entries per collection (Zod). | §3.2 |
| H14 | Non-deterministic contact ordering. | Primary first, then `createdAt`, then `id`; no `position` column. | §6.5 |
| H15 | Failure branches after writes have started. | Re-read inside the transaction; invariant breaches throw (rollback). | §6.6 |
| H16 | Cache invalidation and navigation after role changes. | Prefix-based invalidation; navigate to the opposite view only if the actor can read it. | §8.3, §8.6 |
| H17 | Emails, phones and URLs mis-render in RTL. | `dir="ltr"` / `<bdi>` with `text-start`. | §8.8 |
| H18 | `varchar(n)` literals duplicate limits; a DB type named `PartyRole` clashes with the contracts type. | `text` + `ck_*` checks; row type `PartyRoleAssignment`. | §4.1, §4.6 |
| H19 | Testing depth. | Rules unit tests + service unit tests + one real route integration file + Playwright e2e; catalogs and traceability; Phases 0 and 8. | §11, §12, §13 |
| H20 | Built-in roles would not receive the new permissions. | Decision A11. | §5.4 |
| H21 | Domain decisions mixed into the service. | Pure `party.rules.ts` (no dependencies) injected into an orchestration-only service. | §6.3, §6.4 |

### 1.3 Approved deviations from AGENTS.md templates

- Service signatures carry `role: PartyRole` on `update`, `delete`, `get`; `list` / `listOptions` carry it in the query; `create` carries `roles` in its input.
- `delete` **deactivates a role**; no party row or role row is ever removed. Its route is `DELETE /parties/{partyId}/roles/{role}`.
- Additional service methods `addRole` and `assertActiveRole`; additional route `POST /parties/{partyId}/roles`.
- `get` serves inactive roles (history).
- One backend module owns two registry resources (`customer`, `vendor`).
- The DB row type of `party_roles` is `PartyRoleAssignment`.
- Additional files: `party.rules.ts`, `party.rules.spec.ts` (server) and `contacts.ts` (contracts).

---

## 2. Objective, scope and invariants

### 2.1 Objective and architecture

Implement a centralized **Party** domain. A Party is a person or organization that interacts with the organization as a `CUSTOMER`, a `VENDOR`, or both. The party is the shared identity; its roles decide how the organization interacts with it.

- One `parties` table and one `party_roles` table; separate `party_emails`, `party_phones`, `party_addresses`.
- One backend `party` module; one frontend `party-module` feature; one API set under `/parties`.
- Two user-facing experiences: **Customers** (`/customers`) and **Vendors** (`/vendors`).
- No separate customer or vendor identity tables or modules.
- No automatic party matching, linking or merging. Normal creation always creates a new party.
- The role is supplied through the `role` request parameter or the `roles` creation payload. The backend handles role-specific filtering, authorization and business rules.
- The Party module owns the lifecycle of the party **and** its role and contact rows; they are owned child records, not independent modules.
- Dependency direction: `packages/contracts` → `packages/db` → contracts registry → `apps/server` → API client generation → `apps/web`.

### 2.2 Non-goals (v1)

- Role-specific profile data (credit limit, payment terms, price lists, lead times). When added it MUST live in separate tables, never in the shared fields.
- Duplicate detection, merge or link tools; hard delete of parties; import/export; bulk actions.
- Contact persons under an organization party; bank accounts; attachments; tags/groups.
- Accounting (AR/AP balances, statements) and full sales/purchase documents.
- Optimistic concurrency/versioning of edits. v1 is last-write-wins per supplied field or collection; the aggregate lock only serializes writers.
- Idempotency keys for create. The UI disables submit while a request is pending.

### 2.3 Glossary

- **Party** — shared identity row in `parties`.
- **Role assignment** — row in `party_roles` for one `(party, role)`; `isActive` says whether the relationship is currently usable.
- **Active role R** — the party has an R role row with `isActive = true`. There is no party-level active flag.
- **Context role** — the role of the page or request (`role` parameter) that decides the permission checked.
- **Shared data** — name, legal name, salutation, tax number, website, notes, emails, phones, addresses. Stored once; visible in both role views.
- **Aggregate** — a party with its role and contact rows, loaded, locked and written as one unit.

### 2.4 Domain invariants

| ID | Invariant | Enforced by |
|---|---|---|
| INV-1 | A party is one row; the Customer and Vendor views read the same party and contact rows. | Schema (no customer/vendor identity tables) |
| INV-2 | Role rows are never deleted in normal flows; deactivation sets `is_active = false`, reactivation flips it back. | Repository surface (no delete method) |
| INV-3 | Every party is created with at least one role row. | Zod (`roles` min 1) + service |
| INV-4 | Per contact collection: at most one primary (DB); exactly one when non-empty (Zod + replacement plan). | Partial unique indexes; Zod; `planReplacement` |
| INV-5 | Child rows can only reference a party of the same organization. | Composite foreign keys |
| INV-6 | An email appears at most once per party, case-insensitively; the same email may exist on other parties. | `ux_party_email_party_email`; rules pre-check |
| INV-7 | A salutation exists only on PERSON parties. | Zod (create) + `ck_party_salutation_person_only` + rules (update) |
| INV-8 | "Active for role R" means the R role row is active; the party has no active flag. | Schema |
| INV-9 | Permissions are enforced by the service on every operation; UI gating is cosmetic. | Service; ST-AUTH, RT-PERM |
| INV-10 | Audit events come from the registry, are written after commit and carry no personal data. | Service; ST-AUDIT |
| INV-11 | A client-supplied contact id is never trusted; unknown and foreign ids are indistinguishable. | `planReplacement` + org-scoped queries |
| INV-12 | Issued documents keep their own snapshot of party data; later party edits never change them. | Document modules (§9.3) |

### 2.5 Outcome by state

`R` is the role of the request (context role or target role).

| State of (party, R) | get | update | deactivate | addRole |
|---|---|---|---|---|
| Party missing in this org | 404 `PARTY_NOT_FOUND` | same | same | same |
| No R role row | 404 `PARTY_ROLE_NOT_FOUND` | 404 `PARTY_ROLE_NOT_FOUND` | 404 `PARTY_ROLE_NOT_FOUND` | insert row, active (needs `create:R`) |
| R active | allowed | allowed | becomes inactive | 409 `PARTY_ROLE_ALREADY_ACTIVE` |
| R inactive | allowed (history) | 409 `PARTY_ROLE_INACTIVE` | 409 `PARTY_ROLE_INACTIVE` | reactivate (needs `update:R`) |

Default lists and options contain only parties whose R row is active. `isActive=false` lists inactive R rows. A party without an R row never appears in R's list.

### 2.6 Permission and audit matrix

`<role>` is `customer` / `vendor` in permission keys and `CUSTOMER` / `VENDOR` in the API.

| Operation | Permission | Precondition | Event after commit |
|---|---|---|---|
| list, get, options (role R) | `read:<R>` | get: R row exists (active or inactive); list default and options: R active | none |
| create (roles Rs) | `create:<R>` for **every** R | none | `<R>.created` for each R |
| update (context R) | `update:<R>` | R active | `<R>.updated` |
| deactivate R | `delete:<R>` | R active | `<R>.deactivated` |
| addRole R, no row | `create:<R>` | none | `<R>.created` |
| addRole R, inactive row | `update:<R>` | none | `<R>.reactivated` |
| addRole R, active row | none | 409 | none |
| `assertActiveRole` | none (internal domain check) | R active | none |

The service MUST enforce every check. Frontend gating is a usability feature only.

---

## 3. Contracts package — `packages/contracts/src/party/`

### 3.1 Layout and wiring

```
party/
├── constants.ts   enums, limits (constraint-name comments), PARTY_OPPOSITE_ROLE
├── contacts.ts    [+] pure contact helpers shared by server rules and web forms
├── errors.ts
├── schemas.ts
├── locales/       en.json · ar.json · index.ts (partyTranslationsEn / partyTranslationsAr)
├── *.test.ts      constants · contacts · schemas · locales (colocated)
└── index.ts       re-exports every file above
```

- Add `"./party"` to the `package.json` exports (copy `./role`) and `export * from "./party/index.js"` to `src/index.ts`, alphabetical. Consumers import `@avuny/contracts/party`.
- Relative imports use `.js`. Zod only from `@avuny/zod`. No I/O; never import from db, the API or the apps.
- All constants are `UPPER_SNAKE_CASE` with the `PARTY_` prefix (the root index re-exports every module; unprefixed names collide).
- `PARTY_AUDIT_EVENTS` is added to `constants.ts` in P3-01 because it needs the registry-derived `ActivityLogAction` type; it is typed with `satisfies`, so a typo cannot compile.

### 3.2 Constants, enums and limits

```ts
export const PARTY_TYPES = ["PERSON", "ORGANIZATION"] as const
export type PartyType = (typeof PARTY_TYPES)[number]

export const PARTY_SALUTATIONS = ["MR", "MS", "MRS", "DR", "PROF", "OTHER"] as const
export type PartySalutation = (typeof PARTY_SALUTATIONS)[number]

export const PARTY_ROLES = ["CUSTOMER", "VENDOR"] as const
export type PartyRole = (typeof PARTY_ROLES)[number]

export const PARTY_OPPOSITE_ROLE = { CUSTOMER: "VENDOR", VENDOR: "CUSTOMER" } as const satisfies Record<PartyRole, PartyRole>
```

Enum values are append-only (Postgres cannot drop enum values). Contact labels are free text: no label enums. A limit that backs a database CHECK carries the constraint name in its comment, for example `export const PARTY_DISPLAY_NAME_MAX_LENGTH = 150 // ck_party_display_name_len`. `@avuny/db` reads these constants; never duplicate them there.

| Constant | Value | Backs |
|---|---|---|
| `PARTY_DISPLAY_NAME_MAX_LENGTH` | 150 | `ck_party_display_name_len` |
| `PARTY_LEGAL_NAME_MAX_LENGTH` | 200 | `ck_party_legal_name_len` |
| `PARTY_TAX_NUMBER_MAX_LENGTH` | 50 | `ck_party_tax_number_len` |
| `PARTY_WEBSITE_MAX_LENGTH` | 255 | `ck_party_website_len` |
| `PARTY_NOTES_MAX_LENGTH` [+] | 2000 | `ck_party_notes_len` |
| `PARTY_EMAIL_MAX_LENGTH` | 254 | `ck_party_email_len` |
| `PARTY_PHONE_MAX_LENGTH` | 32 | `ck_party_phone_len` |
| `PARTY_CONTACT_LABEL_MAX_LENGTH` | 50 | `ck_party_email_label_len`, `ck_party_phone_label_len`, `ck_party_address_label_len` |
| `PARTY_ADDRESS_LINE_MAX_LENGTH` | 200 | `ck_party_address_line1_len`, `ck_party_address_line2_len` |
| `PARTY_CITY_MAX_LENGTH` | 100 | `ck_party_address_city_len` |
| `PARTY_STATE_MAX_LENGTH` [+] | 100 | `ck_party_address_state_len` |
| `PARTY_POSTAL_CODE_MAX_LENGTH` | 20 | `ck_party_address_postal_code_len` |
| `PARTY_COUNTRY_CODE_PATTERN` | `^[A-Z]{2}$` | `ck_party_address_country_code` (ISO 3166-1 alpha-2 format; membership is not checked) |
| `PARTY_PHONE_MIN_DIGITS` [+] | 3 | Zod only |
| `PARTY_CONTACTS_MAX_COUNT` [+] | 10 | Zod only, per collection (H13) |

The values are **proposed defaults**: confirm them before P1-02. After Phase 2, changing a limit that backs a `ck_` requires a migration. Every constraint name stays ≤ 63 bytes. Reuse the existing page-size constants for lists.

### 3.3 Contact helpers — `contacts.ts` [+]

Pure, framework-free; used by Zod refinements, `party.rules.ts` and the web forms.

- `emailKey(email)` — trimmed, lower-cased comparison key.
- `findDuplicateEmailIndexes(entries)` — index of every entry whose key appeared earlier.
- `countPrimaries(entries)` and `hasExactlyOnePrimary(entries)` — `[]` is valid; a non-empty list needs exactly one.
- `findDuplicateIds(entries)` — repeated ids inside one update collection.

### 3.4 Error codes

`PartyErrorCode` is an object plus a union type with the same name, values equal to keys. Codes are public API: never rename or reuse; add others only when a real business or database constraint requires them.

| Code | HTTP | Raised when |
|---|---|---|
| `PARTY_NOT_FOUND` | 404 | No party with that id in the organization (also for another organization's id). |
| `PARTY_ROLE_NOT_FOUND` | 404 | The party has no row for the requested role (get, update, deactivate). |
| `PARTY_ROLE_ALREADY_ACTIVE` | 409 | `addRole` on a role that is already active. |
| `PARTY_ROLE_INACTIVE` | 409 | update or deactivate on an inactive role; also `assertActiveRole`. |
| `PARTY_CONTACT_NOT_FOUND` | 404 | An update entry carries an id that is not a row of this party (unknown, another party, another organization — one answer for all). |
| `PARTY_EMAIL_ALREADY_EXISTS` | 409 | The same email, case-insensitively, appears twice in one submitted collection (rules pre-check; unique index as backstop). |
| `PARTY_SALUTATION_NOT_ALLOWED` [+A10] | 422 | An update sets a non-null salutation on an ORGANIZATION party. |

Not defined: `PARTY_LAST_ROLE_REQUIRED` (A1). Permission denial uses the shared `RoleErrorCode.ROLE_PERMISSION_DENIED`; never create a duplicate.

### 3.5 Schemas and DTOs

Follow the contracts naming rules: `XSchema` / `X` type, bounds from constants, `.trim()` before `.min()` / `.max()`, ids `z.string().uuid()`, DTO timestamps `z.string().datetime()`, sections grouped with `/* ---------- section ---------- */` headers.

**Field rules**
- `displayName` required (1…max). `legalName`, `taxNumber`, `notes`: optional, non-empty when present. `website`: optional absolute URL whose scheme is `http` or `https` only (H11). `salutation`: optional, PERSON only.
- Email: valid address, ≤ `PARTY_EMAIL_MAX_LENGTH`. Phone: ≤ `PARTY_PHONE_MAX_LENGTH`, characters limited to digits, space and `+ ( ) - . /`, at least `PARTY_PHONE_MIN_DIGITS` digits, stored exactly as typed. Label: optional free text.
- Address: `addressLine1` required, everything else optional. `countryCode` is trimmed, upper-cased, then matched against `PARTY_COUNTRY_CODE_PATTERN`.
- Entry schemas `PartyEmailInputSchema`, `PartyPhoneInputSchema`, `PartyAddressInputSchema`: `isPrimary` defaults to `false`. Update entries (`…UpdateEntry…`) add an optional `id` (uuid).
- Prefer a plain base object schema plus a separately exported refined schema, so consumers never need `.omit()` / `.pick()` on a refined schema (H8).

**`CreatePartySchema` / `CreatePartyInput`** — `roles`, `partyType`, `salutation`, `displayName`, `legalName`, `taxNumber`, `website`, `notes`, `emails`, `phones`, `addresses` (contact arrays default to `[]`, at most `PARTY_CONTACTS_MAX_COUNT`).
- `roles`: at least one, supported values only, no duplicates.
- `salutation`: absent or `null` for ORGANIZATION.
- Every non-empty contact collection has exactly one `isPrimary: true`; empty collections are valid.
- Duplicate emails are **not** a Zod concern (A5); the service rules decide.

**`UpdatePartySchema` / `UpdatePartyInput`** — optional `displayName`, `salutation`, `legalName`, `taxNumber`, `website`, `notes`, `emails`, `phones`, `addresses`; `.refine()` requires at least one field. `partyType` and `roles` are not updatable here (A4). Put this comment directly beside the schema:

```ts
/**
 * UpdatePartySchema — PATCH body.
 *
 * Scalars: omitted = unchanged · null = clear (nullable fields only) · value = set.
 * Collections (emails, phones, addresses): when supplied, the array is the COMPLETE
 * replacement for that collection.
 *   - omitted           → collection unchanged
 *   - []                → every entry removed
 *   - non-empty array   → the stored set becomes exactly this array
 * An entry with an `id` keeps that row (the id must belong to this party);
 * an entry without `id` is inserted; stored rows whose id is absent are deleted.
 * A non-empty array must contain exactly one `isPrimary: true`; ids must not repeat.
 */
```

| Field | Omitted | `null` | Value |
|---|---|---|---|
| `displayName` | unchanged | invalid | set |
| `salutation` | unchanged | clear | set (PERSON parties only; else `PARTY_SALUTATION_NOT_ALLOWED`) |
| `legalName`, `taxNumber`, `website`, `notes` | unchanged | clear | set; `""` is rejected (send `null`) |
| `emails`, `phones`, `addresses` | unchanged | invalid (send `[]`) | replace the whole collection |

Unknown keys follow the repository convention (reject or strip, ⚠ P0-04). Either way a test proves that `roles` or `partyType` in a PATCH body never change stored values.

**Role and query schemas**
- `PartyRoleQuerySchema` `{ role }` — query of get and update. `AddPartyRoleSchema` `{ role }` — body of `POST …/roles`. `PartyRoleParamSchema` `{ partyId, role }` — path of `DELETE …/roles/{role}`.
- `PartyOffsetListQuerySchema` — `role` (required), `page`, `pageSize` (coerced numbers, defaults and max from constants), `search` (empty → `undefined`), `isActive`. Omitted `isActive` means `true`. Parse the boolean the way existing list schemas do; never `z.coerce.boolean()` (H7).
- `PartyOptionListQuerySchema` — the existing cursor option query extended with a **mandatory** `role`. Responses reuse `OptionListResponseSchema` (`{ items: {id, name}[], nextCursor }`). Never expose full party records through options.
- `PartyOptionCursorSchema` — `{ name: string, id: uuid }`; `name` holds the Postgres-computed `lower(display_name)` (H5).
- `PartyOffsetListResponseSchema` — `{ items, page, pageSize, total }`.

**DTOs** (never expose `orgId` or internal columns)
- `PartyRoleDto` `{ role, isActive, createdAt, updatedAt }`.
- `PartyEmailDto` `{ id, email, label, isPrimary }`; `PartyPhoneDto` `{ id, phone, label, isPrimary }`; `PartyAddressDto` `{ id, label, addressLine1, addressLine2, city, state, postalCode, countryCode, isPrimary }` (optional values are `null` when absent).
- `PartyDto` `{ id, partyType, salutation, displayName, legalName, taxNumber, website, notes, roles, emails, phones, addresses, createdAt, updatedAt }`.
- `PartyListItemDto` `{ id, displayName, partyType, primaryEmail, primaryPhone, roles: { role, isActive }[], createdAt, updatedAt }` — lightweight; primary values are `null` when none.

### 3.6 Locales

en and ar with identical key sets: see §10.

---

## 4. Database package — `packages/db/src/schema/party/`

### 4.1 Layout and conventions

```
party/
├── parties.ts     enums + the five tables (an enum lives with the table that owns it)
├── relations.ts   every drizzle relations() of the domain
└── index.ts
```

Re-export from `src/schema/index.ts`; consumers import from `@avuny/db`, never deep paths. No business logic, queries, HTTP or validation here.

- Copy `access-control/role.ts` (tables) and `inventory/item.ts` (tenant-scoped tables, composite FKs). Domain files use double quotes, no semicolons, 4-space indent, `.js` imports.
- Use `pk()`, `orgRef()`, `timestamps()`; named `ux_` / `ix_` / `ck_` / `fk_` constraints, each ≤ 63 bytes; composite tenant-safe FKs; explicit `onDelete`; exported inferred row types.
- Strings are `text` plus named length checks (`lengthBetween`, `matchesRegex`, or `sql.raw` with contracts constants). No `varchar(n)` literals (H18, A12).
- Enums derive from the contracts arrays and are append-only: `party_type` ← `PARTY_TYPES`, `party_salutation` ← `PARTY_SALUTATIONS`, `party_role` ← `PARTY_ROLES`. Never put enums or JSON types in `_helpers.ts`.

### 4.2 Tables

**`parties`** — shared identity.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `pk()` | no | |
| `org_id` | `orgRef()` | no | tenant |
| `party_type` | enum `party_type` | no | immutable (A4) |
| `salutation` | enum `party_salutation` | yes | PERSON only |
| `display_name` | `text` | no | |
| `legal_name` | `text` | yes | |
| `tax_number` | `text` | yes | not unique |
| `website` | `text` | yes | |
| `notes` | `text` | yes | plain text |
| `created_at`, `updated_at` | `timestamps()` | no | |

- `ux_party_org_id` — unique `(org_id, id)`: FK target for every child and for future documents.
- `ix_party_org_display_name` — `(org_id, lower(display_name), id)`: list and option ordering.
- `ck_party_display_name_len` (1…max); `ck_party_legal_name_len`, `ck_party_tax_number_len`, `ck_party_website_len`, `ck_party_notes_len` (each 1…max when not null).
- `ck_party_salutation_person_only` [+A10]: `salutation IS NULL OR party_type = 'PERSON'`.
- No uniqueness on names or tax numbers. **No `is_active` column** — if every role is inactive the party stays stored for historical references.

**`party_roles`** — Customer / Vendor role assignments.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `pk()` | no | |
| `org_id` | `orgRef()` | no | |
| `party_id` | uuid | no | |
| `role` | enum `party_role` | no | |
| `is_active` | boolean, default true | no | not an ACTIVE/INACTIVE enum |
| `created_at`, `updated_at` | `timestamps()` | no | |

- `ux_party_role_party_role` — unique `(org_id, party_id, role)`; its leading columns also serve the FK.
- `fk_party_role_party` — composite FK `(org_id, party_id)` → `parties (org_id, id)`, `onDelete: cascade` (owned child; parties are not hard-deleted in normal flows).
- `ix_party_role_org_role_active` — `(org_id, role, is_active, party_id)` for list and option queries.
- A role row has an independent lifecycle: deactivation never deletes it; an inactive row is reactivated, not re-inserted.

**`party_emails`** — `id`, `org_id`, `party_id`, `email` (not null), `label` (null), `is_primary` (not null, default false), timestamps.
- `fk_party_email_party` composite FK, `onDelete: cascade`.
- `ux_party_email_party_email` — unique `(org_id, party_id, lower(email))`: case-insensitive per party; the same email on another party is allowed. Its leading columns serve the FK, so add no redundant index.
- `ux_party_email_primary` — partial unique `(org_id, party_id)` where `is_primary = true`.
- `ck_party_email_len`, `ck_party_email_label_len`.

**`party_phones`** — `phone` (entered display format preserved; no global uniqueness), `label`, `is_primary`. `fk_party_phone_party` (cascade), `ix_party_phone_party (org_id, party_id)`, `ux_party_phone_primary`, `ck_party_phone_len`, `ck_party_phone_label_len`. No phone normalization unless an existing Avuny utility already provides a suitable one.

**`party_addresses`** — `label`, `address_line1` (not null), `address_line2`, `city`, `state`, `postal_code`, `country_code` (all null), `is_primary`. `fk_party_address_party` (cascade), `ix_party_address_party (org_id, party_id)`, `ux_party_address_primary`, plus `ck_party_address_label_len`, `ck_party_address_line1_len`, `ck_party_address_line2_len`, `ck_party_address_city_len`, `ck_party_address_state_len`, `ck_party_address_postal_code_len`, `ck_party_address_country_code`.

### 4.3 Primary-contact integrity

For each contact table a partial unique index on `(org_id, party_id)` where `is_primary = true` guarantees **at most one** primary. A unique index cannot guarantee that a non-empty collection **has** a primary: Zod (shape), the pure replacement plan and the service enforce "exactly one" inside the transaction while the party row is locked. These indexes are checked immediately (not deferrable), which is why the execution order in §6.2 (H1) is mandatory.

### 4.4 Table comment blocks

Every table gets the template comment (what it is · real-world flow · integrity rules · what is **not** expressible here).

| Table | Flow | Not expressible here |
|---|---|---|
| `parties` | Created from the Customers or Vendors page (or API) together with at least one role; edited from either view; never hard-deleted in normal flows. | At least one role row at creation; `party_type` immutability; names and tax numbers are deliberately not unique; no active flag by design. |
| `party_roles` | One row per (party, role); inserted at creation or when the opposite role is added; toggled by deactivate / reactivate. | Who may toggle (permissions); "role must be active" checks live in the service and in `assertActiveRole`. |
| `party_emails` | Owned by the party; replaced as a set on update. | Exactly one primary when non-empty; max 10 rows; email format. |
| `party_phones` | Same. | Same, plus phone format. |
| `party_addresses` | Same. | Same, plus: the country code is format-checked only, not looked up in ISO 3166. |

### 4.5 Relations, exports and row types

All `relations()` live in `relations.ts`: a party has many roles, emails, phones and addresses; each child has one party. Export inferred types `Party`, `PartyRoleAssignment` (H18), `PartyEmail`, `PartyPhone`, `PartyAddress` and their `New…` insert types.

### 4.6 Migrations

1. Build contracts, then run `drizzle-kit generate`: **one logical migration** for the Party schema.
2. Read the generated SQL. It must contain only the intended Party enums, tables, indexes and constraints. Unrelated diffs mean something is wrong.
3. Never hand-edit generated SQL; never edit a committed migration.
4. Apply it to an empty local database; run db typecheck, lint and tests; verify DB-01…DB-10 (§11.3).
5. Do not alter existing customer/vendor or transaction tables before inspecting them (§9.2).
6. [+A2] If `permission_resource` is an enum, adding `customer` / `vendor` is a **separate** append-only migration generated in Phase 3 — never mixed into the Party schema migration.

---

## 5. Registry, permissions and audit

One backend module, two grantable resources: `customer` and `vendor` keep independent access control and two sidebar entries.

### 5.1 Registry entries — `packages/contracts/src/modules/registry.ts`

```ts
// shape ⚠ verify against ActionSpec / CRUD in the real file
customer: {
  sidebar: { group: "<existing group>", icon: "<valid icon>", path: "/customers",
             label: { en: "Customers", ar: "العملاء" } },
  actions: {
    ...CRUD,                                              // create, read, update with their events
    delete: { permission: true, event: "deactivated" },   // overrides CRUD.delete: this is deactivation
    reactivate: { event: "reactivated" },                 // logged only; guarded by update:customer
  },
  scopable: false,                                        // org-level grants only in v1
},
vendor: { /* same shape */ path: "/vendors", label: { en: "Vendors", ar: "الموردون" } },
```

Resulting permission keys (use the generated `PermissionKey`, never build strings at runtime): `create:customer`, `read:customer`, `update:customer`, `delete:customer`, `create:vendor`, `read:vendor`, `update:vendor`, `delete:vendor`.

### 5.2 Sidebar

- Two separate entries: Customers → `/customers`, Vendors → `/vendors`, complete en + ar labels.
- Verify `SIDEBAR_GROUPS` and use existing groups (a sales-like group for Customers, a purchasing-like group for Vendors). Add a group only if none fits; then it needs an icon and en + ar labels. Record the choice in `PROGRESS.md`.
- The icon must be a valid member of the registry's icon type (⚠ verify; suggestions `users`, `truck`).

### 5.3 Activity events

| Flow | Event(s) | resourceId | Metadata |
|---|---|---|---|
| create with roles Rs | `PARTY_AUDIT_EVENTS[R].CREATED` for each R | party id | `{ roles, via: "create" }` |
| update in context R | `[R].UPDATED` | party id | `{ changedFields }` (field names present in the request) |
| deactivate R | `[R].DEACTIVATED` | party id | `{}` |
| addRole R (new row) | `[R].CREATED` | party id | `{ via: "addRole" }` |
| addRole R (reactivation) | `[R].REACTIVATED` | party id | `{}` |

- Events come only from the registry-derived constants; no raw event strings in service files.
- Written after a successful commit, never inside the transaction. Failed operations write nothing.
- Metadata MUST NOT contain names, emails, phones, addresses, tax numbers or notes (H12).
- Shared data updated through the Customer view is audited in the Customer context; the data itself stays shared.

### 5.4 System roles and seeds

- The seed synchronizes registry entries into plain-text records; understand its behavior first (removing or renaming an entry can strip grants from every role). This change only **adds** entries.
- Check whether `permission_resource` / `permission_action` are enums (A2): db AGENTS says they derive from the catalog, so `customer` / `vendor` likely need an append-only enum migration. `reactivate` has no permission, so it adds no action value.
- [+A11] Inspect `SYSTEM_ROLES`. If built-in roles enumerate permissions, grant `customer` / `vendor` the way each role holds the closest business resource (`item` ⚠). System role names are identities: never rename. Owners already have implicit full access.
- Add `labels.resources.customer` / `labels.resources.vendor` (and any action or event label the role editor or activity-log UI needs) to the **role** locale files, en and ar together.
- Do not create sample Party rows in system seeds.
- After editing the registry rebuild `@avuny/contracts` and check that `PermissionKey` accepts the eight keys and `ActivityLogAction` accepts the eight events.

---

## 6. Backend — `apps/server/src/api/modules/party/`

The Party domain owns the party root and every role and contact row. Other modules reach it only through `party/index.ts`; they never query Party tables.

### 6.1 Layout

```
party/
├── party.repository.ts        all DB access for the aggregate — no repository per child table
├── party.rules.ts             [+] pure domain decisions, zero dependencies
├── party.service.ts           orchestration: authorize → load → decide (rules) → write → audit
├── party.types.ts · party.permissions.ts · party.errors.ts · party.mapper.ts
├── deps.ts                    composition root (db, repository, permissions, activity log, rules)
├── testing.ts                 fixtures and fakes
├── party.rules.spec.ts        [+] pure tests, no fakes
├── party.service.spec.ts      unit tests with fakes; never imports deps.ts
├── party.routes.int.test.ts   exactly one real route integration file
├── hono-routes/
│   ├── module-routes.types.ts
│   ├── create-party.route.ts · list-parties.route.ts · party-options.route.ts
│   ├── get-party.route.ts · update-party.route.ts
│   ├── add-party-role.route.ts · deactivate-party-role.route.ts      (original name: delete-party-role)
│   └── index.ts
└── index.ts
```

Adapt names to the closest working module (`role`) without changing responsibilities.

### 6.2 Repository

`createPartyRepository({ db })` with `const exec = (tx?: Tx) => tx ?? db`, a `transaction<T>(fn)` method that owns transactions, and an optional `tx?: Tx` on every method that can join a larger use case. Never silently open a second transaction when the caller supplied one. **Every query and write includes `org_id`, children included.** Public methods speak domain terms; no arbitrary table operations are exposed.

| Method | Purpose |
|---|---|
| `insertAggregate(orgId, values, roles, contacts, tx?)` | Insert party → active role rows → emails, phones, addresses; return the rows. |
| `findAggregate(orgId, id, tx?, { lock? })` | Party with roles and the three contact collections, ordered per §6.5. `lock: true` takes the aggregate lock. `null` when missing in this org. |
| `updateShared(orgId, id, patch, tx)` | Update scalar fields; always bumps `updated_at`. |
| `applyEmailPlan`, `applyPhonePlan`, `applyAddressPlan` `(orgId, partyId, plan, tx)` | Execute a replacement plan in the mandatory order below. |
| `insertRole(orgId, partyId, role, tx)`, `setRoleActive(orgId, partyId, role, isActive, tx)` | Add or toggle a role row. Never delete one. |
| `findRoleState(orgId, partyId, role, tx?, { share? })` | Lightweight read for `assertActiveRole`. |
| `list(orgId, filters, tx?)` | `{ rows, total }` for the data table. |
| `listOptions(orgId, filters, tx?)` | `{ id, name, sortKey }[]` for pickers. |

**Aggregate lock (H2).** Every mutating operation locks the party row first and in the same order, so concurrent edits serialize and cannot deadlock:

```ts
const [party] = await exec(tx).select().from(parties)
  .where(and(eq(parties.orgId, orgId), eq(parties.id, id)))
  .limit(1)
  .for("no key update")      // not "update": FK checks from referencing documents must not block
```

`findRoleState(…, { share: true })` runs two plain queries (does the party exist; then the role row `FOR SHARE`) because Postgres cannot lock the nullable side of an outer join. A concurrent deactivation therefore waits for a document transaction that has already validated the role.

**Replacement plan execution (H1).** Each contact collection is replaced by a plan produced by `party.rules.ts` (§6.3). The repository executes it **in this order**, inside the caller's transaction, with the party already locked:

1. Delete rows whose id is not in the submission.
2. Demote: set `is_primary = false` on retained rows that are currently primary.
3. Emails only — park: for retained rows whose email key changes, set `email = id::text` (unique by construction) so swaps and chains cannot collide.
4. Update retained rows to their final values (`label`, `is_primary`, `email`, …) and `updated_at`.
5. Insert new rows (the database generates their ids).
6. Verify: when the submission is non-empty exactly one row is primary, else **throw** (invariant breach, rolls back).

Existing rows keep their ids. The partial unique indexes are not deferrable, so any other order breaks on a primary change, an email swap or a remove-and-re-add of the same email. The party lock makes the unique-index backstops (`ux_party_email_party_email`, `ux_party_role_party_role`) practically unreachable; they are still mapped to typed outcomes (§6.6).

**List.** One row per party: inner join the requested role row (`role = :role AND is_active = :isActive`), left join the **primary** email and phone (at most one each), `WHERE p.org_id = :org AND <search>`, order `lower(display_name), id`, limit/offset. The count query uses the same predicates without the left joins. The roles summary of the page is a second query `WHERE org_id = :org AND party_id IN (:pageIds)`. Never N+1.

**Search predicate (H6)** shared by list and options. Escape `%`, `_` and `\`; match display name, legal name and tax number directly, and email and phone through `EXISTS`, which keeps one row per party:

```ts
const pattern = `%${escapeLike(search)}%`
or(
  ilike(parties.displayName, pattern), ilike(parties.legalName, pattern), ilike(parties.taxNumber, pattern),
  exists(db.select({ one: sql`1` }).from(partyEmails).where(and(
    eq(partyEmails.orgId, parties.orgId), eq(partyEmails.partyId, parties.id), ilike(partyEmails.email, pattern)))),
  exists(/* same shape on partyPhones.phone */),
)
```

v1 matches phones on the stored display text. Digits-only matching and `pg_trgm` indexes are follow-ups (`drizzle-kit generate --custom`) if lists grow large.

**Options (H5).** Only parties whose requested role is **active**. The sort key and the cursor value are computed by Postgres:

```ts
const sortKey = sql<string>`lower(${parties.displayName})`
const rows = await exec(tx)
  .select({ id: parties.id, name: parties.displayName, sortKey })
  .from(parties)
  .innerJoin(partyRoles, and(eq(partyRoles.orgId, parties.orgId), eq(partyRoles.partyId, parties.id)))
  .where(and(
    eq(parties.orgId, orgId), eq(partyRoles.role, f.role), eq(partyRoles.isActive, true), searchCondition(f.search),
    f.after ? sql`(lower(${parties.displayName}), ${parties.id}) > (${f.after.name}::text, ${f.after.id}::uuid)` : undefined))
  .orderBy(asc(sortKey), asc(parties.id))
  .limit(f.limit)               // the caller passes limit + 1
```

The cursor must contain every ordering value, in the same order as the comparison.

### 6.3 Domain rules — `party.rules.ts` [+]

A plain exported object (`partyRules`) with no imports from the database, HTTP, permissions or the audit service, injected into the service through `deps`. The service only orchestrates; every decision below is a pure function tested without fakes (RU-*).

| Rule | Input → output |
|---|---|
| `roleState` | the aggregate's roles (or `null`) + a role → `party_missing`, `role_missing`, `active` or `inactive` |
| `assertReadable`, `assertActive` | state → `PARTY_NOT_FOUND`, `PARTY_ROLE_NOT_FOUND`, `PARTY_ROLE_INACTIVE` or `null` (§2.5) |
| `decideAddRole` | state → `insert` (needs create), `reactivate` (needs update) or an error (`PARTY_NOT_FOUND`, `PARTY_ROLE_ALREADY_ACTIVE`) |
| `checkSalutation` | stored `partyType` + patch salutation → `PARTY_SALUTATION_NOT_ALLOWED` or `null` |
| `hasDuplicateEmail` | submitted emails → boolean (contracts helper, A5) |
| `planReplacement` | existing rows + submitted entries → plan, or `PARTY_CONTACT_NOT_FOUND` |
| `changedFields` | update input → field names present (audit metadata) |

`planReplacement` returns:

```ts
type ReplacementPlan<E> = {
  deleteIds: string[]                                  // stored rows absent from the submission
  demoteIds: string[]                                  // retained rows that are currently primary
  parkIds: string[]                                    // retained email rows whose email key changes (emails only)
  updates: { id: string; values: Omit<E, "id"> }[]     // retained rows → final values
  inserts: Omit<E, "id">[]                             // new rows
}
```

A submitted `id` that is not among the party's existing rows of that collection yields `PARTY_CONTACT_NOT_FOUND` — the same answer for unknown, foreign-party and foreign-organization ids (INV-11).

### 6.4 Service — `createPartyService(deps)`

`deps` = `{ repository, permissions, activityLog, rules }`. Use `Result<T, Code>` from `@avuny/utils`; expected business failures are returned, never thrown. Internals follow the module template: `can`, `forbidden` (shared `ROLE_PERMISSION_DENIED`), `stop`, `audit`, and an `Outcome<T>` type for transaction callbacks.

The six mandatory methods plus two domain methods:

```ts
create(actorId, orgId, input)
update(actorId, orgId, id, role, input)        // role: PartyRole
delete(actorId, orgId, id, role)               // deactivates the role
listOptions(actorId, orgId, query)             // query.role
list(actorId, orgId, query)                    // query.role
get(actorId, orgId, id, role)
addRole(actorId, orgId, partyId, role)
assertActiveRole(orgId, partyId, role, tx?)    // internal port, no actor
```

**create** — 1) every requested role needs `create:<role>`, else `forbidden()` with no repository call; 2) `rules.hasDuplicateEmail` → `PARTY_EMAIL_ALREADY_EXISTS`; 3) one transaction: `insertAggregate` (party → active role rows → contacts), then re-read inside the transaction; 4) after commit audit `[R].CREATED` for each role; 5) return the DTO (201).

**update** — 1) `update:<role>` else forbidden; 2) `hasDuplicateEmail` pre-check; 3) transaction: lock and load the aggregate, then decide **before the first write**: `assertActive` (party / role / inactive), `checkSalutation`, and `planReplacement` for each supplied collection; 4) writes: `updateShared` (always bumps `updated_at`), then each plan; omitted collections are untouched; 5) re-read, commit; 6) audit `[role].UPDATED` with `changedFields`. A change made in the Customer context is immediately visible in the Vendor context: it is the same row.

**delete (deactivate)** — 1) `delete:<role>` else forbidden; 2) transaction: lock and load; `assertActive`; `setRoleActive(false)`; re-read; 3) audit `[role].DEACTIVATED`. The party row, the role row and every contact survive; the opposite role is untouched.

**addRole (H4)** — 1) check `create:<role>` **and** `update:<role>`; neither → `forbidden()` with no repository call; 2) transaction: lock and load, `decideAddRole`; 3) `insert` requires the create permission, `reactivate` requires the update permission — if the needed one is missing return `forbidden()` (no write has happened yet, so a normal return is safe); 4) `insertRole` or `setRoleActive(true)`; re-read; 5) audit `CREATED` or `REACTIVATED`. It never creates a second party.

**get** — `read:<role>`; load without lock; `assertReadable` (party and role row must exist; **inactive is allowed**); return the DTO with every role assignment.

**list** — `read:<role>`; default `isActive = true`; `repo.list` → `{ items, page, pageSize, total }` through the mapper.

**listOptions** — `read:<role>` (A7); `decodeCursor(query.cursor, PartyOptionCursorSchema)` (a bad cursor restarts at page one, no error code); `repo.listOptions({ role, search, after, limit: limit + 1 })`; `toCursorPage(rows, limit, (row) => ({ name: row.sortKey, id: row.id }))`; return only `{ id, name }` items and `nextCursor`.

**assertActiveRole** — no actor and **no permission check**: a document transaction must not need a separate Party read permission. `repo.findRoleState(orgId, partyId, role, tx, { share: tx !== undefined })`, then `rules.assertActive`. Returns a `Result` with `PARTY_NOT_FOUND`, `PARTY_ROLE_NOT_FOUND` or `PARTY_ROLE_INACTIVE`. Exported through `party/index.ts` (§6.5).

### 6.5 Mapper, permissions, errors, deps, exports

- **Mapper** (`party.mapper.ts`) — pure aggregate → `PartyDto`, row → `PartyListItemDto`, contact DTOs. Convert `Date` to the contract's ISO string. Do not expose internal columns or `orgId`. Roles ordered as in `PARTY_ROLES`; contacts ordered **primary first, then `created_at`, then `id`** (H14) — the mapper enforces it so it is testable without a database. There is no `position` column; the submitted array order is not persisted.
- **Permissions** (`party.permissions.ts`) — typed constants with `satisfies Record<string, PermissionKey>`, for example `PARTY_PERMISSIONS = { CUSTOMER: { CREATE: "create:customer", READ: "read:customer", UPDATE: "update:customer", DELETE: "delete:customer" }, VENDOR: { … } }`. Never build strings at runtime. Pass `{ resourceId: orgId, orgId }` (org-level grants; `scopable` is false).
- **Errors** (`party.errors.ts`) — an exhaustive map `PartyErrorCode` → `{ statusCode, responseMessage }` using §3.4, plus the shared `roleErrorsHttpMap.ROLE_PERMISSION_DENIED`. API translations live in `apps/server/src/api/intl/locales/party/{en,ar}.json`, registered like the other namespaces.
- **Types** (`party.types.ts`) — `PartyRepository`, `PartyRules`, `PartyService`, `PartyServiceDeps` inferred from the factories; no `any`.
- **deps.ts** — composes `db`, the repository, `permissionChecker`, the activity-log adapter and `partyRules`; use the lazy singleton + Proxy pattern only if the neighbouring module does.
- **index.ts** — export `partyRoutes`, `createPartyRoutes`, `partyService`, `getPartyService`, `createPartyService`, `partyErrorsHttpMap`, `PARTY_PERMISSIONS`, the types, and the **domain port**: `assertActiveRole` bound to the lazily built service plus a `PartyRolePort` type. Keep repository internals private.

### 6.6 Transaction and audit safety

1. Authorize **before** opening a transaction.
2. Decide everything the loaded state allows **before the first write**: party and role state, salutation, contact ownership, duplicate emails.
3. Returning `{ ok: false }` from a Drizzle callback does **not** roll back. After the first write a failure MUST throw (or use the project's explicit rollback mechanism, ⚠ P0-03) so nothing partial commits (H3).
4. A known constraint error raised inside a transaction aborts it in Postgres: let it escape and translate it after rollback (`email_duplicate` → `PARTY_EMAIL_ALREADY_EXISTS`, `role_exists` → `PARTY_ROLE_ALREADY_ACTIVE`). Catch only known constraint names; rethrow everything else.
5. Build every response by re-reading the aggregate inside the same transaction (H15). A missing row there is an invariant breach: throw.
6. Audit only after a successful commit, never inside the transaction.
7. A cross-module use case that needs `assertActiveRole` passes its own `tx`. Never call two independently committing services and assume one transaction.

---

## 7. HTTP API

All routes are organization-scoped and use `createRoute`, `createOpenAPIRouter`, `requireAuth`, contract schemas, `globalErrorResponses` and the existing helpers (`handleResult`, `jsonOk`, `jsonError`, `honoPath`). Business rules stay out of routes. `role` is a query parameter for role-scoped reads and updates; creation carries `roles` in the body.

### 7.1 Endpoints

| Method and path | operationId | Service | Success | Permission |
|---|---|---|---|---|
| `POST /organizations/{orgId}/parties` | `createParty` | `create` | 201 `PartyDto` | `create:<R>` for every requested R |
| `GET /organizations/{orgId}/parties?role=` | `listParties` | `list` | 200 `PartyOffsetListResponse` | `read:<role>` |
| `GET /organizations/{orgId}/party-options?role=` | `listPartyOptions` | `listOptions` | 200 `OptionListResponse` | `read:<role>` |
| `GET /organizations/{orgId}/parties/{partyId}?role=` | `getParty` | `get` | 200 `PartyDto` | `read:<role>` |
| `PATCH /organizations/{orgId}/parties/{partyId}?role=` | `updateParty` | `update` | 200 `PartyDto` | `update:<role>` |
| `POST /organizations/{orgId}/parties/{partyId}/roles` | `addPartyRole` | `addRole` | 200 `PartyDto` | `create:<role>` (new) or `update:<role>` (reactivate) |
| `DELETE /organizations/{orgId}/parties/{partyId}/roles/{role}` | `deactivatePartyRole` | `delete` | 200 `PartyDto` | `delete:<role>` |

`/party-options` is a separate prefix from `/parties/{partyId}`, so no route shadows another. Register the Party router in the existing top-level API composition and tag every operation `party`. Orval derives the hooks from the operationIds: `useListParties`, `useGetParty`, `useCreateParty`, `useUpdateParty`, `useAddPartyRole`, `useDeactivatePartyRole`, `listPartyOptions`, and query-key getters such as `getListPartiesQueryKey`, `getGetPartyQueryKey`, `getListPartyOptionsQueryKey`.

### 7.2 Behavior

- **List** — `role` required; `page`, `pageSize`, `search`, `isActive`. The default returns parties whose requested role is active; `isActive=false` returns inactive role assignments; a party without the role never appears.
- **Options** — `role`, `search`, `cursor`, `limit`. Search covers display name, legal name, email, phone and tax number. Stable case-insensitive order by display name then id; fetch `limit + 1`; only active parties with an active requested role; items are exactly `{ id, name }`.
- **Get** — `role` decides the permission and the context; the response is the full `PartyDto` including every role assignment; an inactive role can still be retrieved.
- **Create** — examples:

```json
{ "roles": ["VENDOR"], "partyType": "PERSON", "salutation": "MR", "displayName": "Mark John",
  "emails": [], "phones": [], "addresses": [] }
```

```json
{ "roles": ["VENDOR", "CUSTOMER"], "partyType": "PERSON", "salutation": "MR", "displayName": "Mark John",
  "emails": [{ "email": "mark@example.com", "isPrimary": true }], "phones": [], "addresses": [] }
```

  Permissions for **all** requested roles are checked before any write: creating a Vendor who is also a Customer needs `create:vendor` and `create:customer`; otherwise 403 and nothing is persisted.
- **Update** — shared information plus any supplied contact collection; role assignments cannot change here:

```json
PATCH …/parties/{partyId}?role=VENDOR
{ "displayName": "Mark J. John", "legalName": null,
  "emails": [ { "id": "<existing email id>", "email": "mark@example.com", "label": "Work", "isPrimary": false },
              { "email": "mark.personal@example.com", "isPrimary": true } ],
  "phones": [] }
```

  Result: name changed; legal name cleared; emails replaced (the first row kept, the second inserted and promoted to primary, any other stored email removed); all phones removed; addresses untouched.
- **Add or reactivate a role** — `POST …/roles` with `{ "role": "VENDOR" }`. New role: needs the target's create permission. Existing inactive role: needs the target's update permission and reactivates it. Already active: 409 `PARTY_ROLE_ALREADY_ACTIVE`. It never creates a party.
- **Deactivate** — `DELETE …/roles/CUSTOMER` or `…/roles/VENDOR`; the opposite role is never affected; 200 with the updated `PartyDto`.

### 7.3 OpenAPI error matrix

Every route documents its success and error responses. Non-members and permission failures use the shared denial (`ROLE_PERMISSION_DENIED`, 403; ⚠ confirm the code the role module returns for outsiders, P0-06). Schema failures are the global 422 `VALIDATION_ERROR`.

| Route | 403 | 404 | 409 | 422 (domain) |
|---|---|---|---|---|
| create | `ROLE_PERMISSION_DENIED` | — | `PARTY_EMAIL_ALREADY_EXISTS` | — |
| list, options | `ROLE_PERMISSION_DENIED` | — | — | — |
| get | `ROLE_PERMISSION_DENIED` | `PARTY_NOT_FOUND`, `PARTY_ROLE_NOT_FOUND` | — | — |
| update | `ROLE_PERMISSION_DENIED` | `PARTY_NOT_FOUND`, `PARTY_ROLE_NOT_FOUND`, `PARTY_CONTACT_NOT_FOUND` | `PARTY_ROLE_INACTIVE`, `PARTY_EMAIL_ALREADY_EXISTS` | `PARTY_SALUTATION_NOT_ALLOWED` |
| addRole | `ROLE_PERMISSION_DENIED` | `PARTY_NOT_FOUND` | `PARTY_ROLE_ALREADY_ACTIVE` | — |
| deactivate | `ROLE_PERMISSION_DENIED` | `PARTY_NOT_FOUND`, `PARTY_ROLE_NOT_FOUND` | `PARTY_ROLE_INACTIVE` | — |

Each route's error map holds exactly the domain codes it can return plus the shared denial. Keep the OpenAPI declarations, the HTTP map and both API locale files in sync.

---

## 8. Web — `apps/web/src/features/party-module/`

One feature serves both Customers and Vendors; the routes pick the role. Follow `apps/web/AGENTS.md`: contracts → generated client → `party-api.ts` → containers → pure views → thin routes.

### 8.1 Layout (adapted)

```
party-module/
├── index.ts                      components + types only (no API hooks)
├── options.ts                    [+A3] sanctioned cross-feature entry: re-exports usePartyOptions only
├── types.ts                      contract types + UI-only types (PartyScope = "active" | "inactive")
├── party-api.ts                  the ONLY file importing "@/api"
├── party-api.test.ts
├── components/                   party-type-badge · party-role-badges · read-only party-emails / party-phones / party-addresses
├── lib/                          party-roles.ts · contact-primary.ts · build-update-payload.ts · use-party-labels.ts (+ tests)
├── forms/                        party-form-types · use-party-form-copy · contact-collection-editor · email/phone/address rows
│                                 party-form (pure) · create-party · update-party · party-button · party-dialog
├── list/                         party-columns · party-list · party-mobile-card
└── details/                      party-details-view (pure) · party-details (container)
```

Every folder has a barrel; siblings import `../lib` and `../components`, not deep files. Do not create unnecessary files or duplicate components. Pure forms and views receive localized copy through props; containers own React Query, abilities, mutations and translations.

### 8.2 Routes

Separate route files render the same feature with a different role. Routes only read params, choose the role, provide navigation callbacks and render. Never edit `routeTree.gen.ts`.

```
apps/web/src/routes/organization/$orgId/
├── customers/   index.tsx · $partyId.tsx
└── vendors/     index.tsx · $partyId.tsx
```

```tsx
<PartyList role="CUSTOMER" orgId={orgId}
  onViewParty={(partyId) => navigate({ to: "/organization/$orgId/customers/$partyId", params: { orgId, partyId } })} />

<PartyDetails role="VENDOR" orgId={orgId} partyId={partyId}
  onBack={() => navigate({ to: "/organization/$orgId/vendors", params: { orgId } })}
  onViewRole={(role) => navigate({
    to: role === "CUSTOMER" ? "/organization/$orgId/customers/$partyId" : "/organization/$orgId/vendors/$partyId",
    params: { orgId, partyId } })} />
```

Features never navigate; they expose `onViewParty`, `onBack`, `onViewRole`, `onSuccess`. No separate Customer or Vendor creation pages: use the create-dialog pattern of neighbouring modules.

### 8.3 `party-api.ts`

The only file that imports `@/api`. It owns the generated-hook integration, query keys, normalization, abilities and invalidation. Use the generated client and `@avuny/contracts` types; never redeclare request or response shapes. Use a module-level stable empty array for default data.

| Export | Behavior |
|---|---|
| `usePartyList(orgId, role, { page, pageSize, scope, search })` | `role` always sent; `isActive: false` only for the Inactive scope; empty search omitted; `keepPreviousData`. Returns `{ parties, total, isLoading }`. |
| `useParty(orgId, partyId, role)` | The role is part of the request context. Returns `{ party, isLoading, error }`. |
| `usePartyOptions(orgId, role)` | `useCursorOptions` with `queryKey: [...getListPartyOptionsQueryKey(orgId), { role }]` (the role is a filter and MUST be in the key), `fetchPage` calling `listPartyOptions`, `enabled: Boolean(orgId)`, empty search omitted. |
| `usePartyAbilities(orgId, role)` | Wraps the exported pure `derivePartyAbilities(snapshot, role)`. |
| `useCreatePartyMutation(orgId)` | `mutateAsync({ orgId, data })`. |
| `useUpdatePartyMutation(orgId)` | `mutateAsync({ orgId, partyId, params: { role }, data })`. |
| `useAddPartyRoleMutation(orgId)` | `mutateAsync({ orgId, partyId, data: { role } })`. |
| `useDeactivatePartyRoleMutation(orgId)` | `mutateAsync({ orgId, partyId, role })`. |

**Abilities.** `derivePartyAbilities` returns `{ canRead, canCreate, canUpdate, canDelete, opposite: { role, canRead, canCreate, canUpdate } }` using `hasPermission` and the established permission-snapshot normalization, from a fixed key map (no runtime string building). In Customer context `opposite` is the original spec's `canReadVendor`, `canCreateVendor`, `canUpdateVendor`; in Vendor context it is the Customer equivalents. UI gating is cosmetic; the server enforces.

**Invalidation (H16).** Shared data appears in both roles, so every mutation invalidates by **prefix**: `getListPartiesQueryKey(orgId)` (all Customer and Vendor lists), `getListPartyOptionsQueryKey(orgId)` (all options) and, for update and role changes, `getGetPartyQueryKey(orgId, partyId)` (both detail contexts: the role sits in the params element, so one prefix covers both). Create invalidates lists and options. Role addition, reactivation and deactivation invalidate lists, options and the detail.

### 8.4 Create and update forms

One pure `PartyForm` supports both. Fields: **Party type** (Person / Organization — chosen once, read-only on update, A4), **Salutation** (optional, visible only for Person; cleared when switching to Organization), **Name** (required), Legal name, Tax number, Website, Notes. Contacts: Emails, Phones, Addresses — multiple entries, optional labels, exactly one primary per non-empty collection.

- **Collection editors.** One generic `ContactCollectionEditor` (field array) with thin `EmailRow`, `PhoneRow`, `AddressRow` field sets. The first entry becomes primary automatically; the user can pick another (one radio per row, accessible name such as "Primary email"). Removing the primary promotes the first remaining entry; adding to an empty collection makes the new entry primary. The rules are pure functions in `lib/contact-primary.ts` (WT-PRIMARY).
- **`contactId` (H9).** react-hook-form's `useFieldArray` reserves `id`. Carry the persisted contact UUID as `contactId` in form state and map to and from `id` in the containers; otherwise retained ids are overwritten and the server answers `PARTY_CONTACT_NOT_FOUND`.
- **Opposite-role checkbox (H8).** On Customers show "Also add as Vendor"; on Vendors "Also add as Customer". Default unchecked; shown **only** when `abilities.opposite.canCreate`. `roles` lives in form state and is validated by `CreatePartySchema` through `zodResolver`; the checkbox is a controlled view over `roles` (`[role]` or `[role, opposite]`). No separate Party-type or role selector exists.
- **Containers.** `CreateParty({ orgId, role, onSuccess })` normalizes `""` to omitted or `null`, strips `contactId` and posts `roles`. `UpdateParty({ orgId, partyId, role, onSuccess })` loads by id, shows a skeleton, and builds the PATCH with the pure `buildPartyUpdatePayload(initial, current)` (H10): only changed scalars (cleared → `null`) and only changed collections (compared by value, ids kept). An empty payload closes the dialog without a request. Submit is disabled while pending.
- **Errors.** Show `parseApiError(e).message` (already localized) in the form alert. Duplicate emails also surface early through the contracts helper `findDuplicateEmailIndexes`; the server stays authoritative (409).
- **Dialog.** `PartyButton` (create with `role`; edit with `partyId` + `role`) and `PartyDialog` (`max-h-[90dvh] overflow-y-auto sm:max-w-2xl`, sr-only title and description, `key={partyId}` to reset state).

### 8.5 List

`PartyList({ orgId, role, onViewParty })`. Tabs **Active / Inactive** (no "All" in v1: `isActive` is a boolean). Search with page reset on every filter change; server-side pagination; the empty-last-page step-back effect; sorting disabled (the server orders by name). Columns: name with type badge, primary email, primary phone, role badges, updated.

Row actions in order: View; Edit (`canUpdate`, role active); **Deactivate** (`canDelete`, role active, destructive); **Reactivate** (`canUpdate`, role inactive — calls the role endpoint). Deactivation uses `ConfirmDialog` with text saying that only this role is affected and that shared data and the opposite role stay; on failure the dialog stays open and shows the server error. Below `md` render `PartyMobileCard`. Empty states per role and scope.

### 8.6 Details view and role actions

`PartyDetails({ orgId, partyId, role, onBack?, onViewRole? })` and the pure `PartyDetailsView`. Show: name, Person/Organization type, salutation (Person), legal name, tax number, website, notes, emails, phones, addresses, role badges with status (an inactive role is labelled in text, not by colour alone), created and updated timestamps formatted with `Intl` in the container.

- A party with both active roles renders "Mark John [Customer] [Vendor]" with links to both views, each subject to that role's read permission.
- **Current role** — active: Edit (`canUpdate`) and Deactivate (`canDelete`); inactive: an inactive notice, Edit disabled, **Reactivate** (`canUpdate`).
- **Opposite role** (state from `lib/party-roles.ts`):

| Opposite role is | Action | Needs | After success |
|---|---|---|---|
| missing | Add as `<Role>` | `create:<opposite>` | invalidate; `onViewRole(opposite)` only if `opposite.canRead`, else stay |
| inactive | Reactivate as `<Role>` | `update:<opposite>` | same |
| active | View as `<Role>` (link) | `read:<opposite>` | `onViewRole(opposite)` |

- Never show a second form for basic or contact information. The feature never navigates: it calls `onViewRole`.
- **Rendering safety (H11).** Link the website only if it parses as `http` or `https` (`rel="noopener noreferrer"`); render notes as plain text with `whitespace-pre-wrap`.

### 8.7 Shared editing

Common information is stored once. Editing display name, legal name, salutation, tax number, website, notes, emails, phones or addresses from the Customer view updates the Vendor view immediately, and the reverse. The context role decides the **permission**: a user who may update the current role may update the shared data through that view, and that change is intentionally reflected in the opposite role. There are no independent Customer or Vendor profile fields in v1; future role-specific settings live in their own tables.

### 8.8 Separation, accessibility, RTL and mobile

- Rules from `apps/web/AGENTS.md`: `party-api.ts` is the only `@/api` importer; pure views take copy by props; the root exports components and types only (plus the `options.ts` entry, A3); no deep imports into another feature; semantic Tailwind tokens only; no hard-coded text; strings in en and ar.
- Accessibility: every control is reachable by an accessible name (labels and roles — the e2e tests rely on it, no test ids); collection editors use `fieldset` + `legend`, per-row labels with the row index, remove buttons with `aria-label`; focus moves to the new row after "Add" and to the "Add" button after the last removal; skeletons use `aria-busy`; errors use `role="alert"`; dialogs always have a title and description.
- RTL (H17): logical utilities only (`ps-` `pe-` `ms-` `me-` `text-start`); emails, phone numbers, URLs and tax numbers render with `dir="ltr"` (or inside `<bdi>`) and stay start-aligned; directional icons get `rtl:rotate-180`.
- Mobile: tables below `md` become cards; dialogs scroll (`max-h-[90dvh]`); the primary action stays reachable.

---

## 9. Integration with other modules

### 9.1 Domain port and pickers

Other backend modules reach Party only through `party/index.ts`. Before creating a sales document validate an active `CUSTOMER` role; before a purchasing document an active `VENDOR` role:

```ts
const check = await assertActiveRole(orgId, input.customerPartyId, "CUSTOMER", tx)   // inside the caller's transaction
if (!check.success) return stop(check.error, "…")                                    // ⚠ match the real Result shape
```

Pass the use case's transaction so the validation participates in it; the share lock on the role row stops a concurrent deactivation from interleaving. Calling modules MUST add the `PARTY_*` codes they can surface to their own HTTP error map, OpenAPI declarations and locales.

Transactional forms use the options endpoint through the existing async-combobox architecture (`OptionListQuerySchema`, `decodeCursor`, `toCursorPage`, `useCursorOptions`, `AsyncComboboxField`): `usePartyOptions(orgId, "CUSTOMER")` for a Sales Invoice customer field, `"VENDOR"` for a Purchase Order vendor field, imported through the sanctioned `@/features/party-module/options` entry (A3). Pass `initialOption` on edit forms. Inactive roles never appear. Do not build a separate Party picker or a static list. Invalidation of the options prefix is already done by `party-api.ts`.

### 9.2 Existing modules and migration boundaries

Planned references — each a tenant-safe composite FK to `parties (org_id, id)`, `onDelete: restrict`, indexed:

| Document | Field | Required role |
|---|---|---|
| Sales Order, Sales Invoice, Customer Receipt | `customerPartyId` | CUSTOMER |
| Purchase Order, Purchase Bill, Vendor Payment | `vendorPartyId` | VENDOR |

Before touching any existing sales, purchase, receipt or payment schema: inspect the current references (P0-07), identify separate customer/vendor identity tables, foreign keys and existing data, and decide whether a safe backfill is needed. **Never blindly rename or drop** existing references. If separate identities already exist, produce a migration and backfill plan (a document in the repo, not an executed change) before replacing them. Keep unrelated refactoring out.

### 9.3 Document snapshots

Issued historical documents MUST keep the party information they were issued with: display name, selected email, selected phone where required, selected billing or shipping address. Later edits to the shared Party record never change them. Use the document module's established snapshot convention; do not build accounting functionality here.

### 9.4 Checklist for every future document module [+]

1. Schema: `customerPartyId` / `vendorPartyId` NOT NULL, composite FK `(org_id, <x>_party_id)` → `parties (org_id, id)`, `onDelete: restrict`, indexed; snapshot columns for the party data the document needs.
2. Service: `assertActiveRole(orgId, partyId, role, tx)` inside the create transaction and whenever the party reference changes (and at issue/posting if the module decides so); map `PARTY_*` codes into the module's error map, OpenAPI and locales.
3. Web: `AsyncComboboxField` + `usePartyOptions` + `initialOption` on edit; no static lists.
4. Permissions: decide how pickers are authorized for users who can create the document but lack `read:<role>` (A7).
5. Tests: a vendor-only party on a sales document → `PARTY_ROLE_NOT_FOUND`; an inactive role → `PARTY_ROLE_INACTIVE`; another organization's party → `PARTY_NOT_FOUND`; snapshot unchanged after a party edit.

---

## 10. Localization

Two responsibilities, both English and Arabic with **identical key sets**, no concatenated fragments (Arabic is RTL: every string is complete), placeholders matching in both files.

### 10.1 Contracts — `packages/contracts/src/party/locales/`

Namespace `party`, registered wherever `roleTranslationsEn` / `roleTranslationsAr` are registered (grep; API and web). Fixed section order: `errors` (keys = error codes), `labels`, `msgs`, then UI copy. UI copy is complete here because pure components receive all text through props (A8: copy the placement the role module uses). Role-specific strings are keyed by role token (`CUSTOMER`, `VENDOR`) and never concatenated.

```jsonc
{
  "errors":   { "PARTY_NOT_FOUND": "…", "PARTY_ROLE_NOT_FOUND": "…", "PARTY_ROLE_ALREADY_ACTIVE": "…", "PARTY_ROLE_INACTIVE": "…",
                "PARTY_CONTACT_NOT_FOUND": "…", "PARTY_EMAIL_ALREADY_EXISTS": "…", "PARTY_SALUTATION_NOT_ALLOWED": "…" },
  "labels":   { "roles": { "CUSTOMER": "Customer", "VENDOR": "Vendor" }, "types": { "PERSON": "Person", "ORGANIZATION": "Organization" },
                "salutations": { "MR": "…", "MS": "…", "MRS": "…", "DR": "…", "PROF": "…", "OTHER": "…" },
                "status": { "active": "Active", "inactive": "Inactive" } },
  "msgs":     { "PARTY_CREATED": "…", "PARTY_UPDATED": "…", "PARTY_ROLE_ADDED": "…", "PARTY_ROLE_REACTIVATED": "…", "PARTY_ROLE_DEACTIVATED": "…" },
  "list":     { "CUSTOMER": { "title": "Customers", "description": "…" }, "VENDOR": { "title": "Vendors", "description": "…" },
                "tabs": { "aria": "…", "active": "…", "inactive": "…" }, "search": { "placeholder": "…", "clear": "…" } },
  "create":   { "CUSTOMER": { "title": "…", "description": "…" }, "VENDOR": { "title": "…", "description": "…" },
                "alsoAdd": { "CUSTOMER": "Also add as Customer", "VENDOR": "Also add as Vendor" }, "submitLabel": "…", "submittingLabel": "…" },
  "update":   { "title": "…", "description": "…", "submitLabel": "…", "submittingLabel": "…" },
  "fields":   { "partyType": { "label": "…" }, "salutation": { "label": "…", "placeholder": "…" }, "displayName": { "label": "…", "placeholder": "…" },
                "legalName": {}, "taxNumber": {}, "website": {}, "notes": {}, "email": {}, "phone": {}, "label": {},
                "addressLine1": {}, "addressLine2": {}, "city": {}, "state": {}, "postalCode": {}, "countryCode": {} },
  "contacts": { "emails": { "title": "…", "add": "…", "remove": "…", "primary": "…" }, "phones": {}, "addresses": {} },
  "actions":  { "create": { "CUSTOMER": "New customer", "VENDOR": "New vendor" }, "edit": "…", "view": "…", "deactivate": "…", "reactivate": "…", "cancel": "…",
                "addAsRole": { "CUSTOMER": "…", "VENDOR": "…" }, "reactivateAsRole": { "CUSTOMER": "…", "VENDOR": "…" },
                "viewAsRole": { "CUSTOMER": "…", "VENDOR": "…" } },
  "table":    { "name": "…", "email": "…", "phone": "…", "roles": "…", "updated": "…", "actions": "…", "actionsFor": "…" },
  "empty":    { "CUSTOMER": { "title": "…", "description": "…" }, "VENDOR": { "title": "…", "description": "…" }, "inactive": { "title": "…", "description": "…" } },
  "delete":   { "CUSTOMER": { "title": "…", "description": "…" }, "VENDOR": { "title": "…", "description": "…" } },
  "details":  { "back": { "CUSTOMER": "…", "VENDOR": "…" }, "createdAt": "…", "updatedAt": "…", "inactiveNotice": { "CUSTOMER": "…", "VENDOR": "…" } },
  "pagination": { "nav": "…", "previous": "…", "next": "…", "rowsPerPage": "…", "summary": "…", "pageOf": "…", "goTo": "…" }
}
```

The deactivation text must say that only this role ends and that shared details and the other role are unaffected. Do not duplicate combobox strings that already exist in the common namespace. Have the Arabic reviewed by a native speaker and reuse the product nouns already used in the existing `ar.json` files. Add `labels.resources.customer` / `vendor` to the **role** locale files (§5.4).

### 10.2 API errors

`apps/server/src/api/intl/locales/party/{en,ar}.json`: the same error keys with complete messages, registered in the existing API translation setup. Both files change together.

### 10.3 Web

Follow the existing web namespace loading and locale composition (⚠ P0-04). Use the `party` namespace for all shared Party form and details copy. Test RTL layout (§11.9).

---

## 11. Testing

### 11.1 Principles

Each layer has its own proof: contracts (pure), database (SQL), rules (pure), service (fakes), routes (real app + real database), web (pure functions + API normalizers), end-to-end (real browser + real API + real database).

- Services have **unit tests**; routes have **real integration tests**; the web has **Playwright e2e** — each in the style of the existing `organization.routes.int.test.ts` and the organization/auth e2e specs.
- Route integration tests run the real app (`app.request`) against the dedicated test database. **No** `vi.mock` of services, repositories, permission checks, the database or the clock. Every test builds its own tenant through the public API with the `test-support` factories, so tests never share rows and run in parallel. Tests never delete or truncate rows.
- Assert status, `success`, the error code (from the `*ErrorCode` constants) and DTO fields — never message text.
- No test is deleted, skipped or weakened to make a gate pass. A bug fix starts with a failing regression test.
- A repository that lets a known unique or FK violation escape as a 500 is a bug; the integration test for that code stays red until the constraint is mapped.

### 11.2 Contracts tests (`CT-*`)

- **CT-ENUM** — `PARTY_TYPES`, `PARTY_SALUTATIONS`, `PARTY_ROLES` values and order (append-only guard); `PARTY_OPPOSITE_ROLE`; `PartyErrorCode` keys equal values and include every required code.
- **CT-CREATE** — minimal valid payload (one role, PERSON, display name; contact arrays default to `[]`); blank, over-length and untrimmed display name; roles empty / unknown / duplicate rejected, both roles valid; salutation PERSON ok, ORGANIZATION with a value rejected, ORGANIZATION with `null` or omitted ok; website `http` / `https` ok, `javascript:` and scheme-less rejected; limits for legal name, tax number, notes.
- **CT-CONTACT** — emails (invalid format, over-length, label over-length); phones (allowed characters, minimum digits, over-length); addresses (line 1 required, country code upper-cased then pattern: `eg` → `EG`, `EGY` rejected, optional fields over-length); the primary rule for each collection (0 primaries and 2 primaries rejected, exactly 1 valid, `[]` valid); more than `PARTY_CONTACTS_MAX_COUNT` rejected.
- **CT-UPDATE** — `{}` rejected; each single field alone accepted; `null` clears nullable fields and is rejected for `displayName` and the collections; `""` rejected; `partyType` / `roles` never reach the parsed output (or are rejected, per repository convention); collection semantics (omitted stays `undefined`, `[]` preserved, non-empty validated); entry `id` must be a UUID; duplicate ids rejected; entries without `id` accepted; a non-empty collection needs exactly one primary.
- **CT-QUERY** — list query: `role` required, page and pageSize coercion, defaults and max, `isActive` `"true"` / `"false"` / invalid / omitted, empty `search` → `undefined`; option query: role required, limit default and max, optional cursor; `PartyOptionCursorSchema`; `AddPartyRoleSchema` and `PartyRoleParamSchema` reject unknown roles and non-UUID ids.
- **CT-DTO** — a full `PartyDto`, a `PartyListItemDto` and an option response parse; ISO timestamps required; no `orgId` in any DTO schema.
- **CT-HELPERS** — `emailKey`, `findDuplicateEmailIndexes` (case, whitespace, order), `countPrimaries` / `hasExactlyOnePrimary`, `findDuplicateIds`.
- **CT-LOCALE** — en and ar have identical key sets (recursive); every `PartyErrorCode` has `errors.<CODE>` in both; placeholders identical; role locales contain `labels.resources.customer` and `vendor`; no empty strings.

### 11.3 Database verification (`DB-01` … `DB-10`)

| ID | Check |
|---|---|
| DB-01 | The generated migration applies to an empty database and contains only Party objects (any enum-value migration is separate). |
| DB-02 | Tenant-safe FKs: a role, email, phone or address whose `(org_id, party_id)` does not match an existing party fails (`23503`), including a party that exists in another organization. |
| DB-03 | `(org_id, party_id, role)` is unique (`23505`). |
| DB-04 | Email uniqueness is case-insensitive per party (`A@x.com` vs `a@x.com` fails); the same email on another party succeeds. |
| DB-05 | A second primary row for one party fails (`23505`) in each of the three contact tables; unlimited non-primary rows succeed. |
| DB-06 | `ck_party_salutation_person_only` rejects (ORGANIZATION, `MR`). |
| DB-07 | Length and format checks reject over-length values, empty strings and a lower-case or three-letter country code. |
| DB-08 | Deleting a party cascades to its role and contact rows (explicit `onDelete`). |
| DB-09 | Every named constraint and index of §4 exists (`pg_indexes`, `pg_constraint`); every name ≤ 63 bytes; the `party_roles` index covers `(org_id, role, is_active, party_id)`. |
| DB-10 | The three Postgres enums contain exactly the contracts values, in order. |

Automate these in `packages/db` when it already has a database-backed vitest setup (⚠ P0-06); otherwise run them as an SQL session against the migrated empty database and record the output in `PROGRESS.md`.

### 11.4 Rules tests (`RU-*`, `party.rules.spec.ts`, pure — no fakes)

- **RU-STATE** — `roleState` for a null aggregate, a missing role, active and inactive; `assertReadable` allows inactive; `assertActive` maps each state to the right code.
- **RU-ADDROLE** — missing → insert (needs create); inactive → reactivate (needs update); active → `PARTY_ROLE_ALREADY_ACTIVE`; party missing → `PARTY_NOT_FOUND`.
- **RU-SALUTATION** — PERSON with any value ok; ORGANIZATION with `null` / `undefined` ok; ORGANIZATION with a value → `PARTY_SALUTATION_NOT_ALLOWED`.
- **RU-PLAN** — retained / omitted / new classification; `[]` deletes everything; an unchanged submission yields updates only; an unknown or foreign id → `PARTY_CONTACT_NOT_FOUND` and no plan; primary moved from A to B (`demoteIds` = [A], B final primary); omitted primary with another promoted; email **swap** and **chain** put the changed rows in `parkIds`; remove-and-re-add of the same email → delete + insert, no park; retained ids preserved in `updates`; email keys compare case-insensitively.
- **RU-FIELDS** — `hasDuplicateEmail` (case, whitespace); `changedFields` lists only the supplied keys.

### 11.5 Service unit tests (`ST-*`, `party.service.spec.ts`)

`testing.ts` provides stable ids, aggregate fixtures, a fake repository (its `transaction` runs the callback on a fake `tx`), fake permissions and a fake activity log; the real pure `partyRules` is used. Never import `deps.ts`.

- **ST-AUTH** — authorization matrix for the six methods and `addRole`: permission denied → `ROLE_PERMISSION_DENIED`, repository (`transaction`, `list`, `listOptions`, `findAggregate`) and activity log not called; the right key per role (`create:customer` vs `create:vendor`); `orgId` passed in every check; `create` with both roles and only one permission → forbidden, nothing written; `addRole` with neither create nor update → forbidden before any repository call; `assertActiveRole` never calls permissions.
- **ST-CREATE** — Customer; Vendor; both roles in one request (two role rows, two audit events); duplicate emails → `PARTY_EMAIL_ALREADY_EXISTS` before the transaction opens; contacts written inside the same transaction callback; DTO has the primary first; no audit when the transaction rejects; audit runs after the transaction resolved.
- **ST-UPDATE** — Customer-context and Vendor-context updates hit the same party id; scalar patch; collection omitted / `[]` / non-empty (executors called only for supplied collections); retained ids preserved; foreign id → `PARTY_CONTACT_NOT_FOUND` with no write; primary promotion plan; inactive role → `PARTY_ROLE_INACTIVE`; missing role → `PARTY_ROLE_NOT_FOUND`; missing party → `PARTY_NOT_FOUND`; salutation on ORGANIZATION → `PARTY_SALUTATION_NOT_ALLOWED`; aggregate lock requested; `updateShared` always called; audit `[role].UPDATED` with field names only.
- **ST-ROLE** — `addRole`: missing role (create permission) → insert; inactive (update permission) → reactivate; active → `PARTY_ROLE_ALREADY_ACTIVE`; update-only user adding a missing role → forbidden, no write; create-only user reactivating → forbidden, no write; party missing → `PARTY_NOT_FOUND`. Deactivate Customer leaves Vendor untouched and vice versa; deactivate twice → `PARTY_ROLE_INACTIVE`; deactivate a missing role → `PARTY_ROLE_NOT_FOUND`; no repository method deletes a party, role or contact; audit `created` / `reactivated` / `deactivated`.
- **ST-READ** — `get` returns both role assignments and serves inactive roles; missing party / role errors; `list` passes role, default `isActive: true`, `isActive: false`, search and pagination, returns total and the list-item mapping; `listOptions`: role-based permission, cursor decoded and encoded from `sortKey`, `limit + 1` handling, only `{ id, name }` returned, repository called with the active-only filter.
- **ST-PORT** — `assertActiveRole`: ok, `PARTY_NOT_FOUND`, `PARTY_ROLE_NOT_FOUND`, `PARTY_ROLE_INACTIVE`; passes `tx` through and requests the share lock only when a `tx` is given; calls neither permissions nor the activity log.
- **ST-AUDIT** — events come from `PARTY_AUDIT_EVENTS`; recorded only after commit; none on any failed or forbidden path; metadata holds ids, role names and field names only (assert that no email, phone, name or note text appears).

### 11.6 Route integration tests (`RT-*`, `party.routes.int.test.ts`)

Exactly one file; follow `.agents/skills/api-integration-tests/SKILL.md` and `docs/TESTING.md`; structure mirrors `organization.routes.int.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest"
import type { PartyDto } from "@avuny/contracts/party"
import { createOrganization, createTestApp, createUser, expectFailure, expectOk, type TestApp } from "../../test-support/index.js"

describe("party routes (integration)", () => {
  let t: TestApp
  beforeAll(async () => { t = await createTestApp() })
  const parties = (orgId: string) => `/organizations/${orgId}/parties`

  describe("dual-role lifecycle", () => {
    it("creates a vendor-and-customer, edits it from the vendor view and reads it from the customer view", async () => {
      const owner = await createUser(t.app)
      const org = await createOrganization(owner, { defaultCurrency: "EGP", timezone: "Africa/Cairo" })
      const created = expectOk(await owner.api.post<PartyDto>(parties(org.id), {
        json: { roles: ["VENDOR", "CUSTOMER"], partyType: "PERSON", displayName: "Mark John",
                emails: [{ email: "mark@example.com", isPrimary: true }] } }), 201)

      expectOk(await owner.api.patch<PartyDto>(`${parties(org.id)}/${created.id}?role=VENDOR`,
        { json: { displayName: "Mark J. John" } }), 200)
      const asCustomer = expectOk(await owner.api.get<PartyDto>(`${parties(org.id)}/${created.id}?role=CUSTOMER`), 200)
      expect(asCustomer.displayName).toBe("Mark J. John")
      expect(asCustomer.roles.map((r) => r.role).sort()).toEqual(["CUSTOMER", "VENDOR"])
    })
  })
  // one describe per group below
})
```

- **RT-AUTH** — each of the seven routes without a bearer token → 401 (table-driven; random uuids in paths).
- **RT-PERM** — members with exact permission sets (helper ⚠ P0-06; custom roles may be plan-gated). Only `read:customer`: customer list / get / options 200, vendor list 403, create / patch / deactivate 403. Only `create:customer`: create `["CUSTOMER"]` 201, `["CUSTOMER","VENDOR"]` 403 **and no party persisted** (owner lists nothing). `addRole` of a missing role needs create (update-only 403, create 200); reactivation needs update (create-only 403, update 200); deactivate needs delete (update-only 403). A member with `update:vendor` edits shared data through the vendor view and the owner sees it in the customer view. Options need `read:<role>`.
- **RT-LIFE** — owner lifecycle of a customer: create → get → list (default active) → options → update → deactivate → get (inactive still readable) → default list excludes it → `isActive=false` list includes it; DTO fields exact (no `orgId`), ISO timestamps.
- **RT-DUAL** — dual-role create returns both roles active; the identical payload posted twice creates two parties (no merge); both appear in the Customer and Vendor lists and options; a vendor-only party is absent from the customer list and options.
- **RT-SHARED** — update through the Customer context, read through the Vendor context (identical shared data), and the reverse; contact edits visible from both; `roles` and `partyType` in a PATCH body never change stored values.
- **RT-ROLE** — `addRole` on a missing role → both active, same party id; on an active role → 409 `PARTY_ROLE_ALREADY_ACTIVE`; deactivate Customer leaves Vendor active and every contact intact; deactivate twice → 409 `PARTY_ROLE_INACTIVE`; update an inactive role → 409 `PARTY_ROLE_INACTIVE`; get / update / deactivate with a role the party lacks → 404 `PARTY_ROLE_NOT_FOUND`; reactivation through `addRole` keeps the party id and every contact id; unknown party → 404 `PARTY_NOT_FOUND` on get, patch, addRole and deactivate.
- **RT-CONTACT** — omitted collection unchanged; `[]` clears; non-empty replaces; retained ids stable across the update; new entries receive ids; removed entries disappear; **moving the primary** works; **swapping two emails' values** works; **removing an email and re-adding it without an id** works; a contact id of another party in the same organization → 404 `PARTY_CONTACT_NOT_FOUND` and nothing changed (atomic, including scalar changes in the same request); a contact id from another organization → the same 404; 11 entries → 422.
- **RT-LIST** — pagination (`page`, `pageSize`, `total`); search by display name, legal name, tax number, email and phone; role filter; `isActive` filter; list items carry primary email / phone and both role summaries; stable order (name case-insensitive, then id).
- **RT-OPTION** — items are exactly `{ id, name }`; `limit` + `cursor` across at least three pages with no duplicates or gaps; case-insensitive ordering (`alice`, `Bob`, `carol`); search across the five fields; inactive roles excluded; role filter; a stale or invalid cursor restarts at page one (200).
- **RT-TENANT** — an outsider gets the shared denial on **every** route (status and code as the role module's integration tests assert); a user in two organizations cannot reach org A's party through org B's path: get, patch, addRole, deactivate → 404 `PARTY_NOT_FOUND`; org A's contact id in a patch under org B → 404; lists and options never include another organization's parties, even with identical names.
- **RT-CONFLICT** — duplicate emails differing only by case in one create or patch → 409 `PARTY_EMAIL_ALREADY_EXISTS` and nothing persisted; the same email on two different parties is accepted (no merge); salutation patch on an ORGANIZATION party → 422 `PARTY_SALUTATION_NOT_ALLOWED`; a failed patch changes nothing.
- **RT-VALID** — 422 `VALIDATION_ERROR` with field details for: missing, empty, duplicate or unknown `roles`; missing display name; ORGANIZATION with salutation; two primaries; no primary in a non-empty collection; invalid email; address without line 1; invalid country code; `javascript:` website; duplicate contact ids in a patch; empty patch `{}`; missing or invalid `role` query; non-UUID path ids; invalid `isActive`.

Trigger every domain error that is reachable over HTTP. If the activity-log module exposes a read route, also assert that the expected `customer.*` / `vendor.*` events were recorded for one lifecycle. Run with `pnpm --filter @avuny/books-server test:int`.

### 11.7 Web unit tests (`WT-*`)

Vitest beside the source. Do not test hooks that only forward to `@/api`; test the normalizers and pure functions they call.

- **WT-ROLES** — `lib/party-roles.ts`: role state (missing / inactive / active) from a DTO; opposite role; which action applies.
- **WT-PRIMARY** — `lib/contact-primary.ts`: the first entry becomes primary; setting a primary demotes the others; removing the primary promotes the first remaining; removing the last yields `[]`; never zero or two primaries after any sequence.
- **WT-PAYLOAD** — `buildPartyUpdatePayload`: unchanged → `{}`; only the changed scalar; cleared scalar → `null`; only the changed collection; retained ids kept (`contactId` → `id`); new rows without id; `""` never sent.
- **WT-API** — normalizers; `derivePartyAbilities` for owner, plain allow, deny beating allow, single-permission snapshots in Customer and Vendor context (including `opposite`); the role is part of the list, detail and options request context and of the options query key; invalidation prefixes.
- **WT-FORM** — DTO → form values → payload round trip; the opposite-role checkbox maps to `roles` and is hidden without `opposite.canCreate`; salutation cleared when switching to Organization.
- **WT-LOCALE** — en / ar parity for the `party` namespace (and the role-locale labels); placeholders match.

### 11.8 Web end-to-end tests (`E2E-01` … `E2E-08`)

Playwright, real browser + real API + real database. Mirror the organization and auth specs: `import { expect, test } from "../fixtures.ts"`, `support/api.ts`, `support/copy.ts`; place the spec beside the existing organization e2e spec (⚠ P0-06).

- Select by accessible names from `copy("party")` (labels and roles); no test ids and no hard-coded strings.
- Unique data per test (`uniqueId()`); never delete or truncate.
- Verify a UI side effect through the API so the test does not depend on where the app navigates afterwards — except when navigation **is** the behavior (E2E-04).
- Extend `support/api.ts` (names illustrative): `createOrganizationViaApi`, `createPartyViaApi`, `listPartiesViaApi`, `getPartyViaApi` and, if the public API allows it, `createMemberWithPermissionsViaApi`.

```ts
import { expect, test } from "../fixtures.ts"
import { createOrganizationViaApi, listPartiesViaApi, uniqueId } from "../support/api.ts"
import { copy } from "../support/copy.ts"

const t = copy("party")

test.describe("customers and vendors (real browser, real API, real database)", () => {
  test("a signed-in user creates a customer who is also a vendor", async ({ signedInPage: page, account, request }) => {
    const name = `E2E Party ${uniqueId()}`
    const org = await createOrganizationViaApi(request, account)

    await page.goto(`/organization/${org.id}/customers`)
    await page.getByRole("button", { name: t("actions.create.CUSTOMER") }).click()
    await page.getByLabel(t("fields.displayName.label")).fill(name)
    await page.getByLabel(t("create.alsoAdd.VENDOR")).check()
    await page.getByRole("dialog").getByRole("button", { name: t("create.submitLabel") }).click()

    await expect.poll(async () =>
      (await listPartiesViaApi(request, account, org.id, "VENDOR")).map((p) => p.displayName)
    ).toContain(name)
  })
})
```

| ID | Scenario |
|---|---|
| E2E-01 | Create a customer from Customers with an email, a phone and an address → verified through the API (CUSTOMER active, one primary per collection). |
| E2E-02 | Create from Vendors with "Also add as Customer" → both roles active via the API; the party appears on both pages. |
| E2E-03 | Edit the name and an email from the Vendor details page → the Customer details page (after reload) and the API show the same data. |
| E2E-04 | From the Customer details of a customer-only party press "Add as Vendor" → the URL becomes the Vendor route with the same party id; both badges are visible. |
| E2E-05 | Deactivate the Customer role → gone from the Active tab, present in the Inactive tab, Vendor role untouched; Reactivate restores it. |
| E2E-06 | Contact editor: add two emails, move the primary, remove the primary → the first remaining becomes primary; the saved party has exactly one primary email. |
| E2E-07 | Permission gating: a member with only `read:customer` sees no create, edit or deactivate control and no "Also add" checkbox (needs the limited-member helper; otherwise mark not applicable with the reason). |
| E2E-08 | Arabic and mobile smoke: switch to `ar` → `html[dir=rtl]` and localized labels; at 390 px width the list renders cards and the create dialog scrolls (if the fixtures support locale switching). |

### 11.9 Manual checks

Record results in `PROGRESS.md`: mobile layout (list as cards, dialog scroll, collection editors usable); Arabic RTL (layout mirrors, emails / phones / URLs stay LTR, directional icons flipped); keyboard-only create, edit and deactivate; screen-reader names for collection rows; Customer and Vendor pages for the same party; inactive-role behavior; async pickers (only once a consuming form exists).

---

## 12. Implementation plan

### 12.0 Working agreement

- Phases are sequential; each ends with a **gate**. A gate is green only when every item is verified with evidence recorded in `PROGRESS.md`.
- One commit per task or coherent task group (`feat(party): P4-05 service methods`). Never mix a generated migration with unrelated changes.
- **Stop and ask** when: an AGENTS.md rule conflicts with a step; an existing migration or table would have to change destructively; a step cannot be satisfied as written; a test would have to be weakened.
- Use the scripts in each package's `package.json` (typecheck, lint, test, build). Record the exact commands in `PROGRESS.md` during P0-08. Known: `drizzle-kit generate`, `pnpm --filter @avuny/books-server test:int`.

### 12.1 Phase 0 — Discovery and decisions (no production code)

| ID | Task | Done when |
|---|---|---|
| P0-01 | Read all rules: the four AGENTS.md files, `docs/TESTING.md`, `.agents/skills/api-integration-tests/SKILL.md`, e2e docs. | Reading list ticked. |
| P0-02 | Study the references: contracts `src/role/`; db `access-control/role.ts`, `inventory/item.ts`; server `modules/role` (service, repository, routes, `testing.ts`, tests); web `role-module`; generated client usage. | Notes in the findings table. |
| P0-03 | db and server conventions: `_helpers.ts` (`pk`, `orgRef`, `timestamps` — does it maintain `updated_at`? — `lengthBetween`, `matchesRegex`), constraint-inspection helper, the **transaction rollback mechanism**, `Tx` / `DB` types. | Findings recorded. |
| P0-04 | contracts conventions: boolean query parsing, unknown-key policy, option / cursor contracts (`OptionListQuerySchema`, `decodeCursor`, `toCursorPage`), locale placeholder syntax and UI-copy location, namespace registration points (API + web), phone / email / country utilities, locale-parity test. | Findings recorded. |
| P0-05 | registry and permissions: `registry.ts` (`ActionSpec`, `CRUD`, `SIDEBAR_GROUPS`, icon type, `scopable`), seed behavior, enum vs text for `permission_resource` / `permission_action` (A2), `SYSTEM_ROLES` shape (A11), activity-log typing and event-label location, plan gating of custom roles. | Findings recorded. |
| P0-06 | test infrastructure: `test-support` factories (can a member with an exact permission set be created through the public API?), the outsider response code, db-package test harness, e2e `fixtures.ts` + `support/*`, commands per suite. | Findings recorded. |
| P0-07 | Search db / contracts / server / web for customer, vendor or supplier tables and for sales / purchase document modules; list their references and data. | Phase 7 scope decided. |
| P0-08 | Baseline: run typecheck, lint, unit, integration (and e2e if feasible) per package; fill the commands table. | Pre-existing failures recorded. |
| P0-09 | Confirm or change A1–A12 and the proposed defaults of §3.2. | Decisions logged. |

**G0** — findings table and commands table filled; baseline recorded; A1–A12 logged; no source file changed.

### 12.2 Phase 1 — Contracts (`packages/contracts`)

| ID | Task | Done when |
|---|---|---|
| P1-01 | Scaffold `src/party/`, the `package.json` export and the root index line. | Empty barrels build. |
| P1-02 | `constants.ts`: enums, limits with constraint-name comments, `PARTY_OPPOSITE_ROLE`. | Confirmed limits in place. |
| P1-03 | `contacts.ts` helpers (§3.3). | CT-HELPERS written. |
| P1-04 | `errors.ts`: the seven codes (§3.4). | CT-ENUM written. |
| P1-05 | `schemas.ts`: entries, create, update with the replacement comment, role / query / option / cursor schemas, DTOs, list response. | CT-CREATE, CT-CONTACT, CT-UPDATE, CT-QUERY, CT-DTO written. |
| P1-06 | Locales `en.json`, `ar.json`, `index.ts`, namespace registration in API and web. | CT-LOCALE written. |
| P1-07 | Complete and run every CT group; build; verify the subpath import. | All CT groups pass. |

**G1** — contracts typecheck, lint, vitest and build pass; `@avuny/contracts/party` resolves from db and server; en / ar key and placeholder parity.

### 12.3 Phase 2 — Database (`packages/db`)

| ID | Task | Done when |
|---|---|---|
| P2-01 | `parties.ts`: three enums and five tables with comment blocks, named constraints, indexes, row types (§4). | Compiles; every §4.2 constraint present. |
| P2-02 | `relations.ts`. | All relations in this file only. |
| P2-03 | `index.ts` and the root re-export. | Imports work from `@avuny/db`. |
| P2-04 | `drizzle-kit generate`; read the SQL; apply to an empty local database. | SQL contains only Party objects; applies cleanly. |
| P2-05 | Verify DB-01 … DB-10; typecheck, lint, tests. | Evidence recorded. |

**G2** — db typecheck, lint and tests pass; the migration was read and applied to an empty database; DB-01 … DB-10 verified; nothing changed outside `packages/db` and the needed contracts constants.

### 12.4 Phase 3 — Registry and permissions (`packages/contracts`)

| ID | Task | Done when |
|---|---|---|
| P3-01 | Registry entries `customer` and `vendor` with CRUD, `delete` → `deactivated`, `reactivate`; add `PARTY_AUDIT_EVENTS` (§5.1). | Compiles. |
| P3-02 | Sidebar entries, existing group (or one new group), icon, en + ar labels. | Both entries derive. |
| P3-03 | Role locale labels for the two resources (and event / action labels as needed). | CT-LOCALE green. |
| P3-04 | Built-in role grants (A11). | Decision applied and logged. |
| P3-05 | Rebuild contracts; verify the derived types. | `PermissionKey` and `ActivityLogAction` accept all 16 values. |
| P3-06 | Seed synchronization verified; separate enum migration if A2 requires it. | Seed idempotent; migration read and applied. |

**G3** — registry, permissions, events, seeds and role locales are consistent; the enum migration (if any) is separate from the Party schema migration.

### 12.5 Phase 4 — Backend (`apps/server`)

| ID | Task | Done when |
|---|---|---|
| P4-01 | `party.repository.ts` (§6.2): aggregate load and lock, insert, shared update, plan executors, list, options, search, role operations, role-state read. | Compiles; every query org-scoped. |
| P4-02 | `party.rules.ts` and `party.rules.spec.ts`. | RU-* pass. |
| P4-03 | `party.mapper.ts`. | Pure; ordering enforced. |
| P4-04 | `party.permissions.ts`, `party.errors.ts` (exhaustive map), `party.types.ts`. | Maps typecheck exhaustively. |
| P4-05 | Service: `create`, `update`, `delete`, `list`, `listOptions`, `get`. | Compiles. |
| P4-06 | Service: `addRole`, `assertActiveRole`. | Compiles. |
| P4-07 | `deps.ts`, `index.ts` (public service, routes, port). | Exports match §6.5. |
| P4-08 | Seven Hono routes, `hono-routes/index.ts`, mounted in the API composition. | OpenAPI lists all seven operations. |
| P4-09 | API intl locales en / ar and registration. | Parity verified. |
| P4-10 | `testing.ts` and `party.service.spec.ts`. | ST-* pass. |
| P4-11 | `party.routes.int.test.ts` (and a `test-support` helper if P0-06 required one). | RT-* pass. |

**G4** — server typecheck and lint; RU, ST and RT suites pass (`test:int`); every reachable `PartyErrorCode` is triggered over HTTP; the router is mounted.

### 12.6 Phase 5 — API client generation

| ID | Task | Done when |
|---|---|---|
| P5-01 | Run the existing Orval command. | Client regenerated. |
| P5-02 | Verify the seven operations, hooks and query-key getters (§7.1). | Names match. |
| P5-03 | Verify no hand-written request / response types in the web. | Review done. |

**G5** — the generated client works and the web can import its operations.

### 12.7 Phase 6 — Web (`apps/web`)

| ID | Task | Done when |
|---|---|---|
| P6-01 | Scaffold `party-module` with `types.ts` and barrels. | Builds. |
| P6-02 | `lib/` (`party-roles`, `contact-primary`, `build-update-payload`, `use-party-labels`) with tests. | WT-ROLES, WT-PRIMARY, WT-PAYLOAD pass. |
| P6-03 | `party-api.ts` and `party-api.test.ts` (§8.3). | WT-API passes. |
| P6-04 | `components/`: badges and read-only contact blocks. | Pure, props-only. |
| P6-05 | Collection editors, pure `PartyForm`, copy hook (§8.4). | WT-FORM passes. |
| P6-06 | `create-party`, `update-party`, `party-button`, `party-dialog`. | Create and edit work in a dialog. |
| P6-07 | List: columns, mobile card, container (§8.5). | Tabs, search, paging, deactivate / reactivate work. |
| P6-08 | Details view and container with role actions (§8.6). | Opposite-role matrix works. |
| P6-09 | Four route files, `options.ts` entry (A3 confirmed), sidebar sanity. | List → details → back and role switch work. |
| P6-10 | Web locales and tests: WT-LOCALE; typecheck, lint, tests. | Parity verified. |

**G6** — web typecheck, lint and unit tests pass; `@/api` is imported only by `party-api.ts`; manual mobile and Arabic RTL checks pass (§11.9).

### 12.8 Phase 7 — Integration (conditional on P0-07)

| ID | Task | Done when |
|---|---|---|
| P7-01 | Verify the `assertActiveRole` export and publish §9.4 as the integration contract. | A consumer can import and call the port. |
| P7-02 | For each existing document module: FK columns and migration, `assertActiveRole`, options picker, error-map additions. | Or not applicable, with evidence from P0-07. |
| P7-03 | Verify snapshot behavior. | Party edits do not change issued documents. |
| P7-04 | If legacy customer / vendor tables exist: write the migration and backfill plan. | Or not applicable. |
| P7-05 | Cross-module tests. | Green. |

**G7** — no tenant leaks, stale party selectors, broken foreign keys or changed historical documents; cross-module tests pass (or not applicable with evidence).

### 12.9 Phase 8 — End-to-end, hardening and acceptance

| ID | Task | Done when |
|---|---|---|
| P8-01 | e2e support additions in `support/api.ts` (and fixtures if needed). | Helpers usable. |
| P8-02 | e2e specs E2E-01 … E2E-08. | Green, or not applicable with the reason. |
| P8-03 | Full run: contracts, db, server unit and integration, web unit, e2e. | All green. |
| P8-04 | Manual checks (§11.9). | Results recorded. |
| P8-05 | Acceptance sweep (§13). | Every AC has evidence. |
| P8-06 | Final diff review and closeout of `PROGRESS.md`. | No hand edits to committed migrations, generated SQL or `routeTree.gen.ts` (it changes only through regeneration); no stray files. |

**G8** — all suites green; AC-01 … AC-32 verified with evidence; `PROGRESS.md` closed out.

### 12.10 File inventory (for the final diff review, P8-06)

| Area | Create | Modify |
|---|---|---|
| `packages/contracts` | `src/party/{constants,contacts,errors,schemas,index}.ts`, `src/party/locales/{en.json,ar.json,index.ts}`, `src/party/*.test.ts` | `package.json` (export), `src/index.ts`, `src/modules/registry.ts`, role locale files (en + ar), `SYSTEM_ROLES` definition if A11 requires it, locale namespace registration points |
| `packages/db` | `src/schema/party/{parties,relations,index}.ts`, one Party migration (plus a separate enum-value migration only if A2 requires it) | `src/schema/index.ts` |
| `apps/server` | `src/api/modules/party/**` (§6.1), `src/api/intl/locales/party/{en,ar}.json` | API router composition, API locale registration, `test-support` only if P0-06 requires a helper |
| Generated client | regenerated Orval output | none by hand |
| `apps/web` | `src/features/party-module/**` (§8.1), four route files, the e2e spec and `support/api.ts` additions | locale registration, navigation wiring if it is not derived from the registry |
| Docs | a migration and backfill plan only if P0-07 finds legacy tables | `PROGRESS.md` |

Never touched by hand: committed migrations, generated SQL, `routeTree.gen.ts`.

---

## 13. Acceptance criteria and traceability

| ID | Criterion | Proof |
|---|---|---|
| AC-01 | Exactly one Party backend module. | P4 layout review; no customer / vendor modules under `apps/server/src/api/modules`. |
| AC-02 | Exactly one Party frontend feature. | `features/party-module` only. |
| AC-03 | No separate Customer or Vendor identity modules or tables. | DB-01 SQL review; P0-07 findings. |
| AC-04 | Customers and Vendors remain separate navigation entries. | P3-02; E2E-01, E2E-02. |
| AC-05 | Both views use the same Party id. | RT-SHARED; E2E-03, E2E-04. |
| AC-06 | A party can have both roles. | RT-DUAL; ST-CREATE. |
| AC-07 | Normal creation always creates a new party. | RT-DUAL (identical payload twice); ST-CREATE. |
| AC-08 | Duplicate names, emails and phones never merge parties. | RT-CONFLICT, RT-DUAL. |
| AC-09 | The opposite-role checkbox works at creation. | WT-FORM; E2E-02. |
| AC-10 | An existing party receives the opposite role without duplication. | RT-ROLE; ST-ROLE; E2E-04. |
| AC-11 | Inactive roles can be reactivated. | RT-ROLE; ST-ROLE; E2E-05. |
| AC-12 | Shared information is identical in both role views. | RT-SHARED; E2E-03. |
| AC-13 | Customer and Vendor permissions remain independent. | RT-PERM; ST-AUTH. |
| AC-14 | Multiple emails, phones and addresses are supported. | RT-CONTACT; CT-CONTACT; E2E-01, E2E-06. |
| AC-15 | Every non-empty contact collection has exactly one primary. | CT-CONTACT; DB-05; RT-VALID; WT-PRIMARY; RU-PLAN. |
| AC-16 | Contact updates are transactional and preserve retained ids. | RT-CONTACT; ST-UPDATE; RU-PLAN. |
| AC-17 | All tenant-owned references use composite foreign keys. | DB-02. |
| AC-18 | Tables have the required comment blocks and indexes. | P2-01 review against §4.4; DB-09. |
| AC-19 | Organization-scoped Hono routes with OpenAPI contracts. | RT-* (all routes); P5-02. |
| AC-20 | The service implements all six mandatory operations. | ST-AUTH (six-method matrix). |
| AC-21 | Repository operations take optional transaction parameters. | P4-01 review; ST-PORT. |
| AC-22 | No expected failure can commit partial changes. | ST-CREATE, ST-UPDATE; RT-CONFLICT (atomic failed patch). |
| AC-23 | All activity events come from the central registry. | P3-05; ST-AUDIT; grep for raw `customer.` / `vendor.` strings. |
| AC-24 | API and web locales are complete in English and Arabic. | CT-LOCALE; WT-LOCALE; P4-09 parity. |
| AC-25 | The Orval client is regenerated. | G5. |
| AC-26 | Transactional documents validate the appropriate active role. | P7-02 or the §9.4 contract; ST-PORT. |
| AC-27 | Historical documents preserve snapshots. | P7-03. |
| AC-28 | Service tests and real route integration tests pass. | G4. |
| AC-29 | Database migrations pass verification. | G2 (and G3 if an enum migration exists). |
| AC-30 | Contracts, database, server and web checks pass. | G8. |
| AC-31 | [+] Web e2e tests pass. | E2E-01 … E2E-08. |
| AC-32 | [+] Mobile layout and Arabic RTL verified. | P8-04; E2E-08. |

---

**Final architectural rule.** One Party identity, multiple independent business roles, one backend aggregate, one frontend feature, and two role-based user experiences. Customers and Vendors are not separate entities in the database. They are separate business relationships with the same underlying party.
