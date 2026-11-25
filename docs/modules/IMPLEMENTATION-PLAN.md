# SaaS Modules — Implementation Plan

> **Version**: 1.0 · 2026-11-25
> **Estimated effort**: 8–12 weeks (1 developer) or 4–6 weeks (2 developers in parallel after Phase 1)

---

## Overview

This plan converts Avuny Books from a free-access multi-tenant app into a **production SaaS** with tiered plans, subscriptions, Stripe payments, billing, and runtime feature/limit enforcement. Work is split into 6 phases with clear gates between them.

### Dependency Graph

```
Phase 1: Contracts & DB        ─── foundation for everything
    │
    ├─► Phase 2: Feature Gate   ─── can run in parallel with Phase 3
    │       │
    │       └─► Phase 4: Integrate Feature Gate into existing modules
    │
    ├─► Phase 3: Subscription + Payment + Billing (Stripe)
    │       │
    │       └─► Phase 4 (also depends on Phase 3 for real plan data)
    │
    └─────────► Phase 5: Frontend (depends on Phase 2 + 3 + 4)
                    │
                    └─► Phase 6: Testing, polish, launch
```

---

## Phase 1 — Contracts & Database Schema

> **Goal**: Define all data structures, Zod schemas, error codes, locale strings, and DB tables for the five new modules.
> **Duration**: 1–2 weeks

### 1.1 Contracts — Plan Module
| Task | Done when |
|------|-----------|
| Create `packages/contracts/src/plan/constants.ts` | Feature keys, limit keys, plan codes, billing intervals, add-on codes defined |
| Create `packages/contracts/src/plan/schemas.ts` | `PlanDtoSchema`, `PlanPriceDtoSchema`, `PlanFeatureDtoSchema`, `PlanLimitDtoSchema`, `AddonDtoSchema`, `CurrentPlanDtoSchema`, input schemas |
| Create `packages/contracts/src/plan/errors.ts` | `PLAN_NOT_FOUND`, `PLAN_CODE_TAKEN`, `PLAN_CANNOT_DEACTIVATE`, `PLAN_ADMIN_REQUIRED` |
| Create `packages/contracts/src/plan/locales/{en,ar}.json` | Plan names, feature descriptions, limit labels, error messages in both languages |
| Create `packages/contracts/src/plan/index.ts` | Barrel export |

### 1.2 Contracts — Subscription Module
| Task | Done when |
|------|-----------|
| Create `packages/contracts/src/subscription/constants.ts` | Subscription statuses, event types |
| Create `packages/contracts/src/subscription/schemas.ts` | `SubscriptionDtoSchema`, `CreateSubscriptionSchema`, `UpgradeSubscriptionSchema`, `DowngradeSubscriptionSchema`, `CancelSubscriptionSchema`, `PreviewSubscriptionChangeSchema`, `SubscriptionPreviewDtoSchema`, `SubscriptionEventDtoSchema` |
| Create `packages/contracts/src/subscription/errors.ts` | All 12 error codes from SPEC |
| Create `packages/contracts/src/subscription/locales/{en,ar}.json` | Error messages, status labels, event descriptions |
| Create `packages/contracts/src/subscription/index.ts` | Barrel export |

### 1.3 Contracts — Payment Module
| Task | Done when |
|------|-----------|
| Create `packages/contracts/src/payment/constants.ts` | Payment statuses, payment method types, refund reasons |
| Create `packages/contracts/src/payment/schemas.ts` | `PaymentMethodDtoSchema`, `PaymentDtoSchema`, `RefundDtoSchema`, `SetupIntentResponseSchema`, `AttachPaymentMethodSchema`, `RefundPaymentSchema` |
| Create `packages/contracts/src/payment/errors.ts` | All 9 error codes from SPEC |
| Create `packages/contracts/src/payment/locales/{en,ar}.json` | Error messages, status labels, card brand names |
| Create `packages/contracts/src/payment/index.ts` | Barrel export |

