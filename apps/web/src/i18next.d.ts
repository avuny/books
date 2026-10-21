import "i18next"
import { Messages } from "./resources.ts"


declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common"
    resources: Messages
  }
}
