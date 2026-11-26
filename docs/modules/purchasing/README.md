# Purchasing overview

`OVERVIEW-SPEC.md` is the original combined purchasing specification (PO, shipments, receipts, bills, payments). It was split into three module specs, which are the ones to implement:

- [`../purchase-order/SPEC.md`](../purchase-order/SPEC.md)
- [`../purchase-receipt/SPEC.md`](../purchase-receipt/SPEC.md)
- [`../vendor-bill-payment/SPEC.md`](../vendor-bill-payment/SPEC.md)

Use the overview only for cross-module context (journal entries, reporting). Where it disagrees with a split spec, the split spec wins; log the difference in that module's PROGRESS.md.
