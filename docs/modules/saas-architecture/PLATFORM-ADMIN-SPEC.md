# Platform Admin (SaaS back office) - Implementation Specification

| | |
|---|---|
| Version | 1.0 · 2026-11-27 |
| Status | decisions Q15 to Q24 answered with defaults 2026-11-27 (see PROGRESS.md) |
| Owner | Khalid (avuny) |
| Depends on | `SPEC.md` (entitlement model), `packages/db`, `packages/contracts`, `packages/ui`, the module registry, messaging module |
| Replaces | The `/admin` routes and `platform_role` column used today (see section 12) |

## 0. Reading order for agents
AGENTS.md, then `SPEC.md` sections 1 to 4, then this file sections 1 to 5, then the section for the current phase.

## 1. Goals and non-goals

### 1.1 Goals
The platform owner (and a small team) needs one place to run the SaaS without touching the database or code:
1. **Configure the commercial catalog** (the most important part): plans, which modules, features and limits each plan has, prices, add-ons, trial length, visibility, ordering, texts. Changes go live safely, with preview and history.
2. **Monitor and manage customers**: organizations, their owners and members count, plan, subscription status, usage against limits, module states, payments and invoices.
3. **Operate billing**: subscriptions, payments, refunds, failed payments, manual bank transfers, webhook events.
4. **See and adjust the catalog of modules, sidebar and permissions** that the code seeds define, with limited safe edits (section 6).
5. **Run scheduled jobs and reminders**: see them, configure them, edit the message templates, see what was sent.
6. **Admin accounts**: login only (no public registration), roles with permissions, admins who can add and manage other admins, full audit.

### 1.2 Non-goals (v1)
- "Login as the customer" (impersonation). Listed as decision Q21, default off.
- Editing the enforcement code or inventing new enforceable features from the UI. New module, feature and limit keys come from code and seeds only.
- Customer support ticketing, CRM, marketing automation. The admin does edit the public landing site content (`LANDING-SPEC.md`).
- Tenant-facing billing screens. Those stay in the tenant web app (SPEC section 7).

## 2. Architecture

### 2.1 Shape: two new apps and one new package
```
 apps/web            tenant web app (exists)
 apps/server         tenant API (exists): organizations, inventory, purchasing, entitlement READ,
                     owner subscription actions
 apps/platform-web   NEW admin web app (own Worker, own hostname, own login)
 apps/platform-server NEW admin API + provider webhooks + cron handlers (own Worker)
 packages/entitlements NEW shared domain code: resolver, snapshot recompute, plan publish logic
 packages/db, contracts, ui, zod, logger   shared, as today
```
Both servers talk to the same Postgres. The tenant API never imports admin code, and the admin API never imports tenant module services; shared logic lives in packages.

### 2.2 Server: separate app or separate module (the question to decide)

| | A. Separate Worker `apps/platform-server` (recommended) | B. Module inside `apps/server` under `/platform` | C. Admin API separate, webhooks and cron stay in tenant API |
|---|---|---|---|
| Blast radius | Admin credentials, secrets and code are not in the tenant Worker. A tenant-side bug cannot expose admin routes. | One compromised or misconfigured route exposes admin power on the public tenant surface. | Admin isolated, but the tenant Worker still holds provider secrets and cron code. |
| Secrets | Own set: admin session key, provider secrets, email key. Tenant Worker holds none of the provider write secrets. | Shared with the tenant API. | Provider secrets in tenant Worker. |
| Database permissions | Can use a separate Postgres role: platform role may write plans and catalog tables, tenant role gets read-only on them. Least privilege, enforced by the database. | One role for everything. | Mixed. |
| Auth | Admin identity is a separate system (separate tables, cookie, hostname). No chance of a tenant session ever counting as an admin session. | Separate tables are possible but share middleware stack and cookie domain. | Same as A. |
| Deploy and release | Own pipeline: admin can ship or roll back without touching the tenant API, and the reverse. A bad admin release cannot take customers down. | One deploy, one rollback. | Two pipelines. |
| Rate limits, WAF, IP allowlist | Applied to one hostname easily (Cloudflare Access or IP rules). | Must be done per path. | As A for admin. |
| Webhooks and cron | Live in a Worker that is not the customer-facing API, so webhook storms or slow jobs do not slow customers. | Share capacity with customers. | Share capacity with customers. |
| Cost and effort | A second Worker, a second deploy job, shared packages to extract (about one extra phase of work). Cloudflare Workers cost is near zero for a second Worker. | Cheapest to start. | Medium. |
| Code duplication risk | Mitigated by `packages/entitlements` and shared `packages/hono` middleware. | None. | Some. |
| Local dev | Another process in `pnpm dev`; fine. | Simplest. | Same as A. |

