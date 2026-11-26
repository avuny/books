import type {
  ApAgingResponse,
  ApReconciliationResponse,
  SupplierStatementResponse,
  CreateVendorBillFromReceiptInput,
  VendorBillDto,
  VendorBillLineDto,
  VendorPaymentDto,
} from "@avuny/contracts"

export type {
  ApAgingResponse,
  ApReconciliationResponse,
  SupplierStatementResponse,
  CreateVendorBillFromReceiptInput, VendorBillDto, VendorBillLineDto, VendorPaymentDto }

export type BillScope = "all" | "DRAFT" | "POSTED" | "REVERSED"
