# Billing Module — Specification

> **Version**: 1.0 · 2026-11-25
> **Status**: Specification
> **Parent**: [SaaS Overview](../SAAS-OVERVIEW.md)

---

## 1. Purpose

The Billing module manages **invoices, billing history, credits, and proration calculations**. It is the financial record-keeping layer that sits alongside the Payment module. While Payment handles money movement, Billing handles the accounting of what was charged, why, and what's owed.

---

## 2. Domain Model

### 2.1 Invoice Entity

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `orgId` | UUID | FK → organizations |
| `subscriptionId` | UUID | null | FK → subscriptions |
| `stripeInvoiceId` | text | null | Stripe Invoice ID (`in_xxx`) |
| `number` | text | Sequential invoice number (e.g., `INV-2026-0001`) |
| `status` | enum | `draft`, `open`, `paid`, `void`, `uncollectible` |
| `subtotal` | numeric(12,2) | Before tax/discounts |
| `tax` | numeric(12,2) | Tax amount |
| `discount` | numeric(12,2) | Discount amount |
| `total` | numeric(12,2) | Final amount |
| `amountPaid` | numeric(12,2) | Amount actually paid |
| `amountDue` | numeric(12,2) | Remaining amount due |
| `currency` | char(3) | ISO 4217 |
| `periodStart` | timestamp | Billing period start |
| `periodEnd` | timestamp | Billing period end |
| `dueDate` | timestamp | null | When payment is due |
| `paidAt` | timestamp | null | When marked as paid |
| `hostedInvoiceUrl` | text | null | Stripe-hosted invoice URL |
| `invoicePdf` | text | null | Stripe-hosted PDF URL |
| `metadata` | jsonb | null | Additional details |
| `createdAt` | timestamp | Created |
| `updatedAt` | timestamp | Last update |

### 2.2 Invoice Line Item Entity

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `invoiceId` | UUID | FK → invoices |
| `description` | text | Line item description |
| `quantity` | integer | Quantity |
| `unitAmount` | numeric(12,2) | Price per unit |
| `amount` | numeric(12,2) | Total (quantity × unitAmount) |
| `type` | enum | `subscription`, `addon`, `proration_credit`, `proration_charge`, `one_time` |
| `periodStart` | timestamp | null | Service period start |
| `periodEnd` | timestamp | null | Service period end |
| `metadata` | jsonb | null | Additional details |

### 2.3 Credit Entity

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `orgId` | UUID | FK → organizations |
| `amount` | numeric(12,2) | Credit amount (positive) |
| `remainingAmount` | numeric(12,2) | Unused credit |
| `currency` | char(3) | ISO 4217 |
| `reason` | enum | `proration`, `refund`, `courtesy`, `promotion` |
| `description` | text | null | Human-readable reason |
| `expiresAt` | timestamp | null | Expiry date (null = never) |
| `createdAt` | timestamp | Created |

### 2.4 Credit Application Entity

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `creditId` | UUID | FK → credits |
| `invoiceId` | UUID | FK → invoices |
| `amount` | numeric(12,2) | Amount applied from this credit to this invoice |
| `createdAt` | timestamp | Applied |

---

## 3. Business Rules

### 3.1 Invoice Generation
1. Invoices are generated automatically by Stripe and synced to our database via webhooks.
2. For each billing period, one invoice is created containing:
   - Base plan subscription line item.
   - Add-on line items (one per active add-on).
   - Proration credits/charges (on plan changes).
3. Invoice numbers are sequential per organization: `INV-{YEAR}-{SEQUENCE}`.
4. We generate our own internal invoice record even though Stripe hosts the canonical one.

### 3.2 Proration
1. **Upgrade (immediate)**: Stripe calculates the unused portion of the current plan as a credit and charges for the new plan from the change date to `currentPeriodEnd`.
2. **Downgrade (at period end)**: No proration — the current period runs at the old price, and the new price starts at the next period.
3. **Add-on added mid-period**: Prorated charge for the remaining days in the period.
4. **Add-on removed mid-period**: Prorated credit applied to the next invoice.

### 3.3 Credits
1. Credits are created for: proration remainders, courtesy adjustments, promotional offers.
2. Credits are automatically applied to the next invoice.
3. Credits can expire (promotional credits typically expire after 12 months).
4. Credit application order: soonest-to-expire first, then oldest.

### 3.4 Tax
1. Tax calculation is handled by Stripe Tax (or a future tax integration).
2. Tax rates depend on the organization's country and the product type.
3. Tax is shown separately on invoices.
4. Organizations can provide a tax ID (VAT/GST) for B2B exemptions.

### 3.5 Invoice Lifecycle
```
draft → open → paid
                 ↓
               void (manual cancellation)
                 ↓
           uncollectible (all retry attempts failed)
```

---

## 4. API Contract

### 4.1 Invoice Endpoints (owner only unless noted)

| ID | Method | Path | Purpose |
|----|--------|------|---------|
| INV-LIST | GET | `/organizations/:orgId/invoices` | List invoices (paginated) |
| INV-GET | GET | `/organizations/:orgId/invoices/:id` | Get invoice with line items |
| INV-DOWNLOAD | GET | `/organizations/:orgId/invoices/:id/pdf` | Redirect to Stripe-hosted PDF |
| INV-UPCOMING | GET | `/organizations/:orgId/invoices/upcoming` | Preview the next invoice |

