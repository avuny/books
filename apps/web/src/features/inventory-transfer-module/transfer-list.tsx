import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"

import { CreateTransferDialog } from "./create-transfer-dialog"
import { useTransferAbilities, useTransferList, type TransferStatus } from "./inventory-transfer-api"
import { TransferStatusBadge } from "./status-badge"

const STATUSES: Array<TransferStatus | "all"> = ["all", "DRAFT", "IN_TRANSIT", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"]
const PAGE_SIZE = 20

export function TransferList({ orgId, onView }: { orgId: string; onView: (id: string) => void }) {
  const { t } = useTranslation("inventory-transfer")
  const [status, setStatus] = useState<TransferStatus | "all">("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const abilities = useTransferAbilities(orgId)
  const { rows, total, isLoading } = useTransferList(orgId, { page, pageSize: PAGE_SIZE, status, search })
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{t("ui.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("ui.description")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder={t("ui.search")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
        <NativeSelect
          aria-label={t("ui.cols.status")}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as TransferStatus | "all")
            setPage(1)
          }}
        >
          {STATUSES.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {s === "all" ? t("ui.all") : t(`labels.status.${s}`)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <div className="flex-1" />
        {abilities.canCreate ? (
          <Button onClick={() => setCreating(true)}>
            <Plus className="me-2 size-4" />
            {t("ui.new")}
          </Button>
        ) : null}
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("ui.cols.number")}</TableHead>
              <TableHead>{t("ui.cols.date")}</TableHead>
              <TableHead>{t("ui.cols.route")}</TableHead>
              <TableHead>{t("ui.cols.lines")}</TableHead>
              <TableHead>{t("ui.cols.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => onView(r.id)}>
                <TableCell className="font-medium">{r.number}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">{r.date}</TableCell>
                <TableCell>
                  {r.sourceWarehouseName ?? "-"} → {r.destinationWarehouseName ?? "-"}
                </TableCell>
                <TableCell className="tabular-nums">{r.lineCount}</TableCell>
                <TableCell>
                  <TransferStatusBadge status={r.status} />
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <p className="text-sm font-medium text-foreground">{t("ui.empty")}</p>
                  <p className="text-sm text-muted-foreground">{t("ui.emptyHint")}</p>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          ‹
        </Button>
        <span className="tabular-nums">
          {page} / {pages}
        </span>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
          ›
        </Button>
      </div>

      <CreateTransferDialog orgId={orgId} open={creating} onOpenChange={setCreating} onCreated={onView} />
    </div>
  )
}
