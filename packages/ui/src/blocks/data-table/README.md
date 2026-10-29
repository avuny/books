# data-table kit

Pure, reusable building blocks for every list screen (invoices, users, roles, sales orders ...).
Put these files in `packages/ui/src/components/data-table/` and import from `@workspace/ui/components/data-table`.

## How a module screen is composed

```
<DataTableViewTabs />            status tabs (optional)
<DataTableToolbar
  search  = <DataTableSearch />
  filter  = <DataTableFilter fields={moduleFields} />   <- only thing that differs per module
  actions = <DataTableMenuButton /> (import / export) + create button>
  <DataTableActiveFilters />     chips under the toolbar
  <DataTableBulkBar />           when rows are selected
</DataTableToolbar>
<DataTable table={useDataTable(...)} renderMobileCard={...} footer={<DataTablePagination />} />
<ConfirmDialog />                delete confirmation
```

See `invoices-list.example.tsx` for the full wiring (container in `apps/`, translations injected).

## Per-module checklist

1. Define `columns` (use `DataTableColumnHeader`, `createSelectionColumn`, `createActionsColumn`).
2. Define `filterFields` (`text`, `select`, `multiselect`, `number-range`, `date-range`).
3. Define `getActions(row)` returning `RowAction[]` (view / edit / delete ...).
4. Provide `renderMobileCard` using `DataTableMobileCard`.
5. Build the `copy` object from `t(...)` in the container.

## Conventions followed

- No text inside `ui` components: every label, placeholder and aria-label comes in as a prop
  (functions like `summary({from,to,total})` are used where interpolation is needed).
- Only semantic tokens (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`,
  `bg-primary`, `text-destructive` ...), so light and dark mode work.
- Dependencies are injected: the table instance, filter fields, row actions, and callbacks.
  Nothing imports i18n, routers or API clients.
- Base UI shadcn API: triggers use `render={<Button />}`, not `asChild`.
- Logical Tailwind classes (`ms-`, `ps-`, `start-`, `end-`) and `rtl:rotate-180` on chevrons, so RTL (Arabic) works.

## Responsive behavior

- `< md`: the table is replaced by a card list (`renderMobileCard`), filters open in a bottom sheet,
  tabs scroll horizontally, pagination collapses to "Previous | Page x of y | Next".
- `>= md`: full table, filters in a popover.
- If you skip `renderMobileCard`, the table just scrolls horizontally on phones.

## Assumptions to check against your repo

- shadcn (Base UI) components used: `button`, `input`, `label`, `checkbox`, `popover`, `sheet`,
  `dropdown-menu`, `alert-dialog`, `table`, `skeleton`, `badge` (example only).
- `lucide-react` and `@tanstack/react-table` (v8.13+, for `table.getRowCount()`) are installed in the ui package.
- `DropdownMenuItem` supports `variant="destructive"`; the delete item relies on it.
- Select/multiselect filters render as toggle chips (best for short lists such as status or role).
  For long lists (customers, products) add an async combobox field type.
