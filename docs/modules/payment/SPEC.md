# Payment Module — Specification

> **Version**: 1.0 · 2026-11-25
> **Status**: Specification
> **Parent**: [SaaS Overview](../SAAS-OVERVIEW.md)

---

## 1. Purpose

The Payment module handles all **money movement** between the organization and the platform through Stripe. It manages payment methods (cards, bank accounts, regional methods), processes charges, handles refunds, and receives Stripe webhooks. It does **not** manage subscriptions or invoices — those are handled by the [Subscription](../subscription/SPEC.md) and [Billing](../billing/SPEC.md) modules respectively.

---

## 2. Domain Model

### 2.1 Payment Method Entity

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `orgId` | UUID | FK → organizations |
| `stripePaymentMethodId` | text | Stripe PaymentMethod ID (`pm_xxx`) |
| `type` | enum | `card`, `bank_account`, `sepa_debit`, `mada` (Saudi debit) |
| `isDefault` | boolean | Whether this is the default payment method |
| `last4` | char(4) | Last 4 digits (card) or account number |
| `brand` | text | null | Card brand (`visa`, `mastercard`, `mada`, etc.) |
| `expMonth` | integer | null | Card expiry month |
| `expYear` | integer | null | Card expiry year |
| `holderName` | text | null | Cardholder / account holder name |
| `country` | char(2) | null | Card/bank country |
| `createdAt` | timestamp | Added date |
| `updatedAt` | timestamp | Last update |

> **Note**: We store only display metadata (last4, brand, expiry). The actual payment credentials are held exclusively by Stripe. We never store full card numbers, CVVs, or bank account numbers.

### 2.2 Payment Entity

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `orgId` | UUID | FK → organizations |
| `subscriptionId` | UUID | null | FK → subscriptions (null for one-time payments) |
| `invoiceId` | UUID | null | FK → invoices (linked after invoice generation) |
| `stripePaymentIntentId` | text | Stripe PaymentIntent ID (`pi_xxx`) |
| `stripeChargeId` | text | null | Stripe Charge ID |
| `amount` | numeric(12,2) | Gross amount |
| `currency` | char(3) | ISO 4217 |
| `status` | enum | `pending`, `processing`, `succeeded`, `failed`, `refunded`, `partially_refunded` |
| `failureReason` | text | null | Stripe decline reason |
| `refundedAmount` | numeric(12,2) | Total refunded so far |
| `metadata` | jsonb | null | Stripe metadata |
| `createdAt` | timestamp | Created |
| `updatedAt` | timestamp | Last status change |

### 2.3 Refund Entity

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `paymentId` | UUID | FK → payments |
| `stripeRefundId` | text | Stripe Refund ID (`re_xxx`) |
| `amount` | numeric(12,2) | Refund amount |
| `reason` | enum | `requested_by_customer`, `duplicate`, `fraudulent`, `plan_change` |
| `status` | enum | `pending`, `succeeded`, `failed` |
| `createdAt` | timestamp | Initiated |

---

## 3. Business Rules

### 3.1 Payment Methods
1. An organization must have at least one payment method before subscribing to a paid plan (unless a trial is available).
2. The default payment method is used for subscription charges and renewals.
3. When a payment method is removed, if it was the default and others exist, the most recently added becomes the new default.
4. Payment methods are attached to the **Stripe Customer** (created per organization).
5. Card validation happens client-side via Stripe Elements — we never see raw card numbers.

### 3.2 Stripe Customer
- Each organization gets one Stripe Customer, created lazily on first subscription or payment method addition.
- The `stripeCustomerId` is stored on the `subscriptions` table (and cached on the org if needed).
- Customer metadata includes `orgId` and `orgCode` for Stripe dashboard lookups.

### 3.3 Payments
1. Subscription payments are created automatically by Stripe and recorded via webhooks.
2. One-time payments (future: marketplace purchases, one-time add-ons) are created via PaymentIntents.
3. All amounts are in the billing currency (USD by default; localized currencies may be supported later).
4. Failed payments trigger the subscription's `past_due` flow.

### 3.4 Refunds
1. Refunds are issued for: immediate cancellation (prorated), duplicate charges, plan change credits.
2. Partial refunds are supported.
3. Refunds are processed through Stripe; our refund record tracks the status.
4. Refund processing time is communicated to the user (5-10 business days).

### 3.5 Stripe Webhook Security
1. All webhooks are verified using the Stripe webhook signing secret.
2. Events are **idempotent** — processing the same event twice must not duplicate records.
3. The `stripeEventId` is stored to detect duplicates.
4. Webhook endpoint: `POST /webhooks/stripe` (no auth — verified by signature).

---

## 4. API Contract

### 4.1 Payment Method Endpoints (owner only)

| ID | Method | Path | Purpose |
|----|--------|------|---------|
| PM-LIST | GET | `/organizations/:orgId/payment-methods` | List payment methods |
| PM-SETUP | POST | `/organizations/:orgId/payment-methods/setup` | Create a Stripe SetupIntent for adding a new method |
| PM-ATTACH | POST | `/organizations/:orgId/payment-methods` | Attach a confirmed payment method |
| PM-SET-DEFAULT | PATCH | `/organizations/:orgId/payment-methods/:id/default` | Set as default |
| PM-DELETE | DELETE | `/organizations/:orgId/payment-methods/:id` | Remove a payment method |

### 4.2 Payment Endpoints

| ID | Method | Path | Purpose |
|----|--------|------|---------|
| PAY-LIST | GET | `/organizations/:orgId/payments` | List payment history |
| PAY-GET | GET | `/organizations/:orgId/payments/:id` | Get payment details |
| PAY-REFUND | POST | `/organizations/:orgId/payments/:id/refund` | Issue a refund |

