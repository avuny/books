import type {
  CancelPurchaseOrderInput,
  ClosePurchaseOrderInput,
  CreatePurchaseOrderInput,
  PurchaseOrderDto,
  PurchaseOrderLineDto,
  PurchaseOrderListItemDto,
  PurchaseOrderStatus,
  UpdatePurchaseOrderInput,
} from "@avuny/contracts"

export type {
  CancelPurchaseOrderInput,
  ClosePurchaseOrderInput,
  CreatePurchaseOrderInput,
  PurchaseOrderDto,
  PurchaseOrderLineDto,
  PurchaseOrderListItemDto,
  PurchaseOrderStatus,
  UpdatePurchaseOrderInput,
}

// UI-only types
export type PurchaseOrderScope = "all" | "DRAFT" | "CONFIRMED" | "CLOSED" | "CANCELLED"
