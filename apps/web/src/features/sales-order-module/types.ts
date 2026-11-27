import type {
  CancelSalesOrderInput,
  CloseSalesOrderInput,
  CreateSalesOrderInput,
  SalesOrderDto,
  SalesOrderLineDto,
  SalesOrderListItemDto,
  SalesOrderStatus,
  UpdateSalesOrderInput,
} from "@avuny/contracts"

export type {
  CancelSalesOrderInput,
  CloseSalesOrderInput,
  CreateSalesOrderInput,
  SalesOrderDto,
  SalesOrderLineDto,
  SalesOrderListItemDto,
  SalesOrderStatus,
  UpdateSalesOrderInput,
}

// UI-only types
export type SalesOrderScope = "all" | "DRAFT" | "CONFIRMED" | "CLOSED" | "CANCELLED"
