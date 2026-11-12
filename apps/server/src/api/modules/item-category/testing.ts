import type { ActivityLog } from "./item-category.types.js"

export class DummyItemCategoryActivityLog implements ActivityLog {
  async log(): Promise<void> {}
}

export { DummyPermissionChecker } from "../role/index.js"
