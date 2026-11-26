# Subscription Module — Specification

> **Version**: 1.0 · 2026-11-25
> **Status**: Specification
> **Parent**: [SaaS Overview](../SAAS-OVERVIEW.md)

---

## 1. Purpose

The Subscription module manages the **lifecycle** of an organization's relationship with a plan: creation, trial, activation, renewal, upgrade, downgrade, cancellation, and expiration. It is the bridge between the Plan catalog and the Payment/Billing modules.

Each organization has **at most one active subscription** at any time. The subscription determines what features and limits the organization has access to via the [Feature Gate](../feature-gate/SPEC.md).

---

## 2. Domain Model

### 2.1 Subscription Entity

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `orgId` | UUID | FK → organizations (unique: one active sub per org) |
| `planId` | UUID | FK → plans |
| `status` | enum | Current lifecycle state (see §3.1) |
| `stripeSubscriptionId` | text | null | Stripe Subscription object ID |
| `stripeCustomerId` | text | null | Stripe Customer object ID |
| `currentPeriodStart` | timestamp | Start of the current billing period |
| `currentPeriodEnd` | timestamp | End of the current billing period |
| `trialStart` | timestamp | null | When the trial started |
| `trialEnd` | timestamp | null | When the trial ends/ended |
| `canceledAt` | timestamp | null | When cancellation was requested |
| `cancelAtPeriodEnd` | boolean | If true, subscription ends at period end (not immediately) |
| `cancelReason` | text | null | User-provided cancellation reason |
| `endedAt` | timestamp | null | When the subscription actually ended |
| `billingInterval` | enum | `monthly`, `yearly` |
| `metadata` | jsonb | null | Custom overrides for enterprise plans |
| `createdAt` | timestamp | Creation time |
| `updatedAt` | timestamp | Last update |

### 2.2 Subscription Add-on Entity

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `subscriptionId` | UUID | FK → subscriptions |
| `addonId` | UUID | FK → addons |
| `quantity` | integer | How many units of this add-on |
| `stripeSubscriptionItemId` | text | null | Stripe item ID |
| `createdAt` | timestamp | Added date |

### 2.3 Subscription Event Entity (audit trail)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `subscriptionId` | UUID | FK → subscriptions |
| `event` | text | Event type (see §3.3) |
| `fromPlanId` | UUID | null | Previous plan (for upgrades/downgrades) |
| `toPlanId` | UUID | null | New plan |
| `actorUserId` | UUID | null | Who triggered the event (null for system events) |
| `stripeEventId` | text | null | Stripe event ID for webhook-triggered events |
| `metadata` | jsonb | Event-specific details |
| `createdAt` | timestamp | When it happened |

---

## 3. Business Rules

### 3.1 Subscription Statuses

```
                                 ┌──────────┐
                        ┌───────►│  active   │◄─────────┐
                        │        └─────┬─────┘          │
                        │              │                │
               trial    │         cancel / expire      renew
              expires   │              │                │
                        │              ▼                │
┌──────────┐     ┌──────┴─────┐  ┌───────────┐  ┌──────┴─────┐
│  created  │────►│  trialing  │  │ canceling │──►│  canceled  │
└──────────┘     └────────────┘  └───────────┘  └────────────┘
                        │                              │
                        │ payment fails                │ resubscribe
                        ▼                              ▼
                 ┌─────────────┐               ┌────────────┐
                 │  past_due   │               │   expired   │
                 └──────┬──────┘               └────────────┘
                        │
                 payment retried
                   successfully
                        │
                        ▼
                 ┌─────────────┐
                 │   active    │
                 └─────────────┘
```

| Status | Description | Features active? |
|--------|-------------|-----------------|
| `created` | Subscription record created, payment pending | No |
| `trialing` | Free trial active, no payment yet | Yes (plan features) |
| `active` | Paid and current | Yes |
| `past_due` | Payment failed, retrying | Yes (grace period) |
| `canceling` | Cancel requested, runs until period end | Yes |
| `canceled` | Subscription ended | Downgrade to Free |
| `expired` | Trial expired without payment | Downgrade to Free |

### 3.2 Subscription Lifecycle Rules

1. **One active subscription per org**: An organization can have only one subscription with status in (`created`, `trialing`, `active`, `past_due`, `canceling`). Historical records with `canceled` / `expired` are kept.

