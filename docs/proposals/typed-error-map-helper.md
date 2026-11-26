# Proposal: typed error-map helper

**Problem.** Every route needs `rawErrorMap as unknown as Record<Code | RoleErrorCode, ...>`. The double cast hides mistakes and is the top source of TS2345/TS2322/TS2352 rounds.

**Change.** Add `defineErrorMap<Wide>()(narrowMap)` in `@avuny/hono` that returns `Record<Wide, typeof narrowMap[keyof typeof narrowMap]>` with the single cast inside, so routes contain no casts.

**Cost.** Small helper plus a mechanical codemod over existing routes.
