import { fail, ok, decodeCursor, toCursorPage, type Result } from "@avuny/utils"
import {
  PARTY_AUDIT_EVENTS,
  PartyOptionCursorSchema,
  type CreatePartyInput,
  type UpdatePartyInput,
  type PartyRole,
  type PartyDto,
  type PartyOffsetListResponse,
  type PartyOptionListQuery,
  type PartyOffsetListQuery,
} from "@avuny/contracts/party"
import { RoleErrorCode } from "@avuny/contracts"
import { PartyErrorCode } from "./party.errors.js"
import { toPartyDto, toPartyListItemDto } from "./party.mapper.js"
import { partyRules as defaultRules } from "./party.rules.js"
import { PARTY_PERMISSIONS } from "./party.permissions.js"
import { DummyActivityLog } from "./testing.js"
import type { PartyServiceDeps, PartyRules } from "./party.types.js"
import type { Tx } from "@avuny/db"

type Code = PartyErrorCode | "ROLE_PERMISSION_DENIED"

type Outcome<T> = T | { failed: true; error: Code; msg: string }
const isFailure = (v: unknown): v is { failed: true; error: Code; msg: string } =>
  typeof v === "object" && v !== null && (v as { failed?: boolean }).failed === true

const forbidden = (): { failed: true; error: Code; msg: string } => ({
  failed: true,
  error: RoleErrorCode.ROLE_PERMISSION_DENIED,
  msg: "You do not have permission to perform this action",
})

const stop = (error: PartyErrorCode, msg: string): { failed: true; error: Code; msg: string } => ({
  failed: true,
  error,
  msg,
})

