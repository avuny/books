import type { ErrorMeta } from "@avuny/utils"
import type { SalesCreditNoteErrorCode } from "@avuny/contracts"

export const salesCreditNoteErrorsHttpMap = {
  SALES_CREDIT_NOTE_NOT_FOUND: { statusCode: 404, responseMessage: "Credit note not found" },
  SALES_CREDIT_NOTE_NOT_EDITABLE: { statusCode: 409, responseMessage: "Only draft credit notes can be edited" },
  SALES_CREDIT_NOTE_NOT_DELETABLE: { statusCode: 409, responseMessage: "Only draft credit notes can be deleted. Reverse a posted one instead" },
  SALES_CREDIT_NOTE_ALREADY_POSTED: { statusCode: 409, responseMessage: "The credit note is already posted" },
  SALES_CREDIT_NOTE_NOT_POSTED: { statusCode: 409, responseMessage: "Only posted credit notes can be reversed" },
  SALES_CREDIT_NOTE_INVOICE_NOT_FOUND: { statusCode: 404, responseMessage: "The invoice does not exist" },
  SALES_CREDIT_NOTE_INVOICE_NOT_POSTED: { statusCode: 409, responseMessage: "Only posted invoices can be credited" },
  SALES_CREDIT_NOTE_AMOUNT_NOT_POSITIVE: { statusCode: 422, responseMessage: "The credit must be greater than zero" },
  SALES_CREDIT_NOTE_EXCEEDS_OUTSTANDING: { statusCode: 409, responseMessage: "The credit is more than what is still owed on the invoice" },
  SALES_CREDIT_NOTE_POSTING_FAILED: { statusCode: 409, responseMessage: "Posting the credit note failed. Nothing was changed. Please try again" },
  SALES_CREDIT_NOTE_NUMBER_TAKEN: { statusCode: 409, responseMessage: "Could not allocate a credit note number. Please try again" },
} as const satisfies Record<SalesCreditNoteErrorCode, ErrorMeta>
