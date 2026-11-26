# Templates: list (columns, container, mobile card)

## list/project-columns.tsx — PURE column factory

```tsx
import type { ColumnDef } from "@tanstack/react-table"
import { createActionsColumn, type RowAction } from "@workspace/ui/blocks/data-table"

import { ProjectStatusBadge } from "../components"
import type { ProjectListItemDto } from "../types"

export type ProjectColumnsCopy = {
  name: string
  status: string
  members: string
  actions: string
  /** aria-label of the row menu button. */
  actionsFor: (projectName: string) => string
  getStatusLabel: (status: string) => string
}

type ProjectColumnsOptions = {
  copy: ProjectColumnsCopy
  getActions: (project: ProjectListItemDto) => RowAction[]
}

export function createProjectColumns({ copy, getActions }: ProjectColumnsOptions): ColumnDef<ProjectListItemDto>[] {
  return [
    {
      accessorKey: "name",
      header: copy.name,
      enableSorting: false,                       // server-side paging: sorting off unless the API supports it
      cell: ({ row }) => <div className="font-medium text-foreground">{row.original.name}</div>,
    },
    {
      id: "status",
      header: copy.status,
      enableSorting: false,
      cell: ({ row }) => (
        <ProjectStatusBadge status={row.original.status} label={copy.getStatusLabel(row.original.status)} />
      ),
    },
    {
      accessorKey: "memberCount",
      header: copy.members,
      enableSorting: false,
      cell: ({ row }) => <span className="text-muted-foreground tabular-nums">{row.original.memberCount}</span>,
    },
    createActionsColumn<ProjectListItemDto>({
      headerLabel: copy.actions,
      triggerLabel: (p) => copy.actionsFor(p.name),
      getActions,
    }),
  ]
}
```

## list/project-mobile-card.tsx — PURE

```tsx
import { DataTableMobileCard, DataTableRowActions, type RowAction } from "@workspace/ui/blocks/data-table"

export function ProjectMobileCard({ project, copy, actions, actionsTriggerLabel, onClick }: ProjectMobileCardProps) {
  return (
    <DataTableMobileCard
      title={project.name}
      badge={<ProjectStatusBadge status={project.status} label={copy.getStatusLabel(project.status)} />}
      fields={[{ label: copy.membersLabel, value: project.memberCount }]}
      actions={<DataTableRowActions actions={actions} triggerLabel={actionsTriggerLabel} />}
      onClick={onClick}
    />
  )
}
```

## list/project-list.tsx — CONTAINER (the skeleton to copy)

