# PROVIDER-SPIKE: payment provider candidates for Q5 (S0-03)

Date: 2026-11-28. All facts re-verified against the linked sources on that date; provider pages change, so re-check before signing.

Q5 target: (b) Stripe + one Egyptian processor, built in the order Stripe, then local, with manual bank transfer as a fallback adapter.

## The material finding

**Stripe cannot onboard an Egypt-registered business.** Egypt is absent from [stripe.com/global](https://stripe.com/global) in every category (supported, preview, extended network; the extended network is five Paystack markets: Côte d'Ivoire, Ghana, Kenya, Nigeria, South Africa). The documented route is a US LLC + EIN + US bank account, with Stripe reviewing the application ([requirements walkthrough, Nov 2026](https://foundlie.com/blog/stripe-guide-for-egyptians), [regional check, Oct 2026](https://eazybizee.com/stripe-egypt/)). Stripe does list the **UAE**. So "Stripe first" only works after a US (or other supported) entity exists. The launch processor must be the Egyptian one; Stripe stays the international/USD option for later.

## Comparison

| | **Paymob** | **Fawry (FawryPay)** | **Stripe** (via US entity) | **Manual bank transfer** |
|---|---|---|---|---|
| Onboard from Egypt | Yes, Egyptian processor | Yes, Egyptian processor | **No** — needs US/supported-country entity ([source](https://stripe.com/global)) | n/a (owner's own bank) |
| Currencies / methods | EGP native; local + international cards, mobile wallets, kiosks (Aman, Masary), installments, COD ([source](https://origin.paymob.com/en/online-payment)) | EGP native; cards, wallets, Pay@Fawry reference (cash at POS), valU BNPL ([source](https://www.fawry.com/business/acceptance/online-checkout/)) | USD and 100+ currencies; cards, wallets, local methods | EGP bank transfer / InstaPay |
| Subscriptions | **Full API**: plans with 7/15/30/60/90/180/360-day frequencies, MOTO integration, 3DS first charge then tokenized recurring, suspend/resume/cancel, retrial days, reminders ([source](https://developers.paymob.com/paymob-docs/developers/subscription)) | Recurring advertised on the business page; API details not published, scoped through sales ([source](https://www.fawry.com/business/acceptance/online-checkout/)) | **Stripe Billing**, the reference implementation: schedules, proration, dunning ([source](https://stripe.com/billing/pricing)) | Owner confirms proof in the admin panel; subscription activates on confirmation |
| Webhook model | Per-subscription `webhook_url`, POST JSON, HMAC-SHA-512 over `"{trigger_type}for{subscription_id}"` in the body; transaction callbacks use HMAC in the query string ([source](https://developers.paymob.com/paymob-docs/developers/subscription/hmac-calculation-for-subscription-callback)) | `orderWebHookUrl` per order, POST JSON, SHA-256 signature over concatenated fields + secure key ([source](https://developer.fawrystaging.com/docs/server-apis/create-payment-refno-apis)) | HTTPS POST JSON, `Stripe-Signature` header (HMAC + timestamp), raw body required for verification ([source](https://docs.stripe.com/webhooks)) | None |
| Workers compatibility | REST/JSON, Bearer token auth, HMAC-SHA-512 — all doable with fetch + Web Crypto | REST/JSON, SHA-256 hex — fetch + Web Crypto | Official SDK supports Workers; REST fallback trivial; raw-body verification works in Hono | n/a |
| Fees (published) | 2.75% + 3 EGP per card charge, no monthly fee, weekly settlement ([source](https://origin.paymob.com/en/pricing)) | Startup plan: 999 EGP setup, 499 EGP monthly minimum, 2.75% cards, 1.5% wallet QR, 2.75% reference code, 3 EGP/txn processing, weekly settlement ([source](https://fawrydigital.com/pricing)) | 2.9% + $0.30 domestic cards, +1.5% international, +0.7% Billing volume ([source](https://stripe.com/pricing), [Billing](https://stripe.com/billing/pricing)) | InstaPay: sender pays 0.1% (min EGP 0.50, max EGP 20); no receiver fee listed ([source](https://paymentreview.com/blog/egypt-card-instapay-payment-fees-2026/)) |
| Tax invoices | Merchant issues own invoices; Paymob page silent on fee VAT — budget 14% VAT on fees ([source](https://paymentreview.com/blog/egypt-card-instapay-payment-fees-2026/)) | Same: merchant invoices; ETA obligations below | US entity: US sales-tax rules, Stripe Tax available; Egyptian ETA regime does not apply to the US entity | Same as Paymob |

## Egyptian tax-invoice obligations (merchant side, independent of processor)

- **E-invoice (B2B/B2G)**: mandatory for all VAT-registered businesses since the final rollout (Dec 2022–Jul 2023). Invoices in ETA's JSON/XML, submitted to the ETA platform; no clearance wait before delivery ([source](https://www.theinvoicinghub.com/egypts-e-invoicing-mandate-understanding-the-eta-requirements/), [ETA](https://eta.gov.eg/ar/node/1381)).
- **E-receipt (B2C)**: phased by ETA decision; latest is phase 9 sub-phase 1 (Decision 361/2025, effective 15 Nov 2025). Obligation is by named taxpayer list — check the [ETA e-receipt inquiry](https://www.eta.gov.eg/ar/ereceipt-inquiry) with the company's tax number ([source](https://eta.gov.eg/ar/news/)).
- Standard VAT rate 14%. Kashier (not shortlisted) is the only gateway stating explicitly that VAT applies to its fee only; treat gateway fees as +14% VAT until contracts say otherwise ([source](https://paymentreview.com/blog/egypt-card-instapay-payment-fees-2026/)).
- This section is orientation, not tax advice; the owner's accountant confirms what applies to the company.

## Recommendation

1. **Launch processor: Paymob.** Only candidate with a fully documented, self-serve subscriptions API (plans, tokenized recurring, suspend/resume/cancel, per-subscription webhooks with HMAC), published flat pricing (2.75% + 3 EGP, no monthly fee) and native Egyptian onboarding. Fawry is the fallback local candidate: strong cash/POS reach, published startup pricing, but recurring API details sit behind sales.
2. **Stripe: keep as the international adapter** (Q5's target), sequenced behind forming a US entity. S6-02 builds it first in code only if the entity exists by then; otherwise the order flips to Paymob first — flag for the owner at the S6 gate.
3. **Manual bank transfer: third adapter** as designed (proof upload + platform-admin confirmation). No provider dependency.

The `BillingProvider` adapter shapes in the spec (provider-agnostic `ProviderEvent`s) hold for all three: Paymob's subscription callbacks and Stripe's invoice events both map onto the same subscription state machine.
