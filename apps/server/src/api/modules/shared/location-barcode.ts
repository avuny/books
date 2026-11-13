import { randomBytes } from "node:crypto"
import {
  WAREHOUSE_LOCATION_BARCODE_PREFIX,
  WAREHOUSE_LOCATION_BARCODE_RANDOM_LENGTH,
} from "@avuny/contracts"

// Crockford-style base32 without I, L, O, U: 32 symbols, so `byte & 31` is unbiased.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

/**
 * Opaque barcode for a location, e.g. LOC-7K2M9Q4XJD3T (60 bits of randomness).
 * It encodes nothing about code or position, so printed labels survive renames and moves.
 */
export function generateLocationBarcode(): string {
  const bytes = randomBytes(WAREHOUSE_LOCATION_BARCODE_RANDOM_LENGTH)
  let out = ""
  for (const b of bytes) out += ALPHABET[b & 31]
  return `${WAREHOUSE_LOCATION_BARCODE_PREFIX}${out}`
}
