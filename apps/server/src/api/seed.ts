import { db } from "./db.js"
import { syncAccountingDefaults } from "./modules/accounting/accounting.seed.js"
import { seedInventoryAdjustmentReasons } from "./modules/inventory-adjustment/inventory-adjustment.seed.js"
import { syncSystemRoles } from "./modules/role/role.seed.js"
import { seedSidebar } from "./modules/sidebar/sidebar.seed.js"
import { syncSystemUnits } from "./modules/unit/unit.seed.js"

// Every deploy-time sync in one command. Each one is idempotent and takes its data from
// @avuny/contracts (system roles are validated against the module registry, the sidebar
// is derived from it, units come from SYSTEM_UNITS), so nothing here changes when a
// module is added.
console.log("roles:", await syncSystemRoles(db))
console.log("sidebar:", await seedSidebar({ db }))
console.log("units:", await syncSystemUnits(db))
console.log("accounting:", await syncAccountingDefaults(db))
console.log(
  "inventory-adjustment-reasons:",
  await seedInventoryAdjustmentReasons({ db })
)
process.exit(0)
