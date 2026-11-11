import { z } from "@avuny/zod"
import { CreateUnitSchema, UpdateUnitSchema } from "@avuny/contracts"
import type { CreateUnitFormValues, UpdateUnitFormValues } from "./unit-form-types"

export const createUnitFormSchema = CreateUnitSchema
export type CreateUnitFormInput = z.input<typeof createUnitFormSchema>

export const updateUnitFormSchema = UpdateUnitSchema
export type UpdateUnitFormInput = z.input<typeof updateUnitFormSchema>

export function toCreateUnitInput(values: CreateUnitFormValues) {
  return {
    name: values.name.trim(),
    symbol: values.symbol.trim(),
    type: values.type,
  }
}

export function toUpdateUnitInput(values: UpdateUnitFormValues) {
  return {
    ...(values.name !== undefined ? { name: values.name.trim() } : {}),
    ...(values.symbol !== undefined ? { symbol: values.symbol.trim() } : {}),
    ...(values.isActive !== undefined ? { isActive: values.isActive } : {}),
  }
}
