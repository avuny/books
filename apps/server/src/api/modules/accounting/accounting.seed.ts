import { isNull } from "drizzle-orm"
import { organizations, type DB } from "@avuny/db"
import { createAccountingRepository } from "./accounting.repository.js"
import { createAccountingService } from "./accounting.service.js"
import type { AccountingService } from "./accounting.types.js"

export interface AccountingSeedSummary {
  organizations: number
  accountsCreated: number
  mappingsCreated: number
  /** Organizations whose chart could not be initialized (for example a custom account already uses a default code). Their transaction was rolled back. */
  failed: { orgId: string; error: string; msg: string }[]
}

class InitializationRolledBack extends Error {
  constructor(
    readonly error: string,
    readonly msg: string
  ) {
    super(msg)
  }
}

/**
 * Idempotent backfill: gives every organization the default chart of accounts and the default
 * account mappings. New organizations get them when they are created; this covers the
 * organizations that existed before the accounting module. An organization that already has them
 * is left exactly as it is (no rename, no re-mapping). One transaction per organization, so one
 * problem organization never blocks or half-initializes the others.
 */
export async function syncAccountingDefaults(
  db: DB,
  service: AccountingService = createAccountingService({
    repository: createAccountingRepository({ db }),
  })
): Promise<AccountingSeedSummary> {
  const orgs = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(isNull(organizations.deletedAt))

  const summary: AccountingSeedSummary = {
    organizations: orgs.length,
    accountsCreated: 0,
    mappingsCreated: 0,
    failed: [],
  }

  for (const org of orgs) {
    try {
      const created = await db.transaction(async (tx) => {
        const result = await service.initializeChartOfAccounts(org.id, tx)
        if (!result.success) throw new InitializationRolledBack(result.error, result.msg)
        return result.data
      })
      summary.accountsCreated += created.accountsCreated
      summary.mappingsCreated += created.mappingsCreated
    } catch (err) {
      if (!(err instanceof InitializationRolledBack)) throw err
      summary.failed.push({ orgId: org.id, error: err.error, msg: err.msg })
    }
  }
  return summary
}
