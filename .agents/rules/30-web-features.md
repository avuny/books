# Rule: web features

- **Pure view** (`*-form.tsx`, `*-details-view.tsx`, `*-columns.tsx`, `*-mobile-card.tsx`, `components/*`): props in, JSX out. Strings come in a `copy` prop typed `XCopy`. Dates arrive pre-formatted. Errors arrive as localized strings.
- **Container** (`create-x.tsx`, `x-details.tsx`, `x-list.tsx`): the only place for `useTranslation`, `useQuery`/mutations, abilities, `Intl` formatting, `useState` for server errors/dialogs.
- Header comment on each: `// UI + validation only. No i18n, API, auth or navigation knowledge.` / `// Composition only: strings + API behavior wired into the pure …`.
- **API file** `<name>-api.ts`: first-line comment stating it is the only file that knows `@/api`; exports `normalizeX`, `useXList`, `useX`, `useXAbilities`, `useCreateXMutation`, … Mutations invalidate list + detail query keys. Hooks return stable empty constants (`const NO_ROLES = []`) instead of fresh `[]`.
- **Forms:** `useForm<Input, unknown, Output>` with `zodResolver(ContractSchema)`, `z.input<>` for the first generic, `noValidate`, `FormShell` + `InputField` + `SubmitButton`. Empty optional text → `null` before sending (`values.description?.trim() || null`). Server errors: `parseApiError(e).message`.
- **Create/Edit share** `x-form-types.ts` (`XFormCopy`) and `use-x-form-copy.ts` (`useXFormCopy("create" | "update")`).
- **Dialog/button pair:** `XButton` (opens) + `XDialog` (controlled modal; `key={id}` on the update form). Row menus use `XDialog` directly (menu items can't own dialogs).
- **Lists:** server-side paging (`manual: true`, `rowCount`), scope tabs, debounced-by-state search that calls `resetPage()`, `createXColumns({ copy, getActions })`, `RowAction[]` with `disabled` reasons, `ConfirmDialog` for delete showing the server error, `renderMobileCard`, effect that steps back one page when the last row of the last page is deleted, `placeholderData: keepPreviousData`.
- **Abilities:** `useXAbilities(orgId)` → `{ canCreate, canUpdate, canDelete }` from `hasPermission(snapshot, "<action>:<resource>")`. Hide buttons/actions; never trust it for security.
- **Tests:** every pure function in `lib/` and every `normalize*` gets a Vitest file next to it.
- **A11y:** skeletons `aria-busy`; error text `role="alert"`; icon buttons need `aria-label`; decorative icons `aria-hidden`; dialogs always have a (possibly `sr-only`) title + description.
