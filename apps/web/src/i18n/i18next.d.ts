import "i18next"
import type { Messages } from "./resources.ts"

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common"
    resources: Messages
  }
}

