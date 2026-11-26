import { z } from "@avuny/zod"
import {
  COUNTRY_CODE_LENGTH,
  CURRENCY_CODE_LENGTH,
  COUNTRY_CODE_REGEX,
  CURRENCY_CODE_REGEX,
} from "./constants.js"

// ── Identifiers & Codes ─────────────────────────────────────────────────────

export const CountryCodeSchema = z
  .string()
  .length(COUNTRY_CODE_LENGTH)
  .regex(COUNTRY_CODE_REGEX, "Country code must be 2 uppercase ISO letters")

export const CurrencyCodeSchema = z
  .string()
  .length(CURRENCY_CODE_LENGTH)
  .regex(CURRENCY_CODE_REGEX, "Currency code must be 3 uppercase ISO letters")

// ── DTOs ───────────────────────────────────────────────────────────────────

export const CountryDtoSchema = z.object({
  code: z.string().length(COUNTRY_CODE_LENGTH),
  name: z.string(),
  native: z.string().nullable(),
  phoneCode: z.string().nullable(),
  currencyCode: z.string().nullable(),
  emoji: z.string().nullable(),
})
export type CountryDto = z.infer<typeof CountryDtoSchema>

export const CountryDetailDtoSchema = CountryDtoSchema.extend({
  iso3: z.string().nullable(),
  numericCode: z.string().nullable(),
  capital: z.string().nullable(),
  tld: z.string().nullable(),
  region: z.string().nullable(),
  subregion: z.string().nullable(),
  timezones: z.array(z.string()),
})
export type CountryDetailDto = z.infer<typeof CountryDetailDtoSchema>

export const StateDtoSchema = z.object({
  id: z.string().uuid(),
  countryCode: z.string().length(COUNTRY_CODE_LENGTH),
  name: z.string(),
  native: z.string().nullable(),
  code: z.string().nullable(),
})
export type StateDto = z.infer<typeof StateDtoSchema>

export const CurrencyDtoSchema = z.object({
  code: z.string().length(CURRENCY_CODE_LENGTH),
  name: z.string(),
  symbol: z.string().nullable(),
})
export type CurrencyDto = z.infer<typeof CurrencyDtoSchema>

export const TimezoneDtoSchema = z.object({
  name: z.string(),
})
export type TimezoneDto = z.infer<typeof TimezoneDtoSchema>

// ── List Responses ──────────────────────────────────────────────────────────

export const CountryListResponseSchema = z.array(CountryDtoSchema)
export type CountryListResponse = z.infer<typeof CountryListResponseSchema>

export const StateListResponseSchema = z.array(StateDtoSchema)
export type StateListResponse = z.infer<typeof StateListResponseSchema>

export const CurrencyListResponseSchema = z.array(CurrencyDtoSchema)
export type CurrencyListResponse = z.infer<typeof CurrencyListResponseSchema>

export const TimezoneListResponseSchema = z.array(TimezoneDtoSchema)
export type TimezoneListResponse = z.infer<typeof TimezoneListResponseSchema>

// ── Query Schemas ───────────────────────────────────────────────────────────

export const CountryListQuerySchema = z.object({
  search: z.string().optional(),
})
export type CountryListQuery = z.infer<typeof CountryListQuerySchema>

export const StateListQuerySchema = z.object({
  countryCode: z.string().length(COUNTRY_CODE_LENGTH).optional(),
  search: z.string().optional(),
})
export type StateListQuery = z.infer<typeof StateListQuerySchema>

export const CurrencyListQuerySchema = z.object({
  search: z.string().optional(),
})
export type CurrencyListQuery = z.infer<typeof CurrencyListQuerySchema>

export const TimezoneListQuerySchema = z.object({
  countryCode: z.string().length(COUNTRY_CODE_LENGTH).optional(),
  search: z.string().optional(),
})
export type TimezoneListQuery = z.infer<typeof TimezoneListQuerySchema>
