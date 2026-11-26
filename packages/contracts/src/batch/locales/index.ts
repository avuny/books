// Copy the JSON import style from role/locales/index.ts if your tsconfig needs a different form.
import en from "./en.json" with { type: "json" }
import ar from "./ar.json" with { type: "json" }

export const batchTranslationsEn = en
export const batchTranslationsAr = ar
