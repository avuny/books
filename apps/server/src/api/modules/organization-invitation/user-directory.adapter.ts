// organization-invitation/user-directory.adapter.ts  (NEW)
//
// ASSUMPTIONS, adjust to your schema:
//   - tables `users` and `userIdentifiers` exported from @avuny/db
//   - userIdentifiers columns: userId, type ("email" | "phone" | "username"),
//     value, isPrimary, verifiedAt (null = not verified)
// If you'd rather keep table access inside the users module, move the two queries
// into users.repo.ts and call them from here.
import { and, desc, eq, isNotNull } from "drizzle-orm"
import { userIdentifiers, users, type Database } from "@avuny/db"
import { normalizeIdentifier } from "../users/index.js" // pure helper; adjust path
import type { UserDirectory } from "./organization-invitation.service.js"

export function createUserDirectory(db: Database): UserDirectory {
  async function findVerified(type: "email" | "phone", raw: string) {
    const [row] = await db
      .select({ userId: userIdentifiers.userId })
      .from(userIdentifiers)
      .where(
        and(
          eq(userIdentifiers.type, type),
          eq(userIdentifiers.value, normalizeIdentifier(raw)),
          isNotNull(userIdentifiers.verifiedAt)
        )
      )
      .limit(1)
    return row ?? null
  }

  return {
    async findVerifiedByContact({ email, phone }) {
      if (email) {
        const hit = await findVerified("email", email)
        if (hit) return hit
      }
      if (phone) {
        const hit = await findVerified("phone", phone)
        if (hit) return hit
      }
      return null
    },

    async getVerifiedContacts(userId) {
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      if (!user) return null

      // Primary first, so `emails[0]` / `phones[0]` is the best default target.
      const rows = await db
        .select({ type: userIdentifiers.type, value: userIdentifiers.value })
        .from(userIdentifiers)
        .where(and(eq(userIdentifiers.userId, userId), isNotNull(userIdentifiers.verifiedAt)))
        .orderBy(desc(userIdentifiers.isPrimary))

      return {
        emails: rows.filter((r) => r.type === "email").map((r) => r.value),
        phones: rows.filter((r) => r.type === "phone").map((r) => r.value),
      }
    },
  }
}
