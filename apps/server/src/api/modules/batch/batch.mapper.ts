import type { BatchDto } from "@avuny/contracts"
import type { Batch } from "@avuny/db"

export function toBatchDto(row: Batch): BatchDto {
  return {
    id: row.id,
    itemId: row.itemId,
    batchNumber: row.batchNumber,
    manufacturedOn: row.manufacturedOn,
    expiresOn: row.expiresOn,
    shelfLifeValue: row.shelfLifeValue,
    shelfLifeUnit: row.shelfLifeUnit,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
