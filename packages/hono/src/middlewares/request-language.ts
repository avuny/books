// packages/hono/src/request-language.ts
// Server only (uses node:async_hooks). Works on Node and Vercel's Node runtime.
import { AsyncLocalStorage } from "node:async_hooks";
import { createMiddleware } from "hono/factory";
import { defaultLocale, resolveLocale, type Locale } from "@avuny/i18n";
import { installZodLocaleResolver } from "@avuny/zod";

const storage = new AsyncLocalStorage<{ locale: Locale }>();

/**
 * Locale of the request being handled (defaultLocale outside a request).
 * Services can call getMessages(getRequestLocale()) without passing `c` around.
 */
export const getRequestLocale = (): Locale =>
  storage.getStore()?.locale ?? defaultLocale;

export type RequestLanguageEnv = { Variables: { locale: Locale } };

/**
 * Reads Accept-Language and keeps the locale for everything downstream
 * (validators, handlers, services). Register it before any route.
 */
export const resolveRequestLanguageMiddleware =
  createMiddleware<RequestLanguageEnv>(async (c, next) => {
    const locale = resolveLocale(c.req.header("accept-language"));
    c.set("locale", locale);
    await storage.run({ locale }, next);
  });

let installed = false;

/** Call once at startup (idempotent): zod messages follow the request locale. */
export const installRequestLanguage = () => {
  if (installed) return;
  installed = true;
  installZodLocaleResolver(getRequestLocale);
};