### 1.4 Contracts — Billing Module
| Task | Done when |
|------|-----------|
| Create `packages/contracts/src/billing/constants.ts` | Invoice statuses, line item types, credit reasons |
| Create `packages/contracts/src/billing/schemas.ts` | `InvoiceDtoSchema`, `InvoiceLineItemDtoSchema`, `InvoiceListQuerySchema`, `UpcomingInvoiceDtoSchema`, `CreditDtoSchema`, `BillingInfoSchema`, `UpdateBillingInfoSchema` |
| Create `packages/contracts/src/billing/errors.ts` | All 4 error codes from SPEC |
| Create `packages/contracts/src/billing/locales/{en,ar}.json` | Error messages, invoice labels |
| Create `packages/contracts/src/billing/index.ts` | Barrel export |

### 1.5 Contracts — Feature Gate Module
| Task | Done when |
|------|-----------|
| Create `packages/contracts/src/feature-gate/constants.ts` | `FEATURE_KEYS`, `LIMIT_KEYS`, `FeatureKey`, `LimitKey` types |
| Create `packages/contracts/src/feature-gate/schemas.ts` | `FeatureListResponseSchema`, `LimitListResponseSchema`, `LimitCheckResultSchema` |
| Create `packages/contracts/src/feature-gate/errors.ts` | `FEATURE_NOT_AVAILABLE`, `LIMIT_REACHED`, `PLAN_DATA_UNAVAILABLE` |
| Create `packages/contracts/src/feature-gate/locales/{en,ar}.json` | Error messages, upgrade prompts |
| Create `packages/contracts/src/feature-gate/index.ts` | Barrel export |

### 1.6 Database Schema
| Task | Done when |
|------|-----------|
| Create `packages/db/src/schema/billing/plans.ts` | `plans`, `planPrices`, `planFeatures`, `planLimits` tables with constraints, indexes |
| Create `packages/db/src/schema/billing/addons.ts` | `addons`, `addonPrices` tables |
| Create `packages/db/src/schema/billing/subscriptions.ts` | `subscriptions`, `subscriptionAddons`, `subscriptionEvents` tables |
| Create `packages/db/src/schema/billing/payments.ts` | `paymentMethods`, `payments`, `refunds` tables |
| Create `packages/db/src/schema/billing/invoices.ts` | `invoices`, `invoiceLineItems`, `credits`, `creditApplications` tables |
| Create `packages/db/src/schema/billing/billing-info.ts` | `billingInfo` table (one per org) |
| Create `packages/db/src/schema/billing/relations.ts` | All Drizzle relations |
| Create `packages/db/src/schema/billing/index.ts` | Barrel export |
| Update `packages/db/src/schema/index.ts` | Add billing exports |
| Run `pnpm --filter @avuny/db db:generate` | Migration SQL generated |
| Run `pnpm --filter @avuny/db db:migrate` | Tables created in dev database |

### 1.7 Seed Data
| Task | Done when |
|------|-----------|
| Create `packages/db/src/seed/plans.ts` | Seed function for all 5 plans with features, limits, prices |
| Create `packages/db/src/seed/addons.ts` | Seed function for all add-ons with prices |
| Add `seed:plans` script to `package.json` | Running it seeds plans idempotently |
| Run seed on dev database | Plans visible in DB |

### 1.8 Gate: Phase 1 Complete
- [ ] All contracts typecheck: `pnpm --filter @avuny/contracts typecheck`
- [ ] Contracts build: `pnpm --filter @avuny/contracts build`
- [ ] Database builds: `pnpm --filter @avuny/db build`
- [ ] Migration applied successfully
- [ ] Seeds run without errors
- [ ] `pnpm intl:generate` succeeds (new locale namespaces registered)
- [ ] Full monorepo typecheck: `pnpm typecheck`

---

## Phase 2 — Feature Gate Service (Backend)

> **Goal**: Build the central feature/limit enforcement service that all modules will consume.
> **Duration**: 1 week
> **Can start in parallel with Phase 3.**

