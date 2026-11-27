import type { ArAgingResponse, ArReconciliationResponse, CustomerStatementResponse, SalesInvoiceDto, SalesInvoiceLineDto } from "@avuny/contracts"

export type { ArAgingResponse, ArReconciliationResponse, CustomerStatementResponse, SalesInvoiceDto, SalesInvoiceLineDto }

export type InvoiceScope = "all" | "DRAFT" | "POSTED" | "REVERSED"
