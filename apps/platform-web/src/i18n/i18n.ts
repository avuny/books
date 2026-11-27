import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import { resources } from "@/i18n/resources"

// Admin app is English only in v1 (decision Q22). Strings still go through keys
// so Arabic can be added later without touching components.
i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  defaultNS: "common",
  interpolation: { escapeValue: false },
  returnNull: false,
})

export default i18n
