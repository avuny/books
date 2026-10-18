import { and, eq } from "@avuny/db"
import type { Database } from "@avuny/db"
import {
  users,
  userIdentifiers,
  type IdentifierType,
  type User,
} from "@avuny/db"

export interface CreateUserInput {
  name: string
  passwordHash: string
  identifierType: IdentifierType
  identifierValue: string
}

export async function findIdentifier(
  db: Database,
  type: IdentifierType,
  value: string
) {
  const [row] = await db
    .select()
    .from(userIdentifiers)
    .where(
      and(eq(userIdentifiers.type, type), eq(userIdentifiers.value, value))
    )
    .limit(1)
  return row ?? null
}

export async function findIdentifierByValue(
  db: Database,
  normalizedValue: string
) {
  const [row] = await db
    .select()
    .from(userIdentifiers)
    .where(eq(userIdentifiers.value, normalizedValue))
    .limit(1)
  return row ?? null
}

export async function findUserByIdentifier(
  db: Database,
  normalizedValue: string
): Promise<{ user: User; identifier: typeof userIdentifiers.$inferSelect } | null> {
  const identifier = await findIdentifierByValue(db, normalizedValue)
  if (!identifier) return null

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, identifier.userId))
    .limit(1)

  if (!user) return null
  return { user, identifier }
}

export async function findUserById(
  db: Database,
  id: string
): Promise<{
  user: User
  identifiers: (typeof userIdentifiers.$inferSelect)[]
} | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!user) return null

  const identifiers = await db
    .select()
    .from(userIdentifiers)
    .where(eq(userIdentifiers.userId, id))

  return { user, identifiers }
}

export async function createUserWithPrimaryIdentifier(
  db: Database,
  input: CreateUserInput
): Promise<{
  user: User
  identifier: typeof userIdentifiers.$inferSelect
} | null> {
  return await db.transaction(async (tx) => {
    // Check if identifier already exists
    const existing = await findIdentifier(
      tx,
      input.identifierType,
      input.identifierValue
    )
    if (existing) {
      return null
    }

    const [user] = await tx
      .insert(users)
      .values({
        name: input.name,
        passwordHash: input.passwordHash,
        status: "active",
        platformRole: "user",
      })
      .returning()

    if (!user) {
      return null
    }

    const [identifier] = await tx
      .insert(userIdentifiers)
      .values({
        userId: user.id,
        type: input.identifierType,
        value: input.identifierValue,
        isPrimary: true,
        verifiedAt: new Date(),
      })
      .returning()

    if (!identifier) {
      return null
    }

    return { user, identifier }
  })
}

export async function updateUserLastSignIn(
  db: Database,
  userId: string
): Promise<void> {
  const now = new Date()
  await db
    .update(users)
    .set({ lastSignInAt: now, lastActiveAt: now })
    .where(eq(users.id, userId))
}

export async function updateUserLastActive(
  db: Database,
  userId: string
): Promise<void> {
  await db
    .update(users)
    .set({ lastActiveAt: new Date() })
    .where(eq(users.id, userId))
}

/**
 * Updates the user's display name.
 * Returns the updated user row, or null if the user does not exist.
 */
export async function updateUserName(
  db: Database,
  userId: string,
  name: string
): Promise<User | null> {
  const [updated] = await db
    .update(users)
    .set({ name })
    .where(eq(users.id, userId))
    .returning()
  return updated ?? null
}
