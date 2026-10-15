// packages/zod/src/index.ts
// The only place `z` should be imported from. No Node/DOM APIs.
import { z } from "@hono/zod-openapi";
import type { Locale } from "@avuny/i18n";

export { z };

// One zod error map per supported locale, built once.
// `satisfies` fails the build if a Locale has no zod translation.
const errorMaps = {
  en: z.locales.en().localeError,
  ar: z.locales.ar().localeError,
} satisfies Record<Locale, unknown>;

/**
 * Clients (web/mobile): one user per runtime, so switching the global
 * locale is safe. Call it when the user changes language.
 */
export const setZodLocale = (locale: Locale) => {
  z.config({ localeError: errorMaps[locale] });
};

/**
 * Server: call once at startup. Zod calls `getLocale()` every time it
 * formats an issue, so concurrent requests never overwrite each other's
 * language (unlike calling setZodLocale per request).
 */
export const installZodLocaleResolver = (getLocale: () => Locale) => {
  z.config({ localeError: (issue) => errorMaps[getLocale()](issue) });
};

/** @deprecated Use `Locale` from "@avuny/i18n". */
export type ZodLocale = Locale;