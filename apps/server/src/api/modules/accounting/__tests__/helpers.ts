import type { Result } from "@avuny/utils"
import type { AccountMappingKey } from "@avuny/contracts"
import type { ActivityLog, ActivityLogEntry } from "../accounting.types.js"
import { createAccountingService } from "../accounting.service.js"
import { createFakeAccountingRepository } from "./fake-accounting-repository.js"

export const ORG = "00000000-0000-4000-9000-000000000001"
export const OTHER_ORG = "00000000-0000-4000-9000-000000000002"
export const ACTOR = "00000000-0000-4000-9000-0000000000a1"
export const SOURCE_ID = "00000000-0000-4000-9000-0000000000b1"

/** A service wired to the in-memory repository, with two organizations and a recording audit log. */
export function setup(options: { now?: Date; chart?: boolean } = {}) {
  const repository = createFakeAccountingRepository()
  repository.addOrganization(ORG)
  repository.addOrganization(OTHER_ORG)
  const events: ActivityLogEntry[] = []
  const activityLog: ActivityLog = {
    async log(entry) {
      events.push(entry)
    },
  }
  let now = options.now ?? new Date("2026-11-15T10:00:00Z")
  const service = createAccountingService({ repository, activityLog, now: () => now })

  /** The default chart and mappings, written the way organization creation writes them. */
  const initChart = (orgId = ORG) =>
    repository.transaction((tx) => service.initializeChartOfAccounts(orgId, tx))

  /** The id of a default account, found by its stable system key. */
  const account = async (systemKey: string, orgId = ORG): Promise<string> => {
    const found = (await repository.listAllAccounts(orgId)).find((a) => a.systemKey === systemKey)
    if (!found) throw new Error(`No account with system key ${systemKey} in ${orgId}`)
    return found.id
  }
  const mapped = async (key: AccountMappingKey, orgId = ORG): Promise<string> => {
    const [row] = await repository.findMappings(orgId, [key])
    if (!row) throw new Error(`No mapping for ${key}`)
    return row.accountId
  }

  return {
    repository,
    service,
    events,
    initChart,
    account,
    mapped,
    setNow: (d: Date) => {
      now = d
    },
  }
}

export type Setup = ReturnType<typeof setup>

/** Unwraps a success; fails the test with the domain error otherwise. */
export function unwrap<T>(result: Result<T, string>): T {
  if (!result.success) throw new Error(`Expected success, got ${result.error}: ${result.msg}`)
  return result.data
}

/** The domain error code of a failed result, or null for a success. */
export const errorOf = (result: Result<unknown, string>): string | null =>
  result.success ? null : result.error

/** Runs `fn`, expects it to throw, and returns the thrown error. */
export async function thrown(fn: () => Promise<unknown>): Promise<Error> {
  try {
    await fn()
  } catch (err) {
    if (err instanceof Error) return err
    throw err
  }
  throw new Error("Expected the call to throw")
}

/** A manual journal line. */
export const line = (accountId: string, side: "debit" | "credit", amount: string, description?: string) => ({
  accountId,
  debit: side === "debit" ? amount : "0",
  credit: side === "credit" ? amount : "0",
  ...(description ? { description } : {}),
})

/** Creates and posts a balanced manual entry: Dr cash, Cr capital. */
export async function postedEntry(t: Setup, date: string, amount: string) {
  const cash = await t.account("CASH")
  const capital = await t.account("OWNERS_CAPITAL")
  const created = unwrap(
    await t.service.createJournalEntry(ACTOR, ORG, {
      date,
      description: "Capital",
      lines: [line(cash, "debit", amount), line(capital, "credit", amount)],
    })
  )
  return unwrap(await t.service.postJournalEntry(ACTOR, ORG, created.id))
}
