import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { parseApiError } from "@workspace/ui/lib/api-error"
import { ConfirmDialog } from "@workspace/ui/blocks/data-table"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"

import {
  useCancelTransferMutation,
  useCloseShortTransferMutation,
  useDeleteTransferMutation,
  useDispatchTransferMutation,
  useReceiveTransferMutation,
  useReturnTransferMutation,
  useReverseReceiptMutation,
  useReverseTransferMutation,
  useTransfer,
  useTransferAbilities,
} from "./inventory-transfer-api"
import { TransferStatusBadge } from "./status-badge"

type Confirm = "dispatch" | "cancel" | "delete" | "returnRest" | "closeShort" | "reverseDispatch" | { receiptId: string }

export function TransferDetails({ orgId, transferId, onBack }: { orgId: string; transferId: string; onBack: () => void }) {
  const { t } = useTranslation("inventory-transfer")
  const { transfer, isLoading } = useTransfer(orgId, transferId)
  const ab = useTransferAbilities(orgId)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [receiving, setReceiving] = useState(false)
  const [qty, setQty] = useState<Record<string, string>>({})
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)

  const dispatch = useDispatchTransferMutation(orgId)
  const cancel = useCancelTransferMutation(orgId)
  const del = useDeleteTransferMutation(orgId)
  const receive = useReceiveTransferMutation(orgId)
  const ret = useReturnTransferMutation(orgId)
  const closeShort = useCloseShortTransferMutation(orgId)
  const reverse = useReverseTransferMutation(orgId)
  const reverseReceipt = useReverseReceiptMutation(orgId)
  const busy =
    dispatch.isPending || cancel.isPending || del.isPending || receive.isPending || ret.isPending ||
    closeShort.isPending || reverse.isPending || reverseReceipt.isPending

  if (isLoading) return <p className="text-sm text-muted-foreground">...</p>
  if (!transfer) return null

  const allocations = transfer.lines.flatMap((l) => l.allocations.map((a) => ({ line: l, a })))
  const inTransit = transfer.status === "IN_TRANSIT" || transfer.status === "PARTIALLY_RECEIVED"
  const anyReceived = allocations.some(({ a }) => Number(a.receivedBaseQty) > 0)
  const eventLine = (e: (typeof transfer.events)[number]) =>
    e.lines.map((l) => {
      const found = allocations.find(({ a }) => a.id === l.allocationId)
      return `${found?.line.itemName ?? ""}: ${l.baseQuantity}`
    }).join(", ")

  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
      setConfirm(null)
      setReceiving(false)
      setNote("")
    } catch (e) {
      const msg = parseApiError(e).message || "Error"
      setError(msg)
      toast.error(msg)
      setConfirm(null)
    }
  }
  const id = transfer.id

  const onConfirm = () => {
    if (confirm === null) return
    if (typeof confirm === "object") return run(() => reverseReceipt.mutateAsync({ orgId, id, receiptId: confirm.receiptId, data: {} as any }))
    switch (confirm) {
      case "dispatch": return run(() => dispatch.mutateAsync({ orgId, id, data: {} as any }))
      case "cancel": return run(() => cancel.mutateAsync({ orgId, id } as any))
      case "delete": return run(async () => { await del.mutateAsync({ orgId, id } as any); onBack() })
      case "returnRest": return run(() => ret.mutateAsync({ orgId, id, data: {} as any }))
      case "closeShort": return run(() => closeShort.mutateAsync({ orgId, id, data: {} as any }))
      case "reverseDispatch": return run(() => reverse.mutateAsync({ orgId, id, data: {} as any }))
    }
  }
  const confirmKey = confirm === null ? "dispatch" : typeof confirm === "object" ? "reverseReceipt" : confirm

  const openReceive = () => {
    setQty(Object.fromEntries(allocations.map(({ a }) => [a.id, a.pendingBaseQty])))
    setError(null)
    setReceiving(true)
  }
  const submitReceive = () => {
    const lines = allocations
      .map(({ a }) => ({ allocationId: a.id, baseQuantity: (qty[a.id] ?? "0").trim() }))
      .filter((l) => Number(l.baseQuantity) > 0)
    if (lines.length === 0) return setError(t("ui.validation.quantity"))
    return run(() => receive.mutateAsync({ orgId, id, data: { lines, note: note.trim() || undefined } as any }))
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="me-2 size-4 rtl:rotate-180" />
          {t("ui.actions.back")}
        </Button>
        <h1 className="text-xl font-semibold text-foreground">{transfer.number}</h1>
        <TransferStatusBadge status={transfer.status} />
      </div>
      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
        <div><span className="text-muted-foreground">{t("ui.details.from")}: </span>{transfer.sourceWarehouseName}</div>
        <div><span className="text-muted-foreground">{t("ui.details.to")}: </span>{transfer.destinationWarehouseName}</div>
        <div><span className="text-muted-foreground">{t("ui.fields.date")}: </span>{transfer.date}</div>
        {transfer.referenceNumber ? <div><span className="text-muted-foreground">{t("ui.fields.reference")}: </span>{transfer.referenceNumber}</div> : null}
        {transfer.description ? <div className="sm:col-span-2">{transfer.description}</div> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {transfer.status === "DRAFT" && ab.canDispatch ? <Button disabled={busy} onClick={() => setConfirm("dispatch")}>{t("ui.actions.dispatch")}</Button> : null}
        {transfer.status === "DRAFT" && ab.canCancel ? <Button variant="outline" disabled={busy} onClick={() => setConfirm("cancel")}>{t("ui.actions.cancel")}</Button> : null}
        {transfer.status === "DRAFT" && ab.canDelete ? <Button variant="outline" disabled={busy} onClick={() => setConfirm("delete")}>{t("ui.actions.delete")}</Button> : null}
        {inTransit && ab.canReceive ? <Button disabled={busy} onClick={openReceive}>{t("ui.actions.receive")}</Button> : null}
        {inTransit && ab.canReturn ? <Button variant="outline" disabled={busy} onClick={() => setConfirm("returnRest")}>{t("ui.actions.returnRest")}</Button> : null}
        {inTransit && ab.canCloseShort ? <Button variant="outline" disabled={busy} onClick={() => setConfirm("closeShort")}>{t("ui.actions.closeShort")}</Button> : null}
        {transfer.status === "IN_TRANSIT" && !anyReceived && ab.canReverse ? <Button variant="outline" disabled={busy} onClick={() => setConfirm("reverseDispatch")}>{t("ui.actions.reverseDispatch")}</Button> : null}
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t("ui.details.lines")}</h2>
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{t("ui.fields.item")}</TableHead>
                <TableHead>{t("ui.details.from")}</TableHead>
                <TableHead>{t("ui.details.to")}</TableHead>
                <TableHead>{t("ui.details.requested")}</TableHead>
                <TableHead>{t("ui.details.dispatched")}</TableHead>
                <TableHead>{t("ui.details.received")}</TableHead>
                <TableHead>{t("ui.details.returned")}</TableHead>
                <TableHead>{t("ui.details.lost")}</TableHead>
                <TableHead>{t("ui.details.pending")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfer.lines.map((l) => {
                const sum = (k: "receivedBaseQty" | "returnedBaseQty" | "lostBaseQty" | "pendingBaseQty") =>
                  l.allocations.reduce((s, a) => s + Number(a[k]), 0)
                return (
                  <TableRow key={l.id}>
                    <TableCell>{l.lineNo}</TableCell>
                    <TableCell>{l.itemName}</TableCell>
                    <TableCell>{l.sourceLocationCode}</TableCell>
                    <TableCell>{l.destinationLocationCode}</TableCell>
                    <TableCell className="tabular-nums">{l.requestedQty} {l.unitSymbol}</TableCell>
                    <TableCell className="tabular-nums">{l.dispatchedBaseQty}</TableCell>
                    <TableCell className="tabular-nums">{sum("receivedBaseQty")}</TableCell>
                    <TableCell className="tabular-nums">{sum("returnedBaseQty")}</TableCell>
                    <TableCell className="tabular-nums">{sum("lostBaseQty")}</TableCell>
                    <TableCell className="tabular-nums">{sum("pendingBaseQty")}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t("ui.details.history")}</h2>
        {transfer.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("ui.details.noHistory")}</p>
        ) : (
          <ul className="space-y-2">
            {transfer.events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 text-sm">
                <span className="font-medium">{t(`labels.eventKind.${e.kind}`, { defaultValue: e.kind })}</span>
                <span className="text-muted-foreground">{e.status}</span>
                <span className="tabular-nums text-muted-foreground">{new Date(e.occurredAt).toLocaleString()}</span>
                <span className="flex-1 tabular-nums">{eventLine(e)}</span>
                {e.note ? <span className="text-muted-foreground">{e.note}</span> : null}
                {e.kind === "RECEIPT" && e.status === "POSTED" && ab.canReverse ? (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm({ receiptId: e.id })}>
                    {t("ui.actions.reverseReceipt")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t(`ui.actions.${confirmKey}`)}
        description={t(`ui.confirms.${confirmKey}`)}
        confirmLabel={t("ui.actions.confirm")}
        cancelLabel={t("ui.actions.close")}
        onConfirm={() => void onConfirm()}
        isLoading={busy}
        destructive={confirmKey !== "dispatch"}
      />

      <Dialog open={receiving} onOpenChange={setReceiving}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("ui.details.receiveTitle")}</DialogTitle>
            <DialogDescription>{t("ui.details.receiveHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {allocations.map(({ line, a }) => (
              <div key={a.id} className="grid grid-cols-[1fr_auto_8rem] items-center gap-3 text-sm">
                <span>{line.itemName}{a.batchNumber ? ` (${t("ui.details.batch")} ${a.batchNumber})` : ""}</span>
                <span className="tabular-nums text-muted-foreground">{t("ui.details.pending")}: {a.pendingBaseQty}</span>
                <Input
                  inputMode="decimal"
                  aria-label={t("ui.details.receiveNow")}
                  value={qty[a.id] ?? ""}
                  onChange={(e) => setQty((q) => ({ ...q, [a.id]: e.target.value }))}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>{t("ui.details.note")}</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setReceiving(false)}>{t("ui.actions.close")}</Button>
              <Button disabled={busy} onClick={() => void submitReceive()}>{t("ui.actions.receive")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
