import { z } from "@avuny/zod"

export const apiErrorSchema = z.object({
  success: z.literal(false),
  type: z.string(),
  code: z.string(),
  message: z.string(),
})

export const apiValidationIssueSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  code: z.string(),
  message: z.string(),
})

export const apiValidationErrorSchema = apiErrorSchema.extend({
  type: z.literal("validation"),
  code: z.literal("VALIDATION_ERROR"),
  errors: z.array(apiValidationIssueSchema),
})

export type ApiError = z.infer<typeof apiErrorSchema>

export type ApiValidationIssue = z.infer<typeof apiValidationIssueSchema>

export type ApiValidationError = z.infer<typeof apiValidationErrorSchema>
