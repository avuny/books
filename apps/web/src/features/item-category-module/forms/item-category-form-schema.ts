import { z } from "@avuny/zod"
import {
  ITEM_CATEGORY_DESCRIPTION_MAX_LENGTH,
  ITEM_CATEGORY_NAME_MAX_LENGTH,
  ITEM_CATEGORY_NAME_MIN_LENGTH,
} from "@avuny/contracts"

import type { CreateItemCategoryInput, UpdateItemCategoryInput } from "../types"

/** A cleared combobox gives "" (or undefined): both mean "top level". */
const blankToNull = (value: unknown) => (value === "" || value === undefined ? null : value)

/**
 * Form-level schema. Same bounds as the contracts schemas (they come from the same
 * constants); it only adds what a form needs: text inputs are always strings and a
 * cleared parent picker means "no parent".
 */
export const ItemCategoryFormSchema = z.object({
  name: z.string().trim().min(ITEM_CATEGORY_NAME_MIN_LENGTH).max(ITEM_CATEGORY_NAME_MAX_LENGTH),
  description: z.string().trim().max(ITEM_CATEGORY_DESCRIPTION_MAX_LENGTH),
  parentId: z.preprocess(blankToNull, z.string().uuid().nullable()),
  isActive: z.boolean(),
})

export type ItemCategoryFormInput = z.input<typeof ItemCategoryFormSchema>
export type ItemCategoryFormValues = z.output<typeof ItemCategoryFormSchema>

export function toCreateItemCategoryInput(values: ItemCategoryFormValues): CreateItemCategoryInput {
  return {
    name: values.name,
    description: values.description || null,
    parentId: values.parentId,
  }
}

export function toUpdateItemCategoryInput(values: ItemCategoryFormValues): UpdateItemCategoryInput {
  return {
    name: values.name,
    description: values.description || null,
    parentId: values.parentId,
    isActive: values.isActive,
  }
}
