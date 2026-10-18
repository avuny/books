import { and, desc, eq, gte, isNull, sql } from "@avuny/db"
import type { Database } from "@avuny/db"
import { auditEvents, otps, type OtpPurpose } from "@avuny/db"

export interface InsertOtpInput {
  id?: string
  purpose: OtpPurpose
  identifier: string
  userId?: string
  otpHash: string
  expiresAt: Date
}

export async function findOtpById(db: Database, id: string) {
  const [row] = await db.select().from(otps).where(eq(otps.id, id)).limit(1)
  return row ?? null
}

export async function getMostRecentOtp(
  db: Database,
  identifier: string,
  purpose: OtpPurpose
) {
  const [row] = await db
    .select()
    .from(otps)
    .where(and(eq(otps.identifier, identifier), eq(otps.purpose, purpose)))
    .orderBy(desc(otps.createdAt))
    .limit(1)
  return row ?? null
}

export async function countSendsSince(
  db: Database,
  identifier: string,
  purpose: OtpPurpose,
  since: Date
): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(otps)
    .where(
      and(
        eq(otps.identifier, identifier),
        eq(otps.purpose, purpose),
        gte(otps.createdAt, since)
      )
    )
  return result?.count ?? 0
}

export async function countSendsForIpSince(
  db: Database,
  ipAddress: string,
  since: Date
): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditEvents)
    .where(
      and(
        eq(auditEvents.eventType, "otp.sent"),
        sql`${auditEvents.ipAddress} = ${ipAddress}::inet`,
        gte(auditEvents.occurredAt, since)
      )
    )
  return result?.count ?? 0
}

export async function closePendingOtps(
  db: Database,
  identifier: string,
  purpose: OtpPurpose
): Promise<void> {
  await db
    .update(otps)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(otps.identifier, identifier),
        eq(otps.purpose, purpose),
        isNull(otps.consumedAt)
      )
    )
}

export async function insertOtp(db: Database, input: InsertOtpInput) {
  const [row] = await db
    .insert(otps)
    .values({
      ...(input.id ? { id: input.id } : {}),
      purpose: input.purpose,
      identifier: input.identifier,
      userId: input.userId,
      otpHash: input.otpHash,
      expiresAt: input.expiresAt,
      attempts: 0,
    })
    .returning()
  return row
}

export async function incrementAttempts(db: Database, id: string): Promise<number> {
  const [row] = await db
    .update(otps)
    .set({ attempts: sql`${otps.attempts} + 1` })
    .where(eq(otps.id, id))
    .returning({ attempts: otps.attempts })
  return row?.attempts ?? 0
}

export async function markConsumed(db: Database, id: string): Promise<void> {
  await db.update(otps).set({ consumedAt: new Date() }).where(eq(otps.id, id))
}

export async function markVerified(db: Database, id: string) {
  const [row] = await db
    .update(otps)
    .set({ verifiedAt: new Date() })
    .where(eq(otps.id, id))
    .returning()
  return row ?? null
}

export async function consumeOtpProof(
  db: Database,
  challengeId: string,
  purpose: OtpPurpose,
  identifier: string,
  userId?: string
): Promise<boolean> {
  const conditions = [
    eq(otps.id, challengeId),
    eq(otps.purpose, purpose),
    eq(otps.identifier, identifier),
    sql`${otps.verifiedAt} IS NOT NULL`,
    isNull(otps.consumedAt),
  ]

  if (userId) {
    conditions.push(eq(otps.userId, userId))
  }

  const [row] = await db
    .update(otps)
    .set({ consumedAt: new Date() })
    .where(and(...conditions))
    .returning({ id: otps.id })

  return !!row
}
