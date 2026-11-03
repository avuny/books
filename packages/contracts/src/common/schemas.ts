import { z } from "@avuny/zod"
import { IDENTIFIER_MAX_LENGTH } from "./constants.js"

/**
 * Identifier schema strictly accepting valid emails.
 * Normalizes values by trimming and lowercasing.
 */
export const IdentifierSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(IDENTIFIER_MAX_LENGTH)

export const EmailSchema = IdentifierSchema
