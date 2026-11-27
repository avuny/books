import type { SalesInvoiceDto, SalesInvoiceLineDto } from "@avuny/contracts"

export type { SalesInvoiceDto, SalesInvoiceLineDto }

export type InvoiceScope = "all" | "DRAFT" | "POSTED" | "REVERSED"