### 2.1 Feature Gate Module — Backend
| Task | Done when |
|------|-----------|
| Create `apps/server/src/api/modules/feature-gate/feature-gate.repository.ts` | Queries: get plan by org (via subscription), get features, get limits, count resources |
| Create `apps/server/src/api/modules/feature-gate/feature-gate.service.ts` | `hasFeature()`, `checkLimit()`, `getEffectivePlan()`, `getUsage()`, `invalidate()` |
| Create `apps/server/src/api/modules/feature-gate/feature-gate.types.ts` | Interfaces: `FeatureGateService`, `LimitCheckResult`, `EffectivePlan`, usage counter ports |
| Create `apps/server/src/api/modules/feature-gate/deps.ts` | Wire singleton dependencies |
| Implement interface compatibility | Service implements `PlanFeatures`, `UnitCollectionPlanFeatures`, `OrganizationLimits` |
| Create usage counter ports | Each module exports a `count(orgId)` function for its resource |

### 2.2 Caching
| Task | Done when |
|------|-----------|
| Cache effective plan per org (5 min TTL) | Plan lookups don't hit DB every call |
| `invalidate(orgId)` clears cache | Subscription changes are reflected immediately |

### 2.3 Routes
| Task | Done when |
|------|-----------|
| Create `hono-routes/get-features.route.ts` | GATE-FEATURES endpoint works |
| Create `hono-routes/get-limits.route.ts` | GATE-LIMITS endpoint works (with live usage counts) |
| Register routes in `hono-routes/index.ts` | Routes mounted on the org-scoped router |

### 2.4 Unit Tests
| Task | Done when |
|------|-----------|
| `feature-gate.service.spec.ts` | Tests for every feature key × plan combination |
| Limit check tests | Tests with mocked counts at boundary (under/at/over limit) |
| Addon effect tests | Adding an addon increases the effective limit |
| Free plan tests | Org with no subscription gets Free plan limits |
| Cache tests | Invalidation works, TTL expires correctly |

### 2.5 Gate: Phase 2 Complete
- [ ] Feature gate service compiles and passes all unit tests
- [ ] Implements all existing plan feature interfaces
- [ ] Routes return correct data for seeded plans
- [ ] `pnpm typecheck` passes

---

## Phase 3 — Subscription + Payment + Billing (Stripe)

> **Goal**: Build the Stripe-integrated subscription lifecycle, payment processing, and invoice management.
> **Duration**: 2–3 weeks
> **Can start in parallel with Phase 2.**

