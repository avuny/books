import { createOpenAPIRouter } from "@avuny/hono"
import { requireAuth } from "../../auth/index.js"
import { accountingService } from "../deps.js"
import type { RouteDeps } from "./module-routes.types.js"
import { createAccountRoute } from "./create-account.route.js"
import { listAccountsRoute } from "./list-accounts.route.js"
import { getAccountRoute } from "./get-account.route.js"
import { updateAccountRoute } from "./update-account.route.js"
import { deleteAccountRoute } from "./delete-account.route.js"
import { listAccountMappingsRoute } from "./list-account-mappings.route.js"
import { updateAccountMappingRoute } from "./update-account-mapping.route.js"
import { createJournalEntryRoute } from "./create-journal-entry.route.js"
import { listJournalEntriesRoute } from "./list-journal-entries.route.js"
import { getJournalEntryRoute } from "./get-journal-entry.route.js"
import { updateJournalEntryRoute } from "./update-journal-entry.route.js"
import { deleteJournalEntryRoute } from "./delete-journal-entry.route.js"
import { postJournalEntryRoute } from "./post-journal-entry.route.js"
import { reverseJournalEntryRoute } from "./reverse-journal-entry.route.js"
import { postOpeningBalancesRoute } from "./post-opening-balances.route.js"
import { listPeriodsRoute } from "./list-periods.route.js"
import { createPeriodRoute } from "./create-period.route.js"
import { closePeriodRoute } from "./close-period.route.js"
import { generalLedgerRoute } from "./general-ledger.route.js"
import { trialBalanceRoute } from "./trial-balance.route.js"
import { profitAndLossRoute } from "./profit-and-loss.route.js"
import { balanceSheetRoute } from "./balance-sheet.route.js"

export const createAccountingRoutes = (deps: RouteDeps) => {
  const router = createOpenAPIRouter()

  router.route("/", createAccountRoute(deps))
  router.route("/", listAccountsRoute(deps))
  router.route("/", getAccountRoute(deps))
  router.route("/", updateAccountRoute(deps))
  router.route("/", deleteAccountRoute(deps))
  router.route("/", listAccountMappingsRoute(deps))
  router.route("/", updateAccountMappingRoute(deps))
  router.route("/", createJournalEntryRoute(deps))
  router.route("/", listJournalEntriesRoute(deps))
  router.route("/", getJournalEntryRoute(deps))
  router.route("/", updateJournalEntryRoute(deps))
  router.route("/", deleteJournalEntryRoute(deps))
  router.route("/", postJournalEntryRoute(deps))
  router.route("/", reverseJournalEntryRoute(deps))
  router.route("/", postOpeningBalancesRoute(deps))
  router.route("/", listPeriodsRoute(deps))
  router.route("/", createPeriodRoute(deps))
  router.route("/", closePeriodRoute(deps))
  router.route("/", generalLedgerRoute(deps))
  router.route("/", trialBalanceRoute(deps))
  router.route("/", profitAndLossRoute(deps))
  router.route("/", balanceSheetRoute(deps))

  return router
}

export const accountingRoutes = createAccountingRoutes({
  service: accountingService,
  requireAuth,
})

export default accountingRoutes