2. **Free plan**: Organizations on the Free plan have **no subscription record** — the absence of an active subscription means Free tier. This simplifies queries and avoids creating subscriptions for orgs that never upgrade.

3. **Trial**:
   - Available on first subscription only (never re-trialed).
   - Duration comes from `plan.trialDays`.
   - Full plan features are unlocked during trial.
   - 3 days before trial end: send reminder email.
   - Trial end: if payment method is on file, charge and transition to `active`; otherwise transition to `expired` → org falls back to Free.

4. **Upgrade (immediate)**:
   - Prorated: unused time on the old plan is credited; new plan is charged for the remaining period.
   - New features and limits are available immediately.
   - If new limits are higher than old, no action needed.
   - Stripe handles proration automatically.

5. **Downgrade (at period end)**:
   - Takes effect at the end of the current billing period.
   - Until then, the organization keeps the higher plan's features.
   - At period end: enforce new plan's limits. If usage exceeds new limits, the org enters a **grace period** (30 days to reduce usage). During the grace period, existing data is preserved but new records above the limit cannot be created.

6. **Cancellation**:
   - `cancelAtPeriodEnd = true`: features remain until `currentPeriodEnd`, then status → `canceled`.
   - Immediate cancellation: features removed immediately, partial refund issued based on unused time.
   - Canceled orgs revert to the Free plan.
   - Re-subscribing after cancellation creates a new subscription record.

7. **Payment failure (past_due)**:
   - Stripe retries according to its smart retry schedule (default: 3 attempts over ~3 weeks).
   - During `past_due`, features remain active (grace period).
   - After all retries exhausted: status → `canceled`, org falls back to Free.
   - Email notifications at each retry attempt.

8. **Renewal**:
   - Automatic renewal via Stripe at `currentPeriodEnd`.
   - On successful payment: update `currentPeriodStart` / `currentPeriodEnd`.
   - On failure: transition to `past_due`.

### 3.3 Subscription Events

| Event | Trigger | Description |
|-------|---------|-------------|
| `subscription.created` | User subscribes | New subscription created |
| `subscription.trial_started` | Trial begins | Trial period started |
| `subscription.trial_ending` | 3 days before trial end | Reminder sent |
| `subscription.trial_ended` | Trial expires | Charged or expired |
| `subscription.activated` | Payment confirmed | Plan fully active |
| `subscription.upgraded` | Plan change (higher tier) | Immediate upgrade |
| `subscription.downgraded` | Plan change (lower tier) | Scheduled downgrade |
| `subscription.renewal_success` | Auto-renewal payment | Period extended |
| `subscription.renewal_failed` | Payment failed | Entered past_due |
| `subscription.cancel_requested` | User requests cancel | Cancel at period end |
| `subscription.canceled` | Period ends after cancel | Subscription ended |
| `subscription.reactivated` | User reverses cancellation | Before period end |
| `subscription.addon_added` | Add-on purchased | Add-on attached |
| `subscription.addon_removed` | Add-on removed | Add-on detached |
| `subscription.expired` | Trial expired, no payment | Fell back to Free |

---

## 4. API Contract

### 4.1 Organization-Scoped Endpoints (owner only unless noted)

| ID | Method | Path | Purpose | Who |
|----|--------|------|---------|-----|
| SUB-GET | GET | `/organizations/:orgId/subscription` | Get current subscription details | Any member |
| SUB-CREATE | POST | `/organizations/:orgId/subscription` | Subscribe to a plan | Owner |
| SUB-UPGRADE | POST | `/organizations/:orgId/subscription/upgrade` | Upgrade to a higher plan | Owner |
| SUB-DOWNGRADE | POST | `/organizations/:orgId/subscription/downgrade` | Downgrade to a lower plan | Owner |
| SUB-CANCEL | POST | `/organizations/:orgId/subscription/cancel` | Cancel the subscription | Owner |
| SUB-REACTIVATE | POST | `/organizations/:orgId/subscription/reactivate` | Reverse a pending cancellation | Owner |
| SUB-ADDON-ADD | POST | `/organizations/:orgId/subscription/addons` | Add an add-on | Owner |
| SUB-ADDON-REMOVE | DELETE | `/organizations/:orgId/subscription/addons/:addonId` | Remove an add-on | Owner |
| SUB-EVENTS | GET | `/organizations/:orgId/subscription/events` | List subscription history/events | Owner |
| SUB-PREVIEW | POST | `/organizations/:orgId/subscription/preview` | Preview price/proration for a plan change | Owner |

