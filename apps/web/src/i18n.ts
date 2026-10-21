import { resources } from "@/resources"
import i18n from "i18next"
import ICU from "i18next-icu"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"
// <WIP>
// import { resources } from "@avuny/shared"

i18n
  .use(ICU)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,

    fallbackLng: "en",

    defaultNS: "common",

    interpolation: {
      escapeValue: false,
    },
    ns: ["common", "user"],

    returnNull: false,
    //  Configure the detector to save to localStorage
    detection: {
      order: ["localStorage", "cookie", "navigator"],
      caches: ["localStorage", "cookie"], // Caches the user's choice
    },
  })

export default i18n
