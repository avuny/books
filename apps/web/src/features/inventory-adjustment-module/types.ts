import type {
  CreateInventoryAdjustmentInput,
  InventoryAdjustmentDirection,
  InventoryAdjustmentDto,
  InventoryAdjustmentLineDto,
  InventoryAdjustmentListItemDto,
  InventoryAdjustmentReasonDto,
  InventoryAdjustmentStatus,
  StockSnapshotDto,
  StockSnapshotQuery,
  UpdateInventoryAdjustmentInput,
} from "@avuny/contracts"

export type {
  CreateInventoryAdjustmentInput,
  InventoryAdjustmentDirection,
  InventoryAdjustmentDto,
  InventoryAdjustmentLineDto,
  InventoryAdjustmentListItemDto,
  InventoryAdjustmentReasonDto,
  InventoryAdjustmentStatus,
  StockSnapshotDto,
  StockSnapshotQuery,
  UpdateInventoryAdjustmentInput,
}

// UI-only types
export type InventoryAdjustmentScope = "all" | "DRAFT" | "CONFIRMED" | "CANCELLED"