export function createPartyService(deps: PartyServiceDeps) {
  const repo = deps.repository
  const perms = deps.permissions
  const rules: PartyRules = deps.rules ?? defaultRules
  const activityLog = deps.activityLog ?? new DummyActivityLog()

  const can = (userId: string, key: Parameters<typeof perms.check>[1], orgId: string): Promise<boolean> =>
    perms.check({ userId }, key, { orgId, resourceId: orgId })

  /* ------------------------------------------------------------------ create */

  async function create(
    actorId: string,
    orgId: string,
    input: CreatePartyInput
  ): Promise<Result<PartyDto, Code>> {
    for (const role of input.roles) {
      const perm = PARTY_PERMISSIONS[role].CREATE
      if (!(await can(actorId, perm, orgId))) {
        return fail({ error: RoleErrorCode.ROLE_PERMISSION_DENIED, msg: "You do not have permission to create this party" })
      }
    }

    if (rules.hasDuplicateEmail(input.emails)) {
      return fail({ error: PartyErrorCode.PARTY_EMAIL_ALREADY_EXISTS, msg: "An email appears more than once" })
    }

    const partyId = await repo.transaction(async (tx) => {
      return repo.insertAggregate(
        orgId,
        {
          partyType: input.partyType,
          salutation: input.salutation ?? null,
          displayName: input.displayName,
          legalName: input.legalName ?? null,
          taxNumber: input.taxNumber ?? null,
          website: input.website ?? null,
          notes: input.notes ?? null,
        },
        input.roles,
        {
          emails: input.emails.map((e) => ({ email: e.email, label: e.label ?? null, isPrimary: e.isPrimary })),
          phones: input.phones.map((p) => ({ phone: p.phone, label: p.label ?? null, isPrimary: p.isPrimary })),
          addresses: input.addresses.map((a) => ({
            label: a.label ?? null,
            addressLine1: a.addressLine1,
            addressLine2: a.addressLine2 ?? null,
            city: a.city ?? null,
            state: a.state ?? null,
            postalCode: a.postalCode ?? null,
            countryCode: a.countryCode ?? null,
            isPrimary: a.isPrimary,
          })),
        },
        tx
      )
    })

    const aggregate = await repo.findAggregate(orgId, partyId)
    if (!aggregate) throw new Error("INVARIANT: party missing after insert")

    for (const role of input.roles) {
      const event = role === "CUSTOMER" ? PARTY_AUDIT_EVENTS.CUSTOMER_CREATED : PARTY_AUDIT_EVENTS.VENDOR_CREATED
      await activityLog.log({
        action: event,
        orgId,
        actorId,
        resourceId: partyId,
        metadata: { roles: input.roles, via: "create" },
      })
    }

    return ok({ data: toPartyDto(aggregate), msg: "Party created" })
  }

  /* ------------------------------------------------------------------ update */

  async function update(
    actorId: string,
    orgId: string,
    id: string,
    role: PartyRole,
    input: UpdatePartyInput
  ): Promise<Result<PartyDto, Code>> {
    const perm = PARTY_PERMISSIONS[role].UPDATE
    if (!(await can(actorId, perm, orgId))) {
      return fail({ error: RoleErrorCode.ROLE_PERMISSION_DENIED, msg: "You do not have permission to update this party" })
    }

    if (input.emails && rules.hasDuplicateEmail(input.emails)) {
      return fail({ error: PartyErrorCode.PARTY_EMAIL_ALREADY_EXISTS, msg: "An email appears more than once" })
    }

    const outcome: Outcome<string> = await repo.transaction(async (tx) => {
      const aggregate = await repo.findAggregate(orgId, id, tx, { lock: true })
      const state = rules.roleState(aggregate, role)

      const activeErr = rules.assertActive(state)
      if (activeErr) return stop(activeErr, "Party or role not active")

      if (input.salutation !== undefined) {
        const salErr = rules.checkSalutation(aggregate!.party.partyType, input.salutation)
        if (salErr) return stop(salErr, "Salutation is not allowed for ORGANIZATION parties")
      }

      let emailPlan
      let phonePlan
      let addressPlan

      if (input.emails !== undefined) {
        const r = rules.planEmailReplacement(aggregate!.emails, input.emails)
        if ("error" in r) return stop(r.error, "One or more contact IDs not found")
        emailPlan = r
      }
      if (input.phones !== undefined) {
        const r = rules.planPhoneReplacement(aggregate!.phones, input.phones)
        if ("error" in r) return stop(r.error, "One or more contact IDs not found")
        phonePlan = r
      }
      if (input.addresses !== undefined) {
        const r = rules.planAddressReplacement(aggregate!.addresses, input.addresses)
        if ("error" in r) return stop(r.error, "One or more contact IDs not found")
        addressPlan = r
      }

      const sharedPatch: Record<string, unknown> = {}
      if (input.displayName !== undefined) sharedPatch.displayName = input.displayName
      if (input.salutation !== undefined) sharedPatch.salutation = input.salutation
      if (input.legalName !== undefined) sharedPatch.legalName = input.legalName
      if (input.taxNumber !== undefined) sharedPatch.taxNumber = input.taxNumber
      if (input.website !== undefined) sharedPatch.website = input.website
      if (input.notes !== undefined) sharedPatch.notes = input.notes
      await repo.updateShared(orgId, id, sharedPatch as Parameters<typeof repo.updateShared>[2], tx)

      if (emailPlan) await repo.applyEmailPlan(orgId, id, emailPlan, tx)
      if (phonePlan) await repo.applyPhonePlan(orgId, id, phonePlan, tx)
      if (addressPlan) await repo.applyAddressPlan(orgId, id, addressPlan, tx)

      return id
    })

    if (isFailure(outcome)) return fail({ error: outcome.error, msg: outcome.msg })

    const aggregate = await repo.findAggregate(orgId, outcome)
    if (!aggregate) throw new Error("INVARIANT: party missing after update")

    const event = role === "CUSTOMER" ? PARTY_AUDIT_EVENTS.CUSTOMER_UPDATED : PARTY_AUDIT_EVENTS.VENDOR_UPDATED
    await activityLog.log({
      action: event,
      orgId,
      actorId,
      resourceId: outcome,
      metadata: { changedFields: rules.changedFields(input as Record<string, unknown>) },
    })

    return ok({ data: toPartyDto(aggregate), msg: "Party updated" })
  }

  /* ------------------------------------------------------------------ delete (deactivate) */

  async function deleteRole(
    actorId: string,
    orgId: string,
    id: string,
    role: PartyRole
  ): Promise<Result<PartyDto, Code>> {
    const perm = PARTY_PERMISSIONS[role].DELETE
    if (!(await can(actorId, perm, orgId))) {
      return fail({ error: RoleErrorCode.ROLE_PERMISSION_DENIED, msg: "You do not have permission to deactivate this party role" })
    }

    const outcome: Outcome<string> = await repo.transaction(async (tx) => {
      const aggregate = await repo.findAggregate(orgId, id, tx, { lock: true })
      const state = rules.roleState(aggregate, role)
      const activeErr = rules.assertActive(state)
      if (activeErr) return stop(activeErr, "Party or role not active")
      await repo.setRoleActive(orgId, id, role, false, tx)
      return id
    })

    if (isFailure(outcome)) return fail({ error: outcome.error, msg: outcome.msg })

    const aggregate = await repo.findAggregate(orgId, id)
    if (!aggregate) throw new Error("INVARIANT: party missing after deactivate")

    const event = role === "CUSTOMER" ? PARTY_AUDIT_EVENTS.CUSTOMER_DEACTIVATED : PARTY_AUDIT_EVENTS.VENDOR_DEACTIVATED
    await activityLog.log({ action: event, orgId, actorId, resourceId: id, metadata: {} })

    return ok({ data: toPartyDto(aggregate), msg: "Party role deactivated" })
  }

  /* ------------------------------------------------------------------ addRole (H4) */

  async function addRole(
    actorId: string,
    orgId: string,
    partyId: string,
    role: PartyRole
  ): Promise<Result<PartyDto, Code>> {
    const canCreate = await can(actorId, PARTY_PERMISSIONS[role].CREATE, orgId)
    const canUpdate = await can(actorId, PARTY_PERMISSIONS[role].UPDATE, orgId)

    if (!canCreate && !canUpdate) {
      return fail({ error: RoleErrorCode.ROLE_PERMISSION_DENIED, msg: "You do not have permission to add this role" })
    }

    const outcome: Outcome<{ partyId: string; decision: "insert" | "reactivate" }> =
      await repo.transaction(async (tx) => {
        const aggregate = await repo.findAggregate(orgId, partyId, tx, { lock: true })
        const state = rules.roleState(aggregate, role)
        const result = rules.decideAddRole(state)

        if ("error" in result) return stop(result.error, "Cannot add role")

        const decision = result.decision

        if (decision === "insert" && !canCreate) return forbidden()
        if (decision === "reactivate" && !canUpdate) return forbidden()

        if (decision === "insert") {
          await repo.insertRole(orgId, partyId, role, tx)
        } else {
          await repo.setRoleActive(orgId, partyId, role, true, tx)
        }

        return { partyId, decision }
      })

    if (isFailure(outcome)) return fail({ error: outcome.error, msg: outcome.msg })

    const aggregate = await repo.findAggregate(orgId, partyId)
    if (!aggregate) throw new Error("INVARIANT: party missing after addRole")

    const { decision } = outcome
    const event =
      decision === "insert"
        ? (role === "CUSTOMER" ? PARTY_AUDIT_EVENTS.CUSTOMER_CREATED : PARTY_AUDIT_EVENTS.VENDOR_CREATED)
        : (role === "CUSTOMER" ? PARTY_AUDIT_EVENTS.CUSTOMER_REACTIVATED : PARTY_AUDIT_EVENTS.VENDOR_REACTIVATED)
    await activityLog.log({
      action: event,
      orgId,
      actorId,
      resourceId: partyId,
      metadata: decision === "insert" ? { via: "addRole" } : {},
    })

    return ok({ data: toPartyDto(aggregate), msg: "Party role added" })
  }

  /* ------------------------------------------------------------------ get */

  async function get(
    actorId: string,
    orgId: string,
    id: string,
    role: PartyRole
  ): Promise<Result<PartyDto, Code>> {
    const perm = PARTY_PERMISSIONS[role].READ
    if (!(await can(actorId, perm, orgId))) {
      return fail({ error: RoleErrorCode.ROLE_PERMISSION_DENIED, msg: "You do not have permission to view this party" })
    }

    const aggregate = await repo.findAggregate(orgId, id)
    const state = rules.roleState(aggregate, role)
    const err = rules.assertReadable(state)
    if (err) return fail({ error: err, msg: "Party or role not found" })

    return ok({ data: toPartyDto(aggregate!), msg: "Party retrieved" })
  }

  /* ------------------------------------------------------------------ list */

  async function list(
    actorId: string,
    orgId: string,
    query: PartyOffsetListQuery
  ): Promise<Result<PartyOffsetListResponse, Code>> {
    const perm = PARTY_PERMISSIONS[query.role].READ
    if (!(await can(actorId, perm, orgId))) {
      return fail({ error: RoleErrorCode.ROLE_PERMISSION_DENIED, msg: "You do not have permission to list parties" })
    }

    const { rows, total } = await repo.list(orgId, query)

    return ok({
      data: {
        items: rows.map(toPartyListItemDto),
        page: query.page,
        pageSize: query.pageSize,
        total,
      },
      msg: "Parties retrieved",
    })
  }

  /* ------------------------------------------------------------------ listOptions */

  async function listOptions(
    actorId: string,
    orgId: string,
    query: PartyOptionListQuery
  ): Promise<Result<{ items: { id: string; name: string }[]; nextCursor: string | null }, Code>> {
    const perm = PARTY_PERMISSIONS[query.role].READ
    if (!(await can(actorId, perm, orgId))) {
      return fail({ error: RoleErrorCode.ROLE_PERMISSION_DENIED, msg: "You do not have permission to list party options" })
    }

    const after = decodeCursor(query.cursor, PartyOptionCursorSchema)

    const rows = await repo.listOptions(orgId, {
      role: query.role,
      search: query.search,
      after,
      limit: query.limit + 1,
    })

    const page = toCursorPage(rows, query.limit, (row) => ({ name: row.sortKey, id: row.id }))

    return ok({
      data: {
        items: page.items.map((r) => ({ id: r.id, name: r.name })),
        nextCursor: page.nextCursor,
      },
      msg: "Party options retrieved",
    })
  }

  /* ------------------------------------------------------------------ assertActiveRole (domain port) */

  async function assertActiveRole(
    orgId: string,
    partyId: string,
    role: PartyRole,
    tx?: Tx
  ): Promise<Result<void, PartyErrorCode>> {
    const { partyExists, roleRow } = await repo.findRoleState(orgId, partyId, role, tx, {
      share: tx !== undefined,
    })

    const state =
      !partyExists
        ? "party_missing" as const
        : !roleRow
          ? "role_missing" as const
          : roleRow.isActive
            ? "active" as const
            : "inactive" as const

    const err = rules.assertActive(state)
    if (err) return fail({ error: err, msg: "Party role is not active" })
    return ok({ data: undefined, msg: "Party role is active" })
  }

  return {
    create,
    update,
    delete: deleteRole,
    get,
    list,
    listOptions,
    addRole,
    assertActiveRole,
  }
}
