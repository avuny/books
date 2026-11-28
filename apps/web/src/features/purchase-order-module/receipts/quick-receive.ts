import {
  createPurchaseReceipt,
  createVendorBillFromReceipt,
  createVendorPayment,
  deletePurchaseReceipt,
  deleteVendorBill,
  deleteVendorPayment,
  postPurchaseReceipt,
  postVendorBill,
  postVendorPayment,
  reversePurchaseReceipt,
  reverseVendorBill,
} from "@/api"

type Receipt = Parameters<typeof createPurchaseReceipt>[2]

export class QuickReceiveError extends Error {
  cause: unknown
  /** True when an earlier step could not be undone, so something is left half done. */
  leftover: boolean
  /** True when the last request got no answer, so it may or may not have been applied. Nothing was undone. */
  ambiguous: boolean
  constructor(cause: unknown, leftover: boolean, ambiguous = false) {
    super("quick receive failed")
    this.cause = cause
    this.leftover = leftover
    this.ambiguous = ambiguous
  }
}

/** An axios error with no response: timeout, dropped connection or lost response. */
const noAnswer = (e: unknown) =>
  typeof e === "object" && e !== null && "isAxiosError" in e && (e as { response?: unknown }).response === undefined

type Idd = { data?: { id?: string; partyId?: string; total?: string; number?: string } }
const pick = (r: unknown) => (r as Idd).data ?? {}

/**
 * Receive and pay: receipt, post, bill, post, payment, post, one request per step.
 * One server request cannot do all of it (Cloudflare Workers stop a request that makes too many
 * database calls), so the steps run here and a failed step undoes the earlier ones.
 */
export async function quickReceive(
  orgId: string,
  orderId: string,
  receipt: Receipt,
  method: "cash" | "bank",
  supplierInvoiceNumber: string
) {
  const undo: Array<() => Promise<unknown>> = []
  const date = receipt.receiptDate
  try {
    const rc = pick(await createPurchaseReceipt(orgId, orderId, receipt))
    if (!rc.id) throw new Error("no receipt")
    undo.push(() => deletePurchaseReceipt(orgId, rc.id!))
    await postPurchaseReceipt(orgId, rc.id)
    undo[0] = () => reversePurchaseReceipt(orgId, rc.id!, { reason: "Quick receipt failed" })

    const bill = pick(await createVendorBillFromReceipt(orgId, { purchaseReceiptId: rc.id, supplierInvoiceNumber, invoiceDate: date, dueDate: date }))
    if (!bill.id) throw new Error("no bill")
    undo.push(() => deleteVendorBill(orgId, bill.id!))
    const posted = pick(await postVendorBill(orgId, bill.id))
    undo[1] = () => reverseVendorBill(orgId, bill.id!, { reason: "Quick receipt failed" })

    const pay = pick(
      await createVendorPayment(orgId, {
        partyId: posted.partyId ?? "",
        paymentDate: date,
        method,
        notes: `Quick receipt ${rc.number ?? ""}`.trim(),
        allocations: [{ vendorBillId: bill.id, amountMinor: posted.total ?? "0" }],
      })
    )
    if (!pay.id) throw new Error("no payment")
    undo.push(() => deleteVendorPayment(orgId, pay.id!))
    await postVendorPayment(orgId, pay.id)
    return { receiptId: rc.id, billId: bill.id, paymentId: pay.id }
  } catch (e) {
    // The last request may have been applied without us seeing it. Undoing blind could hit the wrong
    // state, so stop and tell the user to check before any retry. Closing the tab mid-way has the same limit.
    if (noAnswer(e)) throw new QuickReceiveError(e, true, true)
    let leftover = false
    for (const step of undo.reverse()) {
      try {
        await step()
      } catch {
        leftover = true
        break
      }
    }
    throw new QuickReceiveError(e, leftover)
  }
}
