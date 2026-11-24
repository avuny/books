import {
  and,
  asc,
  eq,
  exists,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm"
import {
  parties,
  partyAddresses,
  partyEmails,
  partyPhones,
  partyRoles,
  type DB,
  type NewParty,
  type NewPartyAddress,
  type NewPartyEmail,
  type NewPartyPhone,
  type Party,
  type PartyAddress,
  type PartyEmail,
  type PartyPhone,
  type PartyRoleAssignment,
  type Tx,
} from "@avuny/db"
import type { PartyRole } from "@avuny/contracts/party"

// ── types ──────────────────────────────────────────────────────────────────

export type PartyAggregate = {
  party: Party
  roles: PartyRoleAssignment[]
  emails: PartyEmail[]
  phones: PartyPhone[]
  addresses: PartyAddress[]
}

export type ReplacementPlan<E extends { id?: string }> = {
  deleteIds: string[]
  demoteIds: string[]
  parkIds: string[]
  updates: { id: string; values: Omit<E, "id"> }[]
  inserts: Omit<E, "id">[]
}

export type EmailPlan = ReplacementPlan<{
  id?: string
  email: string
  label?: string | null
  isPrimary: boolean
}>

export type PhonePlan = ReplacementPlan<{
  id?: string
  phone: string
  label?: string | null
  isPrimary: boolean
}>

export type AddressPlan = ReplacementPlan<{
  id?: string
  label?: string | null
  addressLine1: string
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  countryCode?: string | null
  isPrimary: boolean
}>

export type PartyInsertContacts = {
  emails: Omit<NewPartyEmail, "id" | "orgId" | "partyId">[]
  phones: Omit<NewPartyPhone, "id" | "orgId" | "partyId">[]
  addresses: Omit<NewPartyAddress, "id" | "orgId" | "partyId">[]
}

type ListFilter = {
  role: PartyRole
  page: number
  pageSize: number
  search?: string
  isActive: boolean
}

type OptionsFilter = {
  role: PartyRole
  search?: string
  after: { name: string; id: string } | null
  limit: number
}

export type PartyOptionRow = { id: string; name: string; sortKey: string }

export type PartyListRow = {
  party: Party
  primaryEmail: string | null
  primaryPhone: string | null
}

// ── helpers ────────────────────────────────────────────────────────────────

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`)

function searchCondition(search: string | undefined): SQL | undefined {
  if (!search) return undefined
  const pattern = `%${escapeLike(search)}%`
  return or(
    ilike(parties.displayName, pattern),
    ilike(parties.legalName, pattern),
    ilike(parties.taxNumber, pattern),
    exists(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sql as any)`select 1 from ${partyEmails} where ${and(
        eq(partyEmails.orgId, parties.orgId),
        eq(partyEmails.partyId, parties.id),
        ilike(partyEmails.email, pattern)
      )}`
    ),
    exists(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sql as any)`select 1 from ${partyPhones} where ${and(
        eq(partyPhones.orgId, parties.orgId),
        eq(partyPhones.partyId, parties.id),
        ilike(partyPhones.phone, pattern)
      )}`
    )
  )
}

// ── factory ────────────────────────────────────────────────────────────────

export function createPartyRepository({ db }: { db: DB }) {
  const exec = (tx?: Tx): DB | Tx => tx ?? db

  return {
    transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      return db.transaction(fn)
    },

    // ── aggregate ──────────────────────────────────────────────────────────

    async findAggregate(
      orgId: string,
      id: string,
      tx?: Tx,
      opts: { lock?: boolean } = {}
    ): Promise<PartyAggregate | null> {
      const baseQuery = exec(tx)
        .select()
        .from(parties)
        .where(and(eq(parties.orgId, orgId), eq(parties.id, id)))
        .limit(1)

      const [party] = opts.lock
        ? await baseQuery.for("no key update")
        : await baseQuery
      if (!party) return null

      const [roleRows, emailRows, phoneRows, addressRows] = await Promise.all([
        exec(tx)
          .select()
          .from(partyRoles)
          .where(and(eq(partyRoles.orgId, orgId), eq(partyRoles.partyId, id))),
        exec(tx)
          .select()
          .from(partyEmails)
          .where(and(eq(partyEmails.orgId, orgId), eq(partyEmails.partyId, id)))
          .orderBy(
            sql`${partyEmails.isPrimary} desc`,
            asc(partyEmails.createdAt),
            asc(partyEmails.id)
          ),
        exec(tx)
          .select()
          .from(partyPhones)
          .where(and(eq(partyPhones.orgId, orgId), eq(partyPhones.partyId, id)))
          .orderBy(
            sql`${partyPhones.isPrimary} desc`,
            asc(partyPhones.createdAt),
            asc(partyPhones.id)
          ),
        exec(tx)
          .select()
          .from(partyAddresses)
          .where(and(eq(partyAddresses.orgId, orgId), eq(partyAddresses.partyId, id)))
          .orderBy(
            sql`${partyAddresses.isPrimary} desc`,
            asc(partyAddresses.createdAt),
            asc(partyAddresses.id)
          ),
      ])

      return { party, roles: roleRows, emails: emailRows, phones: phoneRows, addresses: addressRows }
    },

    async insertAggregate(
      orgId: string,
      values: Omit<NewParty, "id" | "orgId">,
      roles: PartyRole[],
      contacts: PartyInsertContacts,
      tx?: Tx
    ): Promise<string> {
      const [inserted] = await exec(tx)
        .insert(parties)
        .values({ ...values, orgId })
        .returning({ id: parties.id })

      if (!inserted) throw new Error("Failed to insert party")
      const partyId = inserted.id

      await exec(tx)
        .insert(partyRoles)
        .values(roles.map((role) => ({ orgId, partyId, role, isActive: true })))

      if (contacts.emails.length) {
        await exec(tx)
          .insert(partyEmails)
          .values(contacts.emails.map((e) => ({ ...e, orgId, partyId })))
      }
      if (contacts.phones.length) {
        await exec(tx)
          .insert(partyPhones)
          .values(contacts.phones.map((p) => ({ ...p, orgId, partyId })))
      }
      if (contacts.addresses.length) {
        await exec(tx)
          .insert(partyAddresses)
          .values(contacts.addresses.map((a) => ({ ...a, orgId, partyId })))
      }

      return partyId
    },

    async updateShared(
      orgId: string,
      id: string,
      patch: Partial<Omit<NewParty, "id" | "orgId" | "partyType">>,
      tx: Tx
    ): Promise<void> {
      await exec(tx)
        .update(parties)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(parties.orgId, orgId), eq(parties.id, id)))
    },

    // ── contact plan executors ─────────────────────────────────────────────

    async applyEmailPlan(
      orgId: string,
      partyId: string,
      plan: EmailPlan,
      tx: Tx
    ): Promise<void> {
      const scope = and(eq(partyEmails.orgId, orgId), eq(partyEmails.partyId, partyId))

      // 1. Delete omitted rows
      if (plan.deleteIds.length) {
        await exec(tx)
          .delete(partyEmails)
          .where(and(scope, inArray(partyEmails.id, plan.deleteIds)))
      }
      // 2. Demote rows that are currently primary
      if (plan.demoteIds.length) {
        await exec(tx)
          .update(partyEmails)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(and(scope, inArray(partyEmails.id, plan.demoteIds)))
      }
      // 3. Park: set email = id::text to avoid unique collisions during swap
      if (plan.parkIds.length) {
        for (const pid of plan.parkIds) {
          await exec(tx)
            .update(partyEmails)
            .set({ email: pid, updatedAt: new Date() })
            .where(and(scope, eq(partyEmails.id, pid)))
        }
      }
      // 4. Update retained rows to final values
      for (const { id, values } of plan.updates) {
        await exec(tx)
          .update(partyEmails)
          .set({ ...values, updatedAt: new Date() })
          .where(and(scope, eq(partyEmails.id, id)))
      }
      // 5. Insert new rows
      if (plan.inserts.length) {
        await exec(tx)
          .insert(partyEmails)
          .values(plan.inserts.map((e) => ({ ...e, orgId, partyId })))
      }
      // 6. Verify invariant: non-empty collection must have exactly one primary
      const remaining = await exec(tx)
        .select({ id: partyEmails.id, isPrimary: partyEmails.isPrimary })
        .from(partyEmails)
        .where(scope)
      if (remaining.length > 0 && remaining.filter((r) => r.isPrimary).length !== 1) {
        throw new Error("INVARIANT: email collection must have exactly one primary")
      }
    },

    async applyPhonePlan(
      orgId: string,
      partyId: string,
      plan: PhonePlan,
      tx: Tx
    ): Promise<void> {
      const scope = and(eq(partyPhones.orgId, orgId), eq(partyPhones.partyId, partyId))

      if (plan.deleteIds.length) {
        await exec(tx)
          .delete(partyPhones)
          .where(and(scope, inArray(partyPhones.id, plan.deleteIds)))
      }
      if (plan.demoteIds.length) {
        await exec(tx)
          .update(partyPhones)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(and(scope, inArray(partyPhones.id, plan.demoteIds)))
      }
      // No parking step for phones (no unique index on phone value per party)
      for (const { id, values } of plan.updates) {
        await exec(tx)
          .update(partyPhones)
          .set({ ...values, updatedAt: new Date() })
          .where(and(scope, eq(partyPhones.id, id)))
      }
      if (plan.inserts.length) {
        await exec(tx)
          .insert(partyPhones)
          .values(plan.inserts.map((p) => ({ ...p, orgId, partyId })))
      }
      const remaining = await exec(tx)
        .select({ id: partyPhones.id, isPrimary: partyPhones.isPrimary })
        .from(partyPhones)
        .where(scope)
      if (remaining.length > 0 && remaining.filter((r) => r.isPrimary).length !== 1) {
        throw new Error("INVARIANT: phone collection must have exactly one primary")
      }
    },

    async applyAddressPlan(
      orgId: string,
      partyId: string,
      plan: AddressPlan,
      tx: Tx
    ): Promise<void> {
      const scope = and(eq(partyAddresses.orgId, orgId), eq(partyAddresses.partyId, partyId))

      if (plan.deleteIds.length) {
        await exec(tx)
          .delete(partyAddresses)
          .where(and(scope, inArray(partyAddresses.id, plan.deleteIds)))
      }
      if (plan.demoteIds.length) {
        await exec(tx)
          .update(partyAddresses)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(and(scope, inArray(partyAddresses.id, plan.demoteIds)))
      }
      for (const { id, values } of plan.updates) {
        await exec(tx)
          .update(partyAddresses)
          .set({ ...values, updatedAt: new Date() })
          .where(and(scope, eq(partyAddresses.id, id)))
      }
      if (plan.inserts.length) {
        await exec(tx)
          .insert(partyAddresses)
          .values(plan.inserts.map((a) => ({ ...a, orgId, partyId })))
      }
      const remaining = await exec(tx)
        .select({ id: partyAddresses.id, isPrimary: partyAddresses.isPrimary })
        .from(partyAddresses)
        .where(scope)
      if (remaining.length > 0 && remaining.filter((r) => r.isPrimary).length !== 1) {
        throw new Error("INVARIANT: address collection must have exactly one primary")
      }
    },

    // ── role methods ──────────────────────────────────────────────────────

    async insertRole(
      orgId: string,
      partyId: string,
      role: PartyRole,
      tx: Tx
    ): Promise<void> {
      await exec(tx)
        .insert(partyRoles)
        .values({ orgId, partyId, role, isActive: true })
    },

    async setRoleActive(
      orgId: string,
      partyId: string,
      role: PartyRole,
      isActive: boolean,
      tx: Tx
    ): Promise<void> {
      await exec(tx)
        .update(partyRoles)
        .set({ isActive, updatedAt: new Date() })
        .where(
          and(
            eq(partyRoles.orgId, orgId),
            eq(partyRoles.partyId, partyId),
            eq(partyRoles.role, role)
          )
        )
    },

    async findRoleState(
      orgId: string,
      partyId: string,
      role: PartyRole,
      tx?: Tx,
      opts: { share?: boolean } = {}
    ): Promise<{ partyExists: boolean; roleRow: PartyRoleAssignment | null }> {
      const [partyRow] = await exec(tx)
        .select({ id: parties.id })
        .from(parties)
        .where(and(eq(parties.orgId, orgId), eq(parties.id, partyId)))
        .limit(1)

      if (!partyRow) return { partyExists: false, roleRow: null }

      const roleQueryBase = exec(tx)
        .select()
        .from(partyRoles)
        .where(
          and(
            eq(partyRoles.orgId, orgId),
            eq(partyRoles.partyId, partyId),
            eq(partyRoles.role, role)
          )
        )
        .limit(1)

      const [roleRow] = opts.share
        ? await roleQueryBase.for("share")
        : await roleQueryBase
      return { partyExists: true, roleRow: roleRow ?? null }
    },

    // ── list ──────────────────────────────────────────────────────────────

    async list(
      orgId: string,
      filters: ListFilter,
      tx?: Tx
    ): Promise<{
      rows: (PartyListRow & { roleRows: Pick<PartyRoleAssignment, "role" | "isActive">[] })[]
      total: number
    }> {
      const search = searchCondition(filters.search)
      const where = and(
        eq(parties.orgId, orgId),
        eq(partyRoles.role, filters.role),
        eq(partyRoles.isActive, filters.isActive),
        search
      )

      const primaryEmailSq = exec(tx)
        .select({ partyId: partyEmails.partyId, email: partyEmails.email })
        .from(partyEmails)
        .where(and(eq(partyEmails.orgId, orgId), eq(partyEmails.isPrimary, true)))

      const primaryPhoneSq = exec(tx)
        .select({ partyId: partyPhones.partyId, phone: partyPhones.phone })
        .from(partyPhones)
        .where(and(eq(partyPhones.orgId, orgId), eq(partyPhones.isPrimary, true)))

      const rows = await exec(tx)
        .select({
          party: parties,
          primaryEmail: sql<string | null>`pe.email`,
          primaryPhone: sql<string | null>`pp.phone`,
        })
        .from(parties)
        .innerJoin(
          partyRoles,
          and(eq(partyRoles.orgId, parties.orgId), eq(partyRoles.partyId, parties.id))
        )
        .leftJoin(
          sql`(${primaryEmailSq}) pe`,
          sql`pe.party_id = ${parties.id}`
        )
        .leftJoin(
          sql`(${primaryPhoneSq}) pp`,
          sql`pp.party_id = ${parties.id}`
        )
        .where(where)
        .orderBy(sql`lower(${parties.displayName})`, asc(parties.id))
        .limit(filters.pageSize)
        .offset((filters.page - 1) * filters.pageSize)

      const [counted] = await exec(tx)
        .select({ total: sql<number>`count(*)::int` })
        .from(parties)
        .innerJoin(
          partyRoles,
          and(eq(partyRoles.orgId, parties.orgId), eq(partyRoles.partyId, parties.id))
        )
        .where(where)

      const total = counted?.total ?? 0
      if (!rows.length) return { rows: [], total }

      // Load role summaries for the page
      const pageIds = rows.map((r) => r.party.id)
      const allRoles = await exec(tx)
        .select({ partyId: partyRoles.partyId, role: partyRoles.role, isActive: partyRoles.isActive })
        .from(partyRoles)
        .where(and(eq(partyRoles.orgId, orgId), inArray(partyRoles.partyId, pageIds)))

      const rolesByParty = new Map<string, Pick<PartyRoleAssignment, "role" | "isActive">[]>()
      for (const r of allRoles) {
        const existing = rolesByParty.get(r.partyId) ?? []
        existing.push({ role: r.role, isActive: r.isActive })
        rolesByParty.set(r.partyId, existing)
      }

      return {
        rows: rows.map((r) => ({
          ...r,
          roleRows: rolesByParty.get(r.party.id) ?? [],
        })),
        total,
      }
    },

    async listOptions(
      orgId: string,
      filters: OptionsFilter,
      tx?: Tx
    ): Promise<PartyOptionRow[]> {
      const sortKey = sql<string>`lower(${parties.displayName})`
      const search = searchCondition(filters.search)
      const afterCursor = filters.after
        ? sql`(lower(${parties.displayName}), ${parties.id}) > (${filters.after.name}::text, ${filters.after.id}::uuid)`
        : undefined

      const rows = await exec(tx)
        .select({ id: parties.id, name: parties.displayName, sortKey })
        .from(parties)
        .innerJoin(
          partyRoles,
          and(eq(partyRoles.orgId, parties.orgId), eq(partyRoles.partyId, parties.id))
        )
        .where(
          and(
            eq(parties.orgId, orgId),
            eq(partyRoles.role, filters.role),
            eq(partyRoles.isActive, true),
            search,
            afterCursor
          )
        )
        .orderBy(asc(sortKey), asc(parties.id))
        .limit(filters.limit)

      return rows
    },
  }
}

export type PartyRepository = ReturnType<typeof createPartyRepository>
