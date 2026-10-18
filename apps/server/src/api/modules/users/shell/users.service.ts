import { ok, fail, type Result } from "@avuny/utils"
import type { Database, User } from "@avuny/db"
import { userIdentifiers } from "@avuny/db"
import {
  UsersErrorCode,
  AUDIT_EVENT_TYPES,
  type MeResponseSchema,
} from "@avuny/contracts"
import { type z } from "@avuny/zod"
import {
  classifyIdentifier,
  normalizeIdentifier,
  validateIdentifierForType,
  isEmailOrPhone,
} from "../core/identifier.rules.js"
import { validatePassword } from "../core/password.rules.js"
import { hashPassword } from "./users.crypto.js"
import {
  createUserWithPrimaryIdentifier,
  findUserById,
  updateUserName,
} from "./users.repo.js"
import { writeAuditEvent } from "../../audit/index.js"

export interface CreateUserInput {
  name: string
  password: string
  identifier: string // raw email or phone
}

export type MeResponse = z.infer<typeof MeResponseSchema>

export interface CreatedUserData {
  user: User
  identifier: typeof userIdentifiers.$inferSelect
}

export async function createUser(
  db: Database,
  input: CreateUserInput
): Promise<Result<CreatedUserData, UsersErrorCode>> {
  const normalized = normalizeIdentifier(input.identifier)
  const type = classifyIdentifier(normalized)

  if (!type || !isEmailOrPhone(type)) {
    return fail({
      error: UsersErrorCode.IDENTIFIER_TYPE_MISMATCH,
      msg: "Sign up requires email or phone",
    })
  }

  const typeValidationError = validateIdentifierForType(normalized, type)
  if (typeValidationError) {
    return fail({
      error: UsersErrorCode.IDENTIFIER_TYPE_MISMATCH,
      msg: typeValidationError,
    })
  }

  const passwordError = validatePassword(input.password)
  if (passwordError) {
    return fail({
      error: UsersErrorCode.IDENTIFIER_TYPE_MISMATCH,
      msg: passwordError,
    })
  }

  const passwordHash = await hashPassword(input.password)

  const result = await createUserWithPrimaryIdentifier(db, {
    name: input.name.trim(),
    passwordHash,
    identifierType: type,
    identifierValue: normalized,
  })

  if (!result) {
    return fail({
      error: UsersErrorCode.IDENTIFIER_ALREADY_EXISTS,
      msg: "An account with this identifier already exists",
    })
  }

  return ok({
    data: result,
    msg: "User created successfully",
  })
}

export async function getUserProfile(
  db: Database,
  userId: string
): Promise<Result<MeResponse, typeof UsersErrorCode.IDENTIFIER_NOT_FOUND>> {
  const result = await findUserById(db, userId)
  if (!result) {
    return fail({
      error: UsersErrorCode.IDENTIFIER_NOT_FOUND,
      msg: "User not found",
    })
  }

  const { user, identifiers } = result

  return ok({
    data: {
      id: user.id,
      name: user.name,
      avatarUrl: null, // Avatar derived in later slices (D11)
      platformRole: user.platformRole,
      identifiers: identifiers.map((i) => ({
        id: i.id,
        type: i.type,
        value: i.value,
        isPrimary: i.isPrimary,
        verifiedAt: i.verifiedAt ? i.verifiedAt.toISOString() : null,
      })),
    },
    msg: "User profile retrieved successfully",
  })
}

// ── Slice 4a ─────────────────────────────────────────────────────────────────

export interface UpdateProfileInput {
  userId: string
  name: string
  /** For the audit row. */
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  requestId?: string
}

/**
 * Updates the user's display name and writes a user.name_changed audit event (D13).
 * Returns the full updated profile on success.
 */
export async function updateUserProfile(
  db: Database,
  input: UpdateProfileInput
): Promise<Result<MeResponse, typeof UsersErrorCode.IDENTIFIER_NOT_FOUND>> {
  const trimmedName = input.name.trim()

  const updated = await updateUserName(db, input.userId, trimmedName)
  if (!updated) {
    return fail({
      error: UsersErrorCode.IDENTIFIER_NOT_FOUND,
      msg: "User not found",
    })
  }

  // Audit — standalone write (D13: failures have no other table to roll back with)
  await writeAuditEvent(db, {
    eventType: AUDIT_EVENT_TYPES.USER_NAME_CHANGED,
    outcome: "success",
    actorUserId: input.userId,
    subjectUserId: input.userId,
    sessionId: input.sessionId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    requestId: input.requestId,
    metadata: {},
  })

  // Fetch full profile (identifiers) to build the response
  const profile = await findUserById(db, input.userId)
  if (!profile) {
    return fail({
      error: UsersErrorCode.IDENTIFIER_NOT_FOUND,
      msg: "User not found after update",
    })
  }

  return ok({
    data: {
      id: profile.user.id,
      name: profile.user.name,
      avatarUrl: null, // Avatar derived in Slice 4b
      platformRole: profile.user.platformRole,
      identifiers: profile.identifiers.map((i) => ({
        id: i.id,
        type: i.type,
        value: i.value,
        isPrimary: i.isPrimary,
        verifiedAt: i.verifiedAt ? i.verifiedAt.toISOString() : null,
      })),
    },
    msg: "Profile updated successfully",
  })
}