### 4.2 Webhook Endpoint

| ID | Method | Path | Purpose |
|----|--------|------|---------|
| SUB-WEBHOOK | POST | `/webhooks/stripe` | Receive Stripe webhook events |

---

## 5. Endpoint Details

### 5.1 SUB-CREATE — Subscribe to a Plan

**Request:**
```typescript
CreateSubscriptionSchema = z.object({
  planCode: z.string(),              // Plan code (e.g., "starter")
  billingInterval: z.enum(["monthly", "yearly"]),
  paymentMethodId: z.string().optional(), // Stripe PaymentMethod ID (not needed for trial-only)
})
```

**Response (201):**
```typescript
SubscriptionDtoSchema = z.object({
  id: z.string().uuid(),
  planCode: z.string(),
  planName: z.string(),
  status: SubscriptionStatusSchema,
  billingInterval: z.enum(["monthly", "yearly"]),
  currentPeriodStart: z.string().datetime(),
  currentPeriodEnd: z.string().datetime(),
  trialEnd: z.string().datetime().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  addons: z.array(SubscriptionAddonDtoSchema),
})
```

**Errors:**
| Code | HTTP | When |
|------|------|------|
| `SUBSCRIPTION_ALREADY_EXISTS` | 409 | Org already has an active subscription |
| `SUBSCRIPTION_PLAN_NOT_FOUND` | 404 | Invalid plan code |
| `SUBSCRIPTION_PAYMENT_REQUIRED` | 402 | No payment method and no trial available |
| `SUBSCRIPTION_PAYMENT_FAILED` | 402 | Stripe declined the payment |

### 5.2 SUB-UPGRADE — Upgrade Plan

**Request:**
```typescript
UpgradeSubscriptionSchema = z.object({
  planCode: z.string(),
  billingInterval: z.enum(["monthly", "yearly"]).optional(), // keep current if not specified
})
```

**Business logic:**
1. Validate new plan tier > current plan tier.
2. Calculate proration via Stripe.
3. Charge the difference immediately.
4. Update subscription to new plan.
5. New features/limits active immediately.

**Errors:**
| Code | HTTP | When |
|------|------|------|
| `SUBSCRIPTION_NOT_FOUND` | 404 | No active subscription |
| `SUBSCRIPTION_CANNOT_UPGRADE` | 409 | Target plan is same tier or lower |
| `SUBSCRIPTION_PAYMENT_FAILED` | 402 | Proration charge failed |

### 5.3 SUB-DOWNGRADE — Downgrade Plan

**Request:**
```typescript
DowngradeSubscriptionSchema = z.object({
  planCode: z.string(),
  billingInterval: z.enum(["monthly", "yearly"]).optional(),
})
```

**Business logic:**
1. Validate new plan tier < current plan tier.
2. Schedule the downgrade for `currentPeriodEnd`.
3. Current features remain until period end.
4. At period end, check usage against new limits.

**Errors:**
| Code | HTTP | When |
|------|------|------|
| `SUBSCRIPTION_NOT_FOUND` | 404 | No active subscription |
| `SUBSCRIPTION_CANNOT_DOWNGRADE` | 409 | Target plan is same tier or higher |

### 5.4 SUB-CANCEL — Cancel Subscription

**Request:**
```typescript
CancelSubscriptionSchema = z.object({
  immediate: z.boolean().optional().default(false),
  reason: z.string().max(500).optional(),
})
```

### 5.5 SUB-PREVIEW — Preview Plan Change

**Request:**
```typescript
PreviewSubscriptionChangeSchema = z.object({
  planCode: z.string(),
  billingInterval: z.enum(["monthly", "yearly"]).optional(),
})
```

**Response (200):**
```typescript
SubscriptionPreviewDtoSchema = z.object({
  currentPlan: z.string(),
  newPlan: z.string(),
  changeType: z.enum(["upgrade", "downgrade"]),
  proratedCredit: z.string(),       // amount credited for unused current plan
  newPlanCharge: z.string(),         // charge for new plan (remaining period or full)
  netAmount: z.string(),             // amount to pay now (can be negative = credit)
  effectiveDate: z.string().datetime(), // when the change takes effect
  currency: z.string(),
})
```

