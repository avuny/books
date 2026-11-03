import type { z } from "@avuny/zod"
import type { IdentifierSchema } from "./schemas.js"

export type Identifier = z.infer<typeof IdentifierSchema>