### 4.2 Credit Endpoints

| ID | Method | Path | Purpose |
|----|--------|------|---------|
| CREDIT-LIST | GET | `/organizations/:orgId/credits` | List active credits |
| CREDIT-BALANCE | GET | `/organizations/:orgId/credits/balance` | Total available credit balance |

### 4.3 Billing Settings Endpoints

| ID | Method | Path | Purpose |
|----|--------|------|---------|
| BILLING-INFO | GET | `/organizations/:orgId/billing` | Get billing info (address, tax ID) |
| BILLING-UPDATE | PATCH | `/organizations/:orgId/billing` | Update billing info |

---

## 5. Endpoint Details

### 5.1 INV-LIST — List Invoices

**Query:**
```typescript
InvoiceListQuerySchema = z.object({
  status: z.enum(["draft", "open", "paid", "void", "uncollectible"]).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
  from: z.string().datetime().optional(),   // filter by period
  to: z.string().datetime().optional(),
})
```

**Response (200):**
```typescript
InvoiceListResponseSchema = z.object({
  items: z.array(InvoiceDtoSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
})

InvoiceDtoSchema = z.object({
  id: z.string().uuid(),
  number: z.string(),
  status: InvoiceStatusSchema,
  total: z.string(),
  currency: z.string(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  paidAt: z.string().datetime().nullable(),
  hostedInvoiceUrl: z.string().nullable(),
  invoicePdf: z.string().nullable(),
  lineItems: z.array(InvoiceLineItemDtoSchema),
})
```

### 5.2 INV-UPCOMING — Preview Next Invoice

Returns what the next invoice will look like based on the current subscription, add-ons, and any pending changes (scheduled downgrades, etc.).

**Response (200):**
```typescript
UpcomingInvoiceDtoSchema = z.object({
  subtotal: z.string(),
  tax: z.string(),
  discount: z.string(),
  total: z.string(),
  currency: z.string(),
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  lineItems: z.array(InvoiceLineItemDtoSchema),
  creditsApplied: z.string(),   // total credits that will be applied
})
```

### 5.3 BILLING-UPDATE — Update Billing Information

**Request:**
```typescript
UpdateBillingInfoSchema = z.object({
  companyName: z.string().max(200).optional(),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().length(2).optional(),
  taxId: z.string().max(50).optional(),
  taxIdType: z.enum(["vat", "gst", "ein", "other"]).optional(),
  email: z.string().email().optional(),   // billing contact email
})
```

---

## 6. Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `INVOICE_NOT_FOUND` | 404 | Invoice does not exist for this org |
| `INVOICE_NO_SUBSCRIPTION` | 404 | No active subscription to preview |
| `BILLING_INFO_INVALID_TAX_ID` | 422 | Tax ID format is invalid for the given type |
| `BILLING_OWNER_ONLY` | 403 | Only the org owner can access billing |

---

## 7. Frontend Requirements

### 7.1 Billing Overview Page (`/:org/settings/billing`)

**Layout:**
- **Billing info card**: Company name, address, tax ID. "Edit" button.
- **Current plan summary** with link to subscription page.
- **Credit balance** card (if any credits exist).
- **Recent invoices** table (last 5) with "View all" link.
- **Payment methods** summary with link to payment methods page.

### 7.2 Invoice List Page (`/:org/settings/billing/invoices`)

**Data table:**
| Column | Description |
|--------|-------------|
| Invoice # | `INV-2026-0001` format |
| Date | Period start date |
| Amount | Total with currency symbol |
| Status | Badge: paid (green), open (blue), void (gray), uncollectible (red) |
| Actions | View, Download PDF |

- Filters: status, date range.
- Pagination.

### 7.3 Invoice Detail Page (`/:org/settings/billing/invoices/:id`)

- Invoice header: number, date, status, org billing info.
- Line items table: description, quantity, unit price, amount.
- Subtotal, tax, discount, credits applied, total.
- "Download PDF" button.
- "Pay now" button for open invoices.

### 7.4 Billing Info Edit Dialog

- Form: company name, address fields, tax ID with type selector.
- Billing email field.
- Save → updates Stripe Customer and our record.

### 7.5 Credit Balance Section

- Shows total available credit.
- Expandable list of individual credits with reason, amount, remaining, expiry.
- "Credits are automatically applied to your next invoice."

---

## 8. Webhook Events That Generate Invoices

| Stripe Event | Action |
|--------------|--------|
| `invoice.created` | Create draft invoice record |
| `invoice.finalized` | Update status to open, record line items |
| `invoice.paid` | Update status to paid, record payment link |
| `invoice.voided` | Update status to void |
| `invoice.marked_uncollectible` | Update status to uncollectible |
| `invoice.updated` | Sync amounts, discounts, tax |
| `customer.tax_id.created` | Record tax ID on billing info |

---

## 9. Cross-Module Dependencies

| Module | Direction | What |
|--------|-----------|------|
| Subscription | Billing ← Subscription | Subscription events trigger invoice generation |
| Payment | Billing ← Payment | Payments are linked to invoices |
| Plan | reads | Plan prices for line item amounts |
| Organization | scoped by | Invoices and credits belong to an org |