### 4.3 Webhook Endpoint

| ID | Method | Path | Purpose |
|----|--------|------|---------|
| WEBHOOK-STRIPE | POST | `/webhooks/stripe` | Stripe event receiver |

---

## 5. Endpoint Details

### 5.1 PM-SETUP — Create Setup Intent

Returns a Stripe `client_secret` for the frontend to use with Stripe Elements to securely collect payment details.

**Response (200):**
```typescript
SetupIntentResponseSchema = z.object({
  clientSecret: z.string(),
  stripeCustomerId: z.string(),
})
```

### 5.2 PM-ATTACH — Attach Payment Method

Called after the frontend confirms the SetupIntent via Stripe Elements.

**Request:**
```typescript
AttachPaymentMethodSchema = z.object({
  stripePaymentMethodId: z.string(),  // pm_xxx from Stripe Elements
  setAsDefault: z.boolean().optional().default(true),
})
```

**Response (201):**
```typescript
PaymentMethodDtoSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["card", "bank_account", "sepa_debit", "mada"]),
  isDefault: z.boolean(),
  last4: z.string(),
  brand: z.string().nullable(),
  expMonth: z.number().int().nullable(),
  expYear: z.number().int().nullable(),
  holderName: z.string().nullable(),
})
```

### 5.3 PAY-REFUND — Issue Refund

**Request:**
```typescript
RefundPaymentSchema = z.object({
  amount: z.string().optional(),   // partial refund; omit for full refund
  reason: z.enum(["requested_by_customer", "duplicate", "fraudulent"]),
})
```

---

## 6. Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `PAYMENT_METHOD_NOT_FOUND` | 404 | Payment method does not exist |
| `PAYMENT_METHOD_IN_USE` | 409 | Cannot delete the only payment method on an active subscription |
| `PAYMENT_METHOD_SETUP_FAILED` | 400 | Stripe SetupIntent creation failed |
| `PAYMENT_NOT_FOUND` | 404 | Payment does not exist |
| `PAYMENT_ALREADY_REFUNDED` | 409 | Payment already fully refunded |
| `PAYMENT_REFUND_EXCEEDS_AMOUNT` | 422 | Refund amount exceeds remaining refundable amount |
| `PAYMENT_REFUND_FAILED` | 400 | Stripe refund processing failed |
| `PAYMENT_OWNER_ONLY` | 403 | Only the org owner can manage payments |
| `PAYMENT_WEBHOOK_INVALID_SIGNATURE` | 400 | Webhook signature verification failed |

---

## 7. Frontend Requirements

### 7.1 Payment Methods Page (`/:org/settings/billing/payment-methods`)

- List of saved payment methods with card icon, brand, last4, expiry.
- Default badge on the primary method.
- "Add payment method" button → opens Stripe Elements modal.
- "Set as default" / "Remove" actions per method.
- Cannot remove the last method if subscription is active (error toast).

### 7.2 Stripe Elements Integration

- Use `@stripe/react-stripe-js` and `@stripe/stripe-js`.
- Card Element or Payment Element (supports cards + regional methods).
- Styling matches the app's design tokens (light/dark mode, semantic colors).
- Loading states while Stripe.js initializes.
- Validation errors shown inline.
- RTL support for Arabic users.

### 7.3 Payment History Page (`/:org/settings/billing/payments`)

- Table: date, description, amount, status, actions.
- Status badges: succeeded (green), pending (yellow), failed (red), refunded (gray).
- "View receipt" link (Stripe-hosted receipt URL).
- "Refund" action (owner only, for succeeded payments).
- Pagination with date range filter.

### 7.4 Refund Dialog

- Shows payment details.
- Full or partial refund option.
- Amount input for partial refunds (validated against remaining amount).
- Reason selection dropdown.
- Confirmation with processing time notice.

---

## 8. Webhook Events Handled

| Stripe Event | Action |
|--------------|--------|
| `payment_intent.succeeded` | Record payment as succeeded |
| `payment_intent.payment_failed` | Record failure, notify org owner |
| `charge.refunded` | Update payment status, record refund |
| `payment_method.attached` | Sync payment method metadata |
| `payment_method.detached` | Remove from our records |
| `payment_method.updated` | Update card expiry / details |
| `setup_intent.succeeded` | (handled client-side, then PM-ATTACH) |
| `customer.created` | Log Stripe customer creation |

---

## 9. Security

### 9.1 PCI Compliance
- **We are SAQ A** compliant: card data never touches our servers.
- Stripe Elements handles all card input.
- We only store Stripe token IDs and display metadata.
- No card numbers, CVVs, or full bank account numbers in our database.

### 9.2 Webhook Verification
- Every incoming webhook is verified against `STRIPE_WEBHOOK_SECRET`.
- Unverified requests return 400 immediately.
- Event IDs are checked for idempotency.

### 9.3 Access Control
- Payment method and payment history endpoints require `organization_users.type = 'owner'`.
- Webhook endpoint has no auth (relies on Stripe signature).

---

## 10. Environment Configuration

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (sent to frontend) |
| `STRIPE_WEBHOOK_SECRET` | Webhook endpoint signing secret |
| `STRIPE_API_VERSION` | Stripe API version (pinned) |

---

## 11. Cross-Module Dependencies

| Module | Direction | What |
|--------|-----------|------|
| Subscription | Payment ← Subscription | Subscription triggers payments via Stripe |
| Billing | Payment → Billing | Payments are linked to invoices |
| Organization | scoped by | Payment methods and payments belong to an org |
