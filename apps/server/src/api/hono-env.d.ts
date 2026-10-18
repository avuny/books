import "hono"
import type { User, Session } from "@avuny/db"

declare module "hono" {
  interface ContextVariableMap {
    user: User
    session: Session
  }
}