Recommendation: **A**. The admin panel can change prices, grant free plans and read every customer; that is worth a hard boundary, and the boundary is cheap to build now and expensive to retrofit. Webhooks and cron sit in the same Worker because they are platform-side, trusted-by-signature workloads that write the same tables the admin edits.
Fallback if effort must be minimal: B, with admin identity in separate tables, a separate cookie name and a hostname rule, and a plan to split later (the packages boundary in 2.1 makes the later split mechanical).

### 2.3 Web: separate app
`apps/platform-web`: Vite and React like `apps/web`, reusing `packages/ui`, i18n helpers and the generated API client approach (orval from the platform API's OpenAPI). Separate Worker for static assets, own hostname (for example `admin.<your domain>`), own cookie scope, strict CORS only to itself. English only in v1 (Q22); strings still go through i18n keys so Arabic can be added.

### 2.4 Network and hardening (layers, each optional except the first three)
1. Separate hostname, cookie `SameSite=Strict`, `__Host-` prefix, no CORS from tenant origins (required).
2. Rate limit and lockout on login (required).
3. Mandatory TOTP second factor for every admin (Q16, default on).
4. Cloudflare Access or an IP allowlist in front of the admin hostname (Q17).
5. Separate Postgres role for the platform Worker (recommended with option A).

## 3. Admin identity (login only, no register)

### 3.1 Tables (new, prefix `platform_`)
| Table | Columns |
|---|---|
| `platform_admins` | `id`, `email` unique (lowercased), `name`, `password_hash` (bcryptjs, same as users), `status` (invited, active, disabled), `totp_secret_enc`, `totp_enabled_at`, `last_login_at`, `failed_attempts`, `locked_until`, `created_by`, timestamps |
| `platform_admin_sessions` | `id`, `admin_id`, `token_hash`, `ip`, `user_agent`, `expires_at`, `revoked_at` |
| `platform_roles` | `id`, `key` unique, `name`, `description`, `is_builtin`, timestamps |
| `platform_role_permissions` | `role_id`, `permission_key` (`action:resource`), unique together |
| `platform_admin_roles` | `admin_id`, `role_id` (an admin can hold several roles; effective permissions are the union) |
| `platform_invites` | `id`, `email`, `role_ids`, `token_hash`, `expires_at`, `accepted_at`, `invited_by` |
| `platform_audit_events` | append-only: `id`, `admin_id`, `action`, `resource`, `resource_id`, `before` jsonb, `after` jsonb, `ip`, `at`. No update or delete permission at the database level. |

Platform admins are not rows of the tenant `users` table. Existing tenant users never become admins by flipping a column.

### 3.2 Flows
- **No registration endpoint exists.** There is no public route that creates an admin.
- **First admin**: created by a seed or CLI command run by the owner with `PLATFORM_BOOTSTRAP_EMAIL`; it prints no password, it creates an invite link valid for 24 hours. Running it again when an admin exists does nothing.
- **Adding an admin**: an admin with `create:platform-admin` sends an invite (email + roles). The invitee opens the link, sets a password, enrolls TOTP, then lands in the app. Invite expires, single use, revocable.
- **Login**: email and password, then TOTP code. Generic error messages, no account enumeration, 5 failed attempts lock for 15 minutes, every attempt audited. Sessions are server-side, 8 hours idle, 7 days absolute, revocable per session.
- **Password reset**: by an admin with `reset:platform-admin` (sends a new invite-style link), or by the owner via CLI. No self-service email reset in v1 (keeps the attack surface small), decision Q16 covers it.
- **Disable, not delete**: admins are disabled; their audit history stays.

### 3.3 Roles and permissions for admins
Same idea as the tenant registry: a code registry `PLATFORM_MODULES` (resource and actions) that seeds the permission catalog. Roles hold permission keys. Permissions per resource are listed in section 8. Built-in roles (Q18, defaults):

| Role | Purpose | Main permissions |
|---|---|---|
| `super_admin` | Owner | everything, including managing admins and roles |
| `catalog_manager` | Product and pricing | plans, features, add-ons, catalog overrides: read and write; subscriptions: read |
| `billing_admin` | Finance and ops | subscriptions, payments, invoices, refunds, manual payments, webhooks: read and write; plans: read |
| `support` | Customer support | organizations, users, subscriptions, payments: read; extend trial and grant temporary override within limits |
| `viewer` | Read only | read everywhere except admin management and audit export |

Rules (tests reference these):
- **PA-R1** A role may only contain permissions that exist in the registry.
- **PA-R2** Anti-escalation: an admin can create or edit a role, or assign a role, only if the role's permissions are a subset of the admin's own effective permissions. Only `super_admin` can grant `super_admin`.
- **PA-R3** The last active `super_admin` cannot be disabled, deleted, or have the role removed.
- **PA-R4** An admin cannot change their own roles or disable themselves.
- **PA-R5** Built-in roles can be viewed and cloned, not edited (so a reset to known-good always exists). Custom roles are fully editable.
- **PA-R6** Every platform action is audited with before and after (append-only).
- **PA-R7** Every API route declares its required permission; a CI test fails for any route without one.

## 4. Plans, features and modules configuration (core of the panel)

### 4.1 What the admin edits and what only code defines
| Thing | Defined by | Admin can |
|---|---|---|
| Product modules, feature keys, limit keys, dependencies, `enforcedBy` | Code (catalog, SPEC 2.4) synced by seed into `catalog_*` tables | View. Edit display name, description (en and ar), icon, `showLocked`, `defaultOn`, order, visibility on the pricing page. Cannot add, delete or rewire keys. |
| Plans | Data | Create, clone, edit, reorder, hide, retire plans; set trial days; set public or private |
| What a plan includes | Data in `plan_entitlements` | Toggle modules, set feature values, set limits per plan, in a matrix editor |
| Prices | Data | Per plan, per currency, per interval |
| Add-ons | Data | Create from existing catalog keys; set increments and prices |
| Per-organization exceptions | Data | Overrides with reason and expiry |

The catalog tables (`catalog_modules`, `catalog_features`, `catalog_limits`) are written only by the seed for keys, and by the admin only for the display columns. The seed never overwrites admin-edited display columns, and removes a key (and warns the admin UI) when code drops it.

### 4.2 Plan editor
- **Matrix view**: rows are modules, then features, then limits, grouped by product module; columns are plans. Click a cell to toggle or set a value. Each row shows `enforcedBy` and the module dependency hint, so an admin cannot put `purchasing` in a plan without `inventory` (validation PA-R9).
- **Drafts**: edits go into a draft of the plan; nothing is live until **Publish**. A draft can be discarded.
- **Impact preview before publish**: how many organizations are on the plan, which of them would lose a module or exceed a limit, which would gain something, and the effective date for each (see 4.3). The admin must confirm with a reason.
- **History and rollback**: every published version is kept (`plan_versions`), with who, when, reason and a diff. Rollback publishes the old version as a new one.
- **Validation (PA-R8 to PA-R10)**: only catalog keys; dependency closure (a plan with `purchasing` must include `inventory`); at least one active price per purchasable plan; a plan on which subscribers exist cannot be deleted, only retired (new subscriptions blocked).
- **Comparison page preview**: a live preview of the public pricing table as customers would see it.

### 4.3 How a published change reaches existing customers (new decision, supersedes fixes plan D8)
Because the admin can now edit plans at any time, the earlier rule "plan changes apply at renewal, no versioning" is not enough: with no versions there is no way to know what an existing subscriber was promised. Proposed (Q20):
- Plans are **versioned**. A subscription points to a plan version.
- Publishing creates a new version. New subscriptions use it at once.
- Existing subscribers: **additions** (new module, higher limit, lower price) apply immediately; **removals and reductions** apply at the subscriber's next renewal, with an email notice sent by the reminder system, unless the admin chooses "apply now" in the publish dialog (needs permission `publish_now:plan`, and a reason).
- A subscriber can be pinned to its old version ("grandfathered") by an override; the admin sees the count of grandfathered organizations per version.
Schema: `plan_versions` (plan_id, version, status, published_at, published_by, reason), `plan_entitlements` and `plan_prices` hang off a version, `subscriptions.plan_version_id` (the column the fixes plan chose to skip).

### 4.4 Per-organization exceptions
From the organization page: assign a plan manually, add or remove an entitlement override with reason and expiry, extend a trial, pin a plan version, grant an add-on for free. All audited, all produce a snapshot recompute (SPEC R5). Expired overrides are removed by the cron.

## 5. Monitoring and operations

### 5.1 Screens
| Area | Content | Actions (permission) |
|---|---|---|
| Dashboard | MRR, active subscriptions by plan, trials and conversion, churn, failed payments this week, upcoming renewals, jobs failing, webhook backlog | none |
| Organizations | List with filters (plan, status, access state, country, created date, search by name, code, owner email). Detail: owner and member counts, plan and version, subscription timeline, usage vs limits, module states, overrides, recent activity count | assign plan, override, extend trial, suspend or unsuspend (`suspend:platform-organization`) |
| Users | Tenant users: identity, organizations and roles, status, last login. No password or secret is ever shown | disable or revoke sessions (existing actions, moved here) |
| Subscriptions | List and detail with state history, period, next renewal, provider reference | cancel, resume, change plan, change period end |
| Payments and invoices | Payments, failures with provider reason, refunds, invoices, manual transfer proofs awaiting confirmation | refund (`refund:platform-payment`), confirm manual payment, void invoice |
| Provider events | The event ledger: type, received, processed, error, payload viewer | replay one event through the normal handler (idempotent) |
| Scheduled jobs | See section 7 | run now, enable, disable, edit parameters |
| Audit | Platform audit log with filters and CSV export | export (`export:platform-audit`) |

### 5.2 Rules
- **PA-R11** The admin API never returns secrets: password hashes, TOTP secrets, tokens, full card data. Payloads in the event viewer redact known secret fields.
- **PA-R12** Money actions (refund, void, manual confirm) require a reason, the specific permission, and are idempotent by a client key.
- **PA-R13** Lists are paginated server-side with stable cursors; no endpoint returns unbounded tenant data.
- **PA-R14** Reading tenant business data (items, journals, stock) is out of scope. The admin sees account-level metadata and counts, not the customer's books.

## 6. Sidebar, permissions and catalog configuration
The registry in code remains the source of truth for modules, actions, sidebar tree and built-in role grants; the seed makes the database match it (as the registry header says today). The admin panel adds a **viewer plus a small, safe editor**:

| Area | Read | Edit (stored as overrides, the seed does not overwrite them) |
|---|---|---|
| Tenant modules and actions (permission catalog) | Full tree: module, actions, which are grantable, which events are logged, product module and plan availability | Display name and description (en and ar). Not the keys, not which actions exist. |
| Tenant sidebar | Groups, order, icon, path, label, required permission, product module | Label, icon, order within group, group assignment, hidden flag. Not the path, not the permission mapping. |
| Default grants of built-in tenant roles | Matrix role by permission | Proposed changes are staged as a **seed change request** that shows the diff and exports a patch for the registry; they do not silently change production behavior (see decision Q19b below) |
| Platform admin permissions | Same viewer for `PLATFORM_MODULES` | Role editing only (section 3.3) |

Resolution order at request time for any label or order: admin override, else registry. Removing a key in code removes its override at the next seed and shows a notice.
**PA-R15** A change that would remove a permission that tenant roles currently hold is never applied from the UI; only seeds do that, because the registry header documents that it deletes those grants from every role.

## 7. Scheduled jobs and reminders

### 7.1 Model
Workers cron triggers are declared in `wrangler.jsonc` and cannot be edited at runtime, so the Worker runs **one tick** (every 5 minutes, configurable in code) and a dispatcher decides which jobs are due.
- `scheduled_jobs`: `key` (code-defined handler), `description`, `enabled`, `schedule` (cron expression, validated, minimum interval 5 minutes), `params` jsonb (typed per job, validated by the job's schema), `last_run_at`, `next_run_at`.
- `scheduled_job_runs`: `job_key`, `started_at`, `finished_at`, `status`, `processed_count`, `error`, `triggered_by` (cron or admin).
- Handlers are code. The admin can enable, disable, change schedule and parameters, run now, and read history. Admin cannot create new handlers.
- Each run takes a lock (`job_key` advisory lock or row lock) so overlapping ticks do not double-run, and every handler is idempotent.

### 7.2 Built-in jobs (first set)
| Key | What it does | Admin parameters |
|---|---|---|
| `trial.ending_reminder` | Notifies owners before the trial ends | days before (default 7, 3, 1) |
| `subscription.renewal_reminder` | Notifies before renewal | days before |
| `payment.failed_dunning` | Retry schedule messages for failed payments | steps (day offsets) |
| `grace.expiry` | Moves organizations from grace to restricted at the stored date | none |
| `subscription.period_end_changes` | Applies scheduled downgrades and removals at period end (section 4.3) | none |
| `override.expiry` | Removes expired overrides and recomputes snapshots | none |
| `usage.limit_warning` | Warns owners at a percentage of a limit | percent (default 80) |
| `entitlement.drift_check` | Recomputes snapshots and reports mismatches | none |
| `provider.reconcile` | Compares provider and local subscription status | none |
| `invite.cleanup` | Expires old admin and tenant invites | none |

### 7.3 Templates and delivery
- `notification_templates`: `key`, `locale` (en, ar), `subject`, `body` with a fixed list of variables per template (org name, days left, plan name, amount, link). Admin edits text with a live preview and a "send test to me" button. Variables outside the allowed list are rejected at save.
- Delivery uses the existing messaging module (email via Resend) in v1 (Q24). Each send is recorded in `notification_log` with a unique key `(org_id, template_key, period_key)` so a reminder is sent once per period even if the job runs twice.
- Opt-out rules: transactional billing messages cannot be switched off by customers; marketing-type messages are not in scope.
- Language: the owner's locale if known, else English.

## 8. Platform permissions (registry `PLATFORM_MODULES`, first cut)
Resource and actions, each action a grantable permission:

| Resource | Actions |
|---|---|
| `platform-admin` | read, create (invite), update, disable, reset |
| `platform-role` | read, create, update, delete |
| `platform-plan` | read, create, update, publish, publish_now, retire |
| `platform-catalog` | read, update (display fields) |
| `platform-addon` | read, create, update |
| `platform-organization` | read, assign_plan, override, extend_trial, suspend |
| `platform-user` | read, disable, revoke_sessions |
| `platform-subscription` | read, cancel, resume, change |
| `platform-payment` | read, refund, confirm_manual, void_invoice |
| `platform-provider-event` | read, replay |
| `platform-job` | read, update, run |
| `platform-template` | read, update |
| `platform-sidebar` | read, update |
| `platform-permission-catalog` | read, update |
| `platform-audit` | read, export |
| `platform-site` | read, update, publish, rollback (landing content, see `LANDING-SPEC.md`) |
| `platform-media` | read, create, delete |
| `platform-plan-marketing` | read, update |
| `platform-dashboard` | read |

## 9. Accounting and inventory effects
None on tenant books. Platform invoices and payments are the platform's own records (see billing spec).

## 10. Reporting
The dashboard in 5.1, plus CSV exports of subscriptions, payments and audit (permissioned). Metrics are computed from tables, not from the provider, so they work for manual-transfer customers too.

## 11. Acceptance criteria
- **PAC1** No route creates an admin without a valid invite or the bootstrap CLI; there is no register endpoint (route inventory test).
- **PAC2** Login enforces TOTP, lockout, generic errors, and session expiry; a tenant session never authenticates against the platform API and the reverse.
- **PAC3** Anti-escalation, last super admin, self-edit rules (PA-R2 to PA-R5) hold under concurrent requests.
- **PAC4** Every platform route declares a permission and denies without it (PA-R7); a 403 test per route, generated from the route list.
- **PAC5** Plan publish: validation, dependency closure, impact preview numbers match actual effects, versioning and rollback work; additions immediate, removals at renewal (Q20).
- **PAC6** The matrix editor produces exactly the entitlements the resolver reads: a published plan changes `GET /organizations/:id/entitlements` for a test organization.
- **PAC7** Catalog sync: seed adds, updates and removes catalog keys without overwriting admin display edits.
- **PAC8** Sidebar and label overrides appear in the tenant web app; removing an override restores the registry value; no override can remove a permission (PA-R15).
- **PAC9** Jobs: dispatcher runs due jobs once under overlapping ticks, records runs, admin run-now works, parameter validation rejects bad input.
- **PAC10** Reminders sent once per period (unique log), correct locale, template variable validation.
- **PAC11** Audit entries with before and after for every mutating call; the audit table rejects update and delete at the database level.
- **PAC12** No secret appears in any response or event payload view (PA-R11), checked by a response scan test.
- **PAC13** Tenant API database role cannot write plan or catalog tables (if Q15 option A with a separate role).

## 12. Implementation tasks
See PROGRESS.md, phases A1 to A7. Ordering against the main plan:
- A1 (platform apps, admin identity, roles) is independent of the entitlement tables and can run in parallel with S1 and S2.
- A2 (plan and catalog configurator) needs S2 (tables) and decision Q20.
- A3 (sidebar and permissions viewer and overrides) can run after S1.
- A4 (organizations, users, subscriptions monitoring) needs S5.
- A5 (payments and provider events) needs S6.
- A6 (jobs and reminders) needs S5 and S6 for useful content; the dispatcher itself can ship earlier.
- A7 hardening and migration of the old `/admin` module.

Migration of the existing admin: today `users.platform_role` (user, support, admin) and `/admin` routes (list users, get user, suspend, reactivate, revoke sessions, activity, metrics) live in the tenant API, seeded by script. Plan: rebuild these as screens and routes in the platform apps under the new identity system (A4), run both in parallel, then remove `/admin` routes from the tenant API and drop the column in a later migration (Q19).

## 13. Repository checks before implementation
1. Existing admin module: routes, tests, what `metrics` computes, what the seed script does with `platform_role`.
2. `packages/hono` middleware: what is reusable for a second Worker (auth, errors, OpenAPI, logging).
3. Auth module: session and cookie implementation to mirror, bcrypt settings, OTP and TOTP support (messaging and otp modules exist).
4. CI workflow and `scripts/check-wrangler-vars.mjs`: how to add a second Worker deploy without breaking the vars check.
5. Neon: whether separate roles are available on the current plan, and how migrations run per role.
6. `apps/web` build and orval setup, to copy for `platform-web`.
7. The messaging module's Resend wiring for reminders.

## 14. Decisions to preserve
- Admin identity is separate from tenant identity: separate tables, hostname, cookie, session.
- No admin registration. Admins join by invite or bootstrap CLI, with TOTP.
- Code defines what exists; the admin defines how it is sold and displayed.
- Plan edits are drafts, previewed, published, versioned, and reversible.
- Removals reach existing customers at renewal unless the admin explicitly applies now.
- The admin panel never silently removes a permission from tenant roles.
- Every platform action is audited, append-only.
- Jobs: handlers in code, schedule and parameters editable, idempotent, one tick dispatcher.
