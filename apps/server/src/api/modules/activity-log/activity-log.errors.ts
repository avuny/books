export const ActivityLogErrorCode = {
  ACTIVITY_LOG_FORBIDDEN: "ACTIVITY_LOG_FORBIDDEN",
  ACTIVITY_LOG_INVALID_RANGE: "ACTIVITY_LOG_INVALID_RANGE",
} as const

export type ActivityLogErrorCode =
  (typeof ActivityLogErrorCode)[keyof typeof ActivityLogErrorCode]