---

## 6. Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `SUBSCRIPTION_NOT_FOUND` | 404 | No active subscription for this org |
| `SUBSCRIPTION_ALREADY_EXISTS` | 409 | Org already has an active subscription |
| `SUBSCRIPTION_PLAN_NOT_FOUND` | 404 | Plan code does not exist or is inactive |
| `SUBSCRIPTION_CANNOT_UPGRADE` | 409 | Target plan is not higher tier |
| `SUBSCRIPTION_CANNOT_DOWNGRADE` | 409 | Target plan is not lower tier |
| `SUBSCRIPTION_CANNOT_CANCEL` | 409 | Subscription is not in a cancelable state |
| `SUBSCRIPTION_CANNOT_REACTIVATE` | 409 | Subscription is not pending cancellation |
| `SUBSCRIPTION_PAYMENT_REQUIRED` | 402 | Payment method required |
| `SUBSCRIPTION_PAYMENT_FAILED` | 402 | Payment was declined |
| `SUBSCRIPTION_TRIAL_ALREADY_USED` | 409 | Org already used their trial |
| `SUBSCRIPTION_ADDON_NOT_FOUND` | 404 | Add-on does not exist or is inactive |
| `SUBSCRIPTION_ADDON_NOT_COMPATIBLE` | 409 | Add-on not available on current plan |
| `SUBSCRIPTION_OWNER_ONLY` | 403 | Only the org owner can manage subscriptions |

---

## 7. Frontend Requirements

### 7.1 Subscription Management Page (`/:org/settings/subscription`)

**Current subscription card:**
- Plan name, billing interval, next renewal date.
- Status badge (active, trialing, past_due, canceling).
- If trialing: days remaining, prominent "Add payment method" CTA.
- If past_due: warning banner with retry information.
- If canceling: notice showing when access ends, "Reactivate" button.

**Plan change section:**
- Side-by-side plan comparison.
- Preview proration before confirming.
- Payment method selection (or entry via Stripe Elements).
- Confirmation dialog with summary.

**Add-ons section:**
- Current add-ons with quantity and "Remove" button.
- Available add-ons with "Add" button and pricing.

**Billing history link:**
- Navigate to billing page (see [Billing SPEC](../billing/SPEC.md)).

### 7.2 Trial Banner
- Shown app-wide when `status = 'trialing'`.
- "X days left in your trial. Upgrade to keep your features."
- Dismissible but re-appears daily in the last 3 days.

### 7.3 Downgrade Warning Dialog
- Triggered when downgrading.
- Lists features/limits that will be lost or reduced.
- Shows current usage vs. new limits (highlights over-limit items).
- "I understand" confirmation required.

### 7.4 Cancellation Flow
- Multi-step: reason selection → feature reminder → confirmation.
- Offer alternatives: "Would you like to try a lower plan instead?"
- Final confirmation with clear end date.

---

## 8. Webhook Events Handled

| Stripe Event | Action |
|--------------|--------|
| `customer.subscription.created` | Confirm creation, set status |
| `customer.subscription.updated` | Update period, status changes |
| `customer.subscription.deleted` | Mark as canceled |
| `customer.subscription.trial_will_end` | Send reminder email |
| `invoice.payment_succeeded` | Activate/renew subscription |
| `invoice.payment_failed` | Mark as past_due |
| `invoice.finalized` | Generate our internal invoice record |

---

## 9. Permissions

| Operation | Required | Notes |
|-----------|----------|-------|
| View subscription | `read:organization` | Any member can see plan info |
| Subscribe/upgrade/downgrade | Owner only | `organization_users.type = 'owner'` |
| Cancel/reactivate | Owner only | |
| Manage add-ons | Owner only | |
| View events | Owner only | Contains billing details |

---

## 10. Cross-Module Dependencies

| Module | Direction | What |
|--------|-----------|------|
| Plan | reads | Plan definitions, features, limits, prices |
| Payment | uses | Stripe customer and payment method management |
| Billing | triggers | Invoice generation on subscription events |
| Feature Gate | reads | Feature Gate queries the active subscription |
| Organization | scoped by | One subscription per organization |
| Activity Log | writes | All subscription events are logged |
