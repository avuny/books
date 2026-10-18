import "i18next"

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "otp"
    ns: "otp" | "auth" | "users" | "admin"
    resources: {
      otp: {
        errors: {
          OTP_INVALID: string
          OTP_EXPIRED: string
          OTP_ATTEMPTS_EXCEEDED: string
          OTP_RESEND_TOO_SOON: string
          OTP_RATE_LIMITED: string
          OTP_DELIVERY_FAILED: string
          VERIFICATION_TOKEN_INVALID: string
        }
      }
      auth: {
        errors: {
          INVALID_CREDENTIALS: string
          ACCOUNT_SUSPENDED: string
          TOO_MANY_ATTEMPTS: string
          REFRESH_TOKEN_INVALID: string
          REFRESH_TOKEN_REUSED: string
          SESSION_NOT_FOUND: string
          WEAK_PASSWORD: string
          INVALID_CURRENT_PASSWORD: string
          INVALID_IDENTIFIER_TYPE: string
        }
      }
      users: {
        errors: {
          IDENTIFIER_ALREADY_EXISTS: string
          IDENTIFIER_LIMIT_REACHED: string
          IDENTIFIER_NOT_FOUND: string
          IDENTIFIER_TYPE_MISMATCH: string
          CANNOT_DELETE_PRIMARY_IDENTIFIER: string
          CANNOT_DELETE_LAST_RECOVERY_IDENTIFIER: string
          AVATAR_TOO_LARGE: string
          AVATAR_INVALID_TYPE: string
        }
      }
      admin: {
        errors: {
          CANNOT_SUSPEND_SELF: string
          CANNOT_SUSPEND_ADMIN: string
          USER_ALREADY_SUSPENDED: string
          USER_NOT_SUSPENDED: string
          USER_NOT_FOUND: string
        }
      }
    }
  }
}
