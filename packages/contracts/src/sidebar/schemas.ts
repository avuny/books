import { z } from "@avuny/zod"
import { SidebarHeadingType, SidebarOptionName } from "./constants.js"

export const SidebarOrgParamsSchema = z.object({
  orgId: z.string().uuid(),
})
export type SidebarOrgParams = z.infer<typeof SidebarOrgParamsSchema>

export const SidebarOptionDtoSchema = z.object({
  id: z.string(),
  name: z.enum(SidebarOptionName),
  label: z.string(),
  icon: z.string().nullable(),
  path: z.string(),
})
export type SidebarOptionDto = z.infer<typeof SidebarOptionDtoSchema>

export const SidebarOptionsDtoSchema = z.array(SidebarOptionDtoSchema)

export const SidebarItemDtoSchema = z.object({
  id: z.string(),
  name: z.enum(SidebarHeadingType),
  label: z.string(),
  icon: z.string().nullable().optional(),
  options: SidebarOptionsDtoSchema,
})
export type SidebarItemDto = z.infer<typeof SidebarItemDtoSchema>

export const SidebarDtoSchema = z.array(SidebarItemDtoSchema)
export type SidebarDto = z.infer<typeof SidebarDtoSchema>
