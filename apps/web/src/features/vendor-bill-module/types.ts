import type {
  CreateVendorBillFromReceiptInput,
  VendorBillDto,
  VendorBillLineDto,
  VendorPaymentDto,
} from "@avuny/contracts"

export type { CreateVendorBillFromReceiptInput, VendorBillDto, VendorBillLineDto, VendorPaymentDto }

export type BillScope = "all" | "DRAFT" | "POSTED" | "REVERSED"
