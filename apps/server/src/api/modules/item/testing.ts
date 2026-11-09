import type { ActivityLog, ItemStockHistory } from "./item.types.js"

export class DummyStockHistory implements ItemStockHistory {
  async hasMovements(): Promise<boolean> {
    return false
  }
}

export class DummyItemActivityLog implements ActivityLog {
  async log(): Promise<void> {}
}