```tsx
const SCOPES: readonly ProjectScope[] = ["all", "draft", "active", "archived"]

type ProjectListProps = {
  orgId: string
  /** The route decides how to navigate to the project page. */
  onViewProject: (projectId: string) => void
}

// Composition only: strings + API behavior wired into the pure data-table kit.
export function ProjectList({ orgId, onViewProject }: ProjectListProps) {
  const { t } = useTranslation("project")

  /* state */
  const [scope, setScope] = useState<ProjectScope>("all")
  const [search, setSearch] = useState("")
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 })
  const [projectToEdit, setProjectToEdit] = useState<ProjectListItemDto | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<ProjectListItemDto | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const resetPage = useCallback(() => setPagination((c) => ({ ...c, pageIndex: 0 })), [])

  /* data */
  const { projects, total, isLoading } = useProjectList(orgId, {
    page: pagination.pageIndex + 1, pageSize: pagination.pageSize, scope, search,
  })
  const abilities = useProjectAbilities(orgId)
  const { getStatusLabel } = useProjectLabels()
  const deleteMutation = useDeleteProjectMutation(orgId)

  // Deleting the last row of the last page leaves an empty page: step back.
  useEffect(() => {
    if (!isLoading && projects.length === 0 && pagination.pageIndex > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPagination((c) => ({ ...c, pageIndex: c.pageIndex - 1 }))
    }
  }, [isLoading, projects.length, pagination.pageIndex])

  /* row actions: ordered view → edit → delete (destructive, separated) */
  const getActions = useCallback((project: ProjectListItemDto): RowAction[] => {
    const actions: RowAction[] = [
      { id: "view", label: t("actions.view"), icon: <Eye className="size-4" />, onSelect: () => onViewProject(project.id) },
    ]
    if (abilities.canUpdate)
      actions.push({ id: "edit", label: t("actions.edit"), icon: <Pencil className="size-4" />, onSelect: () => setProjectToEdit(project) })
    if (abilities.canDelete)
      actions.push({
        id: "delete", label: t("actions.delete"), icon: <Trash2 className="size-4" />,
        variant: "destructive", separatorBefore: true,
        disabled: project.memberCount > 0,        // business rule mirrored from the server
        onSelect: () => setProjectToDelete(project),
      })
    return actions
  }, [t, onViewProject, abilities.canUpdate, abilities.canDelete])

  /* columns + table */
  const columns = useMemo(() => createProjectColumns({
    copy: {
      name: t("table.name"), status: t("table.status"), members: t("table.members"),
      actions: t("table.actions"),
      actionsFor: (name) => t("table.actionsFor", { name }),
      getStatusLabel,
    },
    getActions,
  }), [t, getActions, getStatusLabel])

  const table = useDataTable<ProjectListItemDto>({
    data: projects, columns, getRowId: (p) => p.id,
    manual: true, rowCount: total, pagination, onPaginationChange: setPagination,
  })
  const paginationProps = getTablePaginationProps(table)

  /* delete */
  const closeDeleteDialog = () => { setProjectToDelete(null); setDeleteError(null) }
  const handleDelete = async () => {
    if (!projectToDelete) return
    setDeleteError(null)
    try {
      await deleteMutation.mutateAsync({ orgId, projectId: projectToDelete.id })
      closeDeleteDialog()
    } catch (e) {
      setDeleteError(parseApiError(e).message || null)   // dialog stays open and shows the server message
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-foreground">{t("list.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("list.description")}</p>
      </div>

      <DataTableViewTabs
        ariaLabel={t("list.tabs.aria")}
        value={scope}
        onValueChange={(value) => {
          const next = SCOPES.find((item) => item === value)   // narrow string → union safely
          if (!next) return
          setScope(next); resetPage()
        }}
        tabs={SCOPES.map((item) => ({ value: item, label: t(`list.tabs.${item}`) }))}
      />

      <DataTableToolbar
        search={
          <DataTableSearch
            value={search}
            onChange={(next) => { setSearch(next); resetPage() }}
            placeholder={t("list.search.placeholder")}
            clearLabel={t("list.search.clear")}
          />
        }
        actions={abilities.canCreate ? <ProjectButton orgId={orgId} /> : null}
      />

      <DataTable
        table={table}
        isLoading={isLoading}
        onRowClick={(p) => onViewProject(p.id)}
        emptyState={/* title + description, centered, text-muted-foreground */ null}
        renderMobileCard={(row) => (
          <ProjectMobileCard
            project={row.original}
            copy={{ membersLabel: t("table.members"), getStatusLabel }}
            actions={getActions(row.original)}
            actionsTriggerLabel={t("table.actionsFor", { name: row.original.name })}
            onClick={() => onViewProject(row.original.id)}
          />
        )}
        footer={<DataTablePagination {...paginationProps} copy={{ /* nav, previous, next, rowsPerPage, summary, pageOf, pageLabel — see role-list.tsx */ }} />}
      />

      {projectToEdit ? (
        <ProjectDialog orgId={orgId} projectId={projectToEdit.id} open
          onOpenChange={(open) => { if (!open) setProjectToEdit(null) }} />
      ) : null}

      <ConfirmDialog
        open={projectToDelete !== null}
        onOpenChange={(open) => { if (!open) closeDeleteDialog() }}
        title={t("delete.title")}
        description={deleteError ?? t("delete.description", { name: projectToDelete?.name })}
        confirmLabel={t("actions.delete")}
        cancelLabel={t("actions.cancel")}
        isLoading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
```

Every filter/search change calls `resetPage()`. Pagination `copy` is the same block in every list — copy it from `role-list.tsx` and change the namespace only.