### 3.1 Stripe Setup
| Task | Done when |
|------|-----------|
| Add `stripe` npm package to `apps/server` | Installed and importable |
| Create `apps/server/src/lib/stripe.ts` | Stripe client singleton, API version pinned |
| Add env variables | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` in `.env` and types |
| Create Stripe Products + Prices in Stripe Dashboard (or via API seed) | 5 products, 10 prices (monthly + yearly per plan) created in Stripe test mode |
| Map Stripe Price IDs to `plan_prices.stripe_price_id` in seed | DB records linked to Stripe |

### 3.2 Payment Module — Backend
| Task | Done when |
|------|-----------|
| Create `payment.repository.ts` | CRUD for payment methods, payments, refunds |
| Create `payment.service.ts` | Setup intent, attach/detach methods, record payments, process refunds |
| Create `payment.types.ts` | Service deps, Stripe client port |
| Create `payment.errors.ts` / `payment.error-map.ts` | All error codes mapped |
| Create `hono-routes/` | PM-LIST, PM-SETUP, PM-ATTACH, PM-SET-DEFAULT, PM-DELETE, PAY-LIST, PAY-GET, PAY-REFUND |
| Create `deps.ts` | DI wiring |

### 3.3 Subscription Module — Backend
| Task | Done when |
|------|-----------|
| Create `subscription.repository.ts` | CRUD for subscriptions, subscription events, subscription addons |
| Create `subscription.service.ts` | Create, upgrade, downgrade, cancel, reactivate, preview, addon add/remove |
| Create `subscription.types.ts` | Service deps |
| Create `subscription.errors.ts` / `subscription.error-map.ts` | All error codes mapped |
| Create `hono-routes/` | SUB-GET, SUB-CREATE, SUB-UPGRADE, SUB-DOWNGRADE, SUB-CANCEL, SUB-REACTIVATE, SUB-ADDON-ADD, SUB-ADDON-REMOVE, SUB-EVENTS, SUB-PREVIEW |
| Create `deps.ts` | DI wiring |

### 3.4 Billing Module — Backend
| Task | Done when |
|------|-----------|
| Create `billing.repository.ts` | CRUD for invoices, line items, credits, credit applications, billing info |
| Create `billing.service.ts` | List invoices, get invoice, upcoming preview, credit management, billing info CRUD |
| Create `billing.types.ts` | Service deps |
| Create `billing.errors.ts` / `billing.error-map.ts` | All error codes mapped |
| Create `hono-routes/` | INV-LIST, INV-GET, INV-DOWNLOAD, INV-UPCOMING, CREDIT-LIST, CREDIT-BALANCE, BILLING-INFO, BILLING-UPDATE |
| Create `deps.ts` | DI wiring |

### 3.5 Webhook Handler
| Task | Done when |
|------|-----------|
| Create `apps/server/src/api/modules/webhook/stripe-webhook.route.ts` | Handles all Stripe events, verifies signature |
| Implement event handlers | `customer.subscription.*`, `invoice.*`, `payment_intent.*`, `charge.*`, `payment_method.*` events |
| Idempotency | Duplicate Stripe event IDs are detected and skipped |
| Integration with subscription service | Webhook updates subscription status |
| Integration with billing service | Webhook creates/updates invoices |
| Integration with feature gate | Webhook invalidates feature gate cache on subscription changes |

### 3.6 Unit Tests
| Task | Done when |
|------|-----------|
| `payment.service.spec.ts` | Setup intent, attach, detach, refund flows tested with mocked Stripe |
| `subscription.service.spec.ts` | Full lifecycle: create → trial → activate → upgrade → downgrade → cancel tested |
| `billing.service.spec.ts` | Invoice sync, credit application, upcoming preview tested |
| `stripe-webhook.spec.ts` | Signature verification, event handling, idempotency tested |

### 3.7 Gate: Phase 3 Complete
- [ ] Subscription lifecycle works end-to-end with Stripe test mode
- [ ] Webhook handler processes all relevant events
- [ ] Invoices are synced from Stripe
- [ ] Payment methods can be added/removed
- [ ] All unit tests pass
- [ ] `pnpm typecheck` passes

---

## Phase 4 — Integrate Feature Gate into Existing Modules

> **Goal**: Replace all dummy plan feature implementations and add limit enforcement to every module.
> **Duration**: 1–2 weeks
> **Depends on**: Phase 2 (Feature Gate service) and Phase 3 (real subscription data)

### 4.1 Module-by-Module Integration

For **each** module listed below, the work is:
1. Add a `count(orgId)` export (for usage counting).
2. Replace `Dummy*` or add `FeatureGateService` to `deps.ts`.
3. Add `checkLimit()` call in the service's `create()` method.
4. Add the `*_LIMIT_REACHED` error code to contracts and error map.
5. Add locale strings for the new error.
6. Update existing unit tests (replace dummy with mock feature gate).
7. Add limit enforcement tests.

| Module | Feature Gate | Limit Gate | New Error Code |
|--------|-------------|------------|----------------|
| `role` | Replace `DummyPlanFeatures` | — (feature-gated, not count-limited) | — (already has `ROLE_FEATURE_NOT_AVAILABLE`) |
| `unit-collection` | Replace `DummyUnitCollectionPlanFeatures` | `maxUnitCollections` | `UNIT_COLLECTION_LIMIT_REACHED` |
| `organization` | Replace hardcoded `OrganizationLimits` | `maxOrganizations` | — (already has `ORGANIZATION_LIMIT_REACHED`) |
| `organization-user` | — | `maxMembers` | `MEMBER_LIMIT_REACHED` |
| `organization-invitation` | — | `maxMembers` (count current + pending) | `MEMBER_LIMIT_REACHED` (shared code) |
| `item` | — | `maxItems` | `ITEM_LIMIT_REACHED` |
| `warehouse` | — | `maxWarehouses` | `WAREHOUSE_LIMIT_REACHED` |
| `warehouse-location` | — | `maxLocationsPerWarehouse` | `WAREHOUSE_LOCATION_LIMIT_REACHED` |
| `party` (customer scope) | — | `maxCustomers` | `CUSTOMER_LIMIT_REACHED` |
| `party` (vendor scope) | — | `maxVendors` | `VENDOR_LIMIT_REACHED` |
| `inventory-adjustment` | — | `maxAdjustmentsPerMonth` | `ADJUSTMENT_MONTHLY_LIMIT_REACHED` |
| `batch` | `batchTracking` feature | — | `BATCH_FEATURE_NOT_AVAILABLE` |

### 4.2 Integration Tests
| Task | Done when |
|------|-----------|
| Integration test: free plan limits | Create org → try to exceed free limits → get `*_LIMIT_REACHED` errors |
| Integration test: upgrade unlocks limits | Subscribe to Starter → limits increase → can create more resources |
| Integration test: feature gate | Free plan → `customRoles` blocked; Pro plan → `customRoles` allowed |
| Run all existing integration tests | No regressions |

### 4.3 Regenerate API Client
| Task | Done when |
|------|-----------|
| Run `pnpm openapi:generate` | New routes in OpenAPI spec |
| Run `pnpm api:generate` | New hooks generated in `apps/web/src/api/` |
| Typecheck web | `pnpm --filter @avuny/books-web typecheck` passes |

### 4.4 Gate: Phase 4 Complete
- [ ] All `Dummy*` implementations removed
- [ ] Every module enforces its limits
- [ ] Integration tests prove limit enforcement works
- [ ] No regressions in existing tests
- [ ] API client regenerated and web typechecks

---

## Phase 5 — Frontend

> **Goal**: Build the web UI for plans, subscriptions, payments, billing, and feature gating.
> **Duration**: 2–3 weeks
> **Depends on**: Phase 4 (backend complete, API client generated)

### 5.1 Shared Components & Hooks
| Task | Done when |
|------|-----------|
| Create `apps/web/src/features/plan-module/` | API hooks, types, normalizers |
| Create `usePlanFeature(key)` hook | Returns `{ enabled, loading }` |
| Create `usePlanLimit(key)` hook | Returns `{ allowed, used, limit, remaining, percentage, loading }` |
| Create `useCurrentPlan()` hook | Returns full plan + usage data |
| Create `<PlanGate>` component | Feature-based conditional render |
| Create `<LimitGuard>` component | Limit-based button disabling |
| Create `<LimitUsageBar>` component | Visual limit progress bar |
| Create `<LimitWarningBanner>` component | Warning when limit >80% |
| Create `<UpgradePrompt>` component | Actionable upgrade CTA |

### 5.2 Public Pricing Page
| Task | Done when |
|------|-----------|
| Create route `apps/web/src/routes/pricing.tsx` | Public, no auth required |
| Create `apps/web/src/features/plan-module/pricing/` | Pricing grid component |
| Monthly/yearly toggle | Prices switch with savings indicator |
| Feature comparison table | All features × all plans |
| CTA buttons | "Start free" → sign up; "Start trial" → sign up + plan; "Contact us" → enterprise |
| Responsive | Card layout on mobile |
| RTL support | Arabic layout correct |

### 5.3 Subscription Management
| Task | Done when |
|------|-----------|
| Create route `/:org/settings/subscription` | Org settings page |
| Create `apps/web/src/features/subscription-module/` | Full feature module |
| Current subscription card | Plan name, status, billing interval, next renewal |
| Trial banner (app-wide) | Shows on `trialing` status with days remaining |
| Plan upgrade flow | Select plan → preview proration → confirm → payment |
| Plan downgrade flow | Select plan → warning dialog → confirm |
| Cancellation flow | Multi-step: reason → reminder → confirm |
| Reactivation | "Reactivate" button on canceling subscriptions |
| Add-on management | Add/remove add-ons with price display |
| Subscription history | List of events (upgrades, renewals, etc.) |

### 5.4 Payment Methods
| Task | Done when |
|------|-----------|
| Create `apps/web/src/features/payment-module/` | Full feature module |
| Install `@stripe/react-stripe-js` + `@stripe/stripe-js` | Stripe Elements available |
| Payment method list | Cards with brand, last4, expiry, default badge |
| Add payment method dialog | Stripe Elements card input, loading states, error handling |
| Set default / remove actions | With confirmation dialog for removal |
| RTL-safe Stripe Elements styling | Custom style tokens for dark/light mode |

### 5.5 Billing & Invoices
| Task | Done when |
|------|-----------|
| Create `apps/web/src/features/billing-module/` | Full feature module |
| Billing overview page | Plan summary, credit balance, recent invoices, payment methods link |
| Invoice list page | Data table with filters, pagination, status badges |
| Invoice detail page | Line items, totals, PDF download |
| Billing info form | Company name, address, tax ID, billing email |
| Payment history page | Table with status, refund action |
| Credit balance section | Expandable credit list |

### 5.6 Feature Gate Integration in Existing Pages
| Task | Done when |
|------|-----------|
| Wrap "Create custom role" button in `<PlanGate feature="customRoles">` | Shows upgrade prompt on Free/Starter |
| Add `<LimitGuard limitKey="maxItems">` to item create button | Disabled at limit with tooltip |
| Add `<LimitGuard>` to warehouse, party, unit-collection create buttons | Same pattern |
| Add `<LimitWarningBanner>` to item list, warehouse list, member list | Warning at >80% |
| Add `<LimitUsageBar>` to plan settings page | Usage bars for all limits |

### 5.7 Settings Navigation
| Task | Done when |
|------|-----------|
| Add "Subscription" to settings sidebar | Under org settings |
| Add "Billing" to settings sidebar | With sub-items: Overview, Invoices, Payment Methods, Payments |
| Settings routes registered | File-based routes under `/:org/settings/billing/*` |

### 5.8 Localization
| Task | Done when |
|------|-----------|
| All UI strings in `en.json` / `ar.json` | Zero hardcoded strings |
| RTL verified in Arabic | All pages render correctly |

### 5.9 Gate: Phase 5 Complete
- [ ] All pages render correctly in English and Arabic
- [ ] Upgrade flow works end-to-end (Stripe test mode)
- [ ] Feature gates show upgrade prompts for Free plan users
- [ ] Limit guards disable buttons at limits
- [ ] `pnpm typecheck` passes
- [ ] Web unit tests pass

---

## Phase 6 — Testing, Polish & Launch

> **Goal**: Comprehensive testing, edge cases, performance, and production readiness.
> **Duration**: 1–2 weeks

### 6.1 Integration Tests (Backend)
| Task | Done when |
|------|-----------|
| Full subscription lifecycle test | Create → trial → activate → upgrade → downgrade → cancel |
| Payment flow test | Add method → charge → refund |
| Invoice generation test | Subscription charge → invoice created with correct line items |
| Webhook replay test | Replay Stripe events from test fixtures |
| Limit enforcement across all modules | Each module's limit is tested at boundary |
| Feature gate across plans | Each feature is tested on each plan tier |

### 6.2 End-to-End Tests (Browser)
| Task | Done when |
|------|-----------|
| Sign up → create org → see free plan limits | Full onboarding flow |
| Upgrade to Starter (Stripe test card) | Payment, subscription activation, limits increase |
| Hit a limit → see upgrade prompt | Create items until limit → button disabled → upgrade → continue |
| Downgrade flow | Downgrade → warning → confirm → limits reduce at period end |
| Cancel and resubscribe | Cancel → features removed → resubscribe → features restored |
| Invoice download | View invoice → download PDF |
| Payment method management | Add, set default, remove card |

### 6.3 Performance
| Task | Done when |
|------|-----------|
| Feature gate cached, < 5ms p99 | Benchmark `hasFeature()` with cache hit |
| Limit checks < 50ms p99 | Benchmark `checkLimit()` with live DB count |
| Plan page loads < 200ms | Public pricing page |

### 6.4 Edge Cases
| Task | Done when |
|------|-----------|
| Webhook out-of-order delivery | Events processed correctly regardless of order |
| Stripe downtime handling | Graceful fallback when Stripe API is unavailable |
| Concurrent subscription changes | Race condition protection (DB locks) |
| Free plan → enterprise custom limits | Manual override applied correctly |
| Org with data above new limit after downgrade | Grace period enforced, data preserved |

### 6.5 Production Prep
| Task | Done when |
|------|-----------|
| Switch Stripe to live mode | Live keys configured, products/prices created |
| Migrate existing orgs to Free plan | All existing orgs have Free plan features/limits |
| Pricing page SEO | Meta tags, structured data |
| Monitoring alerts | Alert on payment failures, webhook errors |
| Documentation | API docs for plan/subscription endpoints |

### 6.6 Gate: Phase 6 Complete (Launch Ready)
- [ ] All integration tests pass
- [ ] All e2e tests pass
- [ ] No regressions in existing test suites
- [ ] Performance benchmarks met
- [ ] Stripe live mode configured and tested
- [ ] Existing orgs migrated
- [ ] Monitoring in place

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Stripe API changes | Medium | Pin API version, review changelog before upgrading |
| Webhook delivery failures | High | Implement retry/dead-letter queue, idempotent handlers |
| Cache inconsistency | Medium | Short TTL (5 min) + explicit invalidation on subscription changes |
| Existing data exceeds new limits | High | Grace period on downgrade; migration script to audit current usage |
| Regional payment methods | Low | Start with cards; add mada/SEPA later via Stripe Payment Element |
| Tax compliance | Medium | Use Stripe Tax initially; integrate local tax rules later |

---

## Module Development Order (Summary)

```
Week 1-2:  Phase 1 — Contracts + DB for all 5 modules
Week 2-3:  Phase 2 — Feature Gate service    ┐
Week 2-4:  Phase 3 — Stripe integration      ┘  (parallel)
Week 4-5:  Phase 4 — Wire Feature Gate into every module
Week 5-7:  Phase 5 — All frontend pages
Week 7-8:  Phase 6 — Testing + polish + launch
```

---

## Decision Log

| ID | Decision | Rationale | Status |
|----|----------|-----------|--------|
| D1 | Free plan = no subscription record | Simplifies queries; most orgs start free | Proposed |
| D2 | Stripe as sole payment processor | Industry standard, handles PCI, regional methods, subscriptions | Proposed |
| D3 | Feature Gate as single service | Unifies 3 existing interfaces, single cache, single query path | Proposed |
| D4 | Prices in USD only (v1) | Simplifies billing; localized prices in v2 | Proposed |
| D5 | 5 plan tiers | Covers solo → enterprise; can be pruned or expanded based on market | Proposed |
| D6 | Downgrades at period end, upgrades immediate | Standard SaaS pattern; avoids complex proration for downgrades | Proposed |
| D7 | Credits never expire by default | Customer-friendly; promotional credits can have explicit expiry | Proposed |
| D8 | Usage counts are live (not cached) | Accuracy matters more than performance for create operations | Proposed |
