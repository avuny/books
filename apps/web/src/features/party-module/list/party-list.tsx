import { useCallback, useEffect, useMemo, useState } from "react"
import type { PaginationState } from "@tanstack/react-table"
import { useTranslation } from "react-i18next"
import {
  DataTable,
  DataTablePagination,
  DataTableSearch,
  DataTableToolbar,
  DataTableViewTabs,
  getTablePaginationProps,
  useDataTable,
} from "@workspace/ui/blocks/data-table"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"

import { usePartyActions } from "../actions/use-party-actions.js"
import { PartyButton } from "../forms/party-button.js"
import { usePartyLabels } from "../lib/use-party-labels.js"
import type { PartyListItemDto, PartyRole, PartyScope } from "../types.js"
import { usePartyList } from "../party-api.js"
import { createPartyColumns, type PartyColumnsCopy } from "./party-columns.js"
import { PartyMobileCard } from "./party-mobile-card.js"

const SCOPES: readonly PartyScope[] = ["active", "inactive"]

export interface PartyListProps {
  orgId: string
  role: PartyRole
  onViewParty?: (partyId: string) => void
}

export function PartyList({ orgId, role, onViewParty }: PartyListProps) {
  const { t, i18n } = useTranslation("party")

  /* state */
  const [scope, setScope] = useState<PartyScope>("active")
  const [search, setSearch] = useState("")
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  const resetPage = useCallback(
    () => setPagination((c) => ({ ...c, pageIndex: 0 })),
    []
  )

  /* data */
  const { parties, total, isLoading } = usePartyList(orgId, role, {
    page: pagination.pageIndex + 1,
    pageSize: pagination.pageSize,
    scope,
    search,
  })

  const { getTypeLabel, getRoleLabel } = usePartyLabels()
  const { abilities, getActions, dialogs, actionError, clearActionError } =
    usePartyActions(orgId, role, { onViewParty })

  // Stepping back if last page is empty after deletions/deactivations
  useEffect(() => {
    if (!isLoading && parties.length === 0 && pagination.pageIndex > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPagination((c) => ({ ...c, pageIndex: c.pageIndex - 1 }))
    }
  }, [isLoading, parties.length, pagination.pageIndex])

  const formatDate = useCallback(
    (isoString: string) => {
      try {
        return new Intl.DateTimeFormat(i18n.language, {
          dateStyle: "medium",
        }).format(new Date(isoString))
      } catch {
        return isoString
      }
    },
    [i18n.language]
  )

  const columnsCopy: PartyColumnsCopy = useMemo(
    () => ({
      name: t("table.name", { defaultValue: "Name" }),
      email: t("table.email", { defaultValue: "Email" }),
      phone: t("table.phone", { defaultValue: "Phone" }),
      roles: t("table.roles", { defaultValue: "Roles" }),
      updated: t("table.updated", { defaultValue: "Updated" }),
      actions: t("table.actions", { defaultValue: "Actions" }),
      actionsFor: (name) =>
        t("table.actionsFor", { name, defaultValue: `Actions for ${name}` }),
      getTypeLabel,
      roleBadges: {
        roleLabels: {
          CUSTOMER: getRoleLabel("CUSTOMER"),
          VENDOR: getRoleLabel("VENDOR"),
        },
        inactiveLabel: t("labels.status.inactive", { defaultValue: "Inactive" }),
      },
      formatDate,
    }),
    [t, getTypeLabel, getRoleLabel, formatDate]
  )

  const columns = useMemo(
    () =>
      createPartyColumns({
        copy: columnsCopy,
        getActions,
      }),
    [columnsCopy, getActions]
  )

  const table = useDataTable<PartyListItemDto>({
    data: parties,
    columns,
    getRowId: (party) => party.id,
    manual: true,
    rowCount: total,
    pagination,
    onPaginationChange: setPagination,
  })

  const paginationProps = getTablePaginationProps(table)

  return (
    <div className="space-y-4">
      {actionError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            <span>{actionError}</span>
            <button
              type="button"
              className="text-xs underline"
              onClick={clearActionError}
            >
              Dismiss
            </button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div>
        <h1 className="text-xl font-semibold text-foreground">
          {t(`list.${role}.title`, {
            defaultValue: role === "CUSTOMER" ? "Customers" : "Vendors",
          })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(`list.${role}.description`, {
            defaultValue:
              role === "CUSTOMER"
                ? "Manage your customer directory, contacts and relationships."
                : "Manage your vendor directory, supplier details and contacts.",
          })}
        </p>
      </div>

      <DataTableViewTabs
        ariaLabel={t("list.tabs.aria", { defaultValue: "Party status" })}
        tabs={SCOPES.map((s) => ({
          value: s,
          label: t(`list.tabs.${s}`, {
            defaultValue: s === "active" ? "Active" : "Inactive",
          }),
        }))}
        value={scope}
        onValueChange={(s) => {
          const next = SCOPES.find((item) => item === s)
          if (!next) return
          setScope(next)
          resetPage()
        }}
      />

      <DataTableToolbar
        search={
          <DataTableSearch
            placeholder={t("list.search.placeholder", {
              defaultValue: "Search parties...",
            })}
            clearLabel={t("list.search.clear", { defaultValue: "Clear search" })}
            value={search}
            onChange={(val) => {
              setSearch(val)
              resetPage()
            }}
          />
        }
        actions={
          abilities.canCreate ? (
            <PartyButton orgId={orgId} role={role} />
          ) : null
        }
      />

      <DataTable
        table={table}
        isLoading={isLoading}
        onRowClick={(party) => onViewParty?.(party.id)}
        emptyState={
          <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
            <p className="text-sm font-medium text-foreground">
              {t(`empty.${role}.title`, {
                defaultValue: `No ${role.toLowerCase()}s found`,
              })}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(`empty.${role}.description`, {
                defaultValue: `Get started by adding your first ${role.toLowerCase()}.`,
              })}
            </p>
          </div>
        }
        renderMobileCard={(row) => (
          <PartyMobileCard
            party={row.original}
            actions={getActions(row.original)}
            actionsLabel={columnsCopy.actionsFor(row.original.displayName)}
            getTypeLabel={getTypeLabel}
            roleBadges={columnsCopy.roleBadges}
            formatDate={formatDate}
            onSelect={() => onViewParty?.(row.original.id)}
          />
        )}
        footer={
          <DataTablePagination
            {...paginationProps}
            copy={{
              navLabel: t("pagination.nav", {
                defaultValue: "Pagination Navigation",
              }),
              previous: t("pagination.previous", { defaultValue: "Previous" }),
              next: t("pagination.next", { defaultValue: "Next" }),
              rowsPerPage: t("pagination.rowsPerPage", {
                defaultValue: "Rows per page",
              }),
              summary: ({ from, to, total }) =>
                t("pagination.summary", {
                  from,
                  to,
                  total,
                  defaultValue: `${from}–${to} of ${total}`,
                }),
              pageOf: (page, pageCount) =>
                t("pagination.pageOf", {
                  page,
                  pageCount,
                  defaultValue: `Page ${page} of ${pageCount}`,
                }),
              pageLabel: (page) =>
                t("pagination.goTo", {
                  page,
                  defaultValue: `Go to page ${page}`,
                }),
            }}
          />
        }
      />

      {dialogs}
    </div>
  )
}
