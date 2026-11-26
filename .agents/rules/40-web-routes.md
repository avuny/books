# Rule: web routes (TanStack Router, file-based)

- Path string in `createFileRoute("…")` **must equal** the file location. Index files end with `/`: `routes/organization/$orgId/roles/index.tsx` → `"/organization/$orgId/roles/"`.
- File kinds: `route.tsx` = layout (renders `<Outlet/>`), `index.tsx` = the folder's own page, `$param.tsx` = dynamic child, `name.tsx` = leaf.
- A route file: `Route = createFileRoute(...)({ component })`, one page component, reads `Route.useParams()` / `Route.useSearch()`, builds callbacks with `useNavigate`, renders **one** feature component. No data fetching, no `useTranslation`, no styling beyond layout wrappers.
- Navigation uses typed `to` + `params`: `navigate({ to: "/organization/$orgId/roles/$roleId", params: { orgId, roleId } })`. Prefix fire-and-forget calls with `void`.
- Search params: `validateSearch` coerces + defaults (`all: search.all === true || search.all === "true"`).
- Auth guard lives in the top-level layout (`routes/organization/route.tsx`): loading → `<LoadingPage />`, unauthenticated → `<Navigate to={ROUTES.auth.index} replace />`. Children never re-check auth.
- Singular→plural/legacy URLs: a leaf route with `beforeLoad: () => { throw redirect({ … }) }` (see `role.tsx` → `roles`).
- Never edit `routeTree.gen.ts`; it is generated.
