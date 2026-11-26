import {
  and,
  asc,
  eq,
  ilike,
  or,
  sql,
} from "drizzle-orm"
import {
  countries,
  countryTimezones,
  currencies,
  states,
  timezones,
  type DB,
  type Tx,
} from "@avuny/db"

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&")

export const createGeoRepository = ({ db }: { db: DB }) => {
  const exec = (tx?: Tx) => tx ?? db

  return {
    async listCountries(
      {
        search,
        locale,
      }: {
        search?: string
        locale?: string
      } = {},
      tx?: Tx
    ) {
      const localizedName = locale
        ? sql<string>`COALESCE(${countries.translations}->>${locale}, ${countries.name})`.as("name")
        : countries.name

      const conditions = []
      if (search?.trim()) {
        const pattern = `%${escapeLike(search.trim())}%`
        conditions.push(
          or(
            ilike(countries.name, pattern),
            ilike(countries.code, pattern),
            ilike(countries.native, pattern)
          )
        )
      }

      return exec(tx)
        .select({
          code: countries.code,
          name: localizedName,
          native: countries.native,
          phoneCode: countries.phoneCode,
          currencyCode: countries.currencyCode,
          emoji: countries.emoji,
        })
        .from(countries)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(asc(localizedName))
    },

    async getCountryByCode(code: string, locale?: string, tx?: Tx) {
      const normalizedCode = code.toUpperCase()
      const localizedName = locale
        ? sql<string>`COALESCE(${countries.translations}->>${locale}, ${countries.name})`.as("name")
        : countries.name

      const [country] = await exec(tx)
        .select({
          code: countries.code,
          name: localizedName,
          native: countries.native,
          phoneCode: countries.phoneCode,
          currencyCode: countries.currencyCode,
          emoji: countries.emoji,
          iso3: countries.iso3,
          numericCode: countries.numericCode,
          capital: countries.capital,
          tld: countries.tld,
          region: countries.region,
          subregion: countries.subregion,
        })
        .from(countries)
        .where(eq(countries.code, normalizedCode))
        .limit(1)

      if (!country) return null

      const tzRows = await exec(tx)
        .select({ timezoneName: countryTimezones.timezoneName })
        .from(countryTimezones)
        .where(eq(countryTimezones.countryCode, normalizedCode))
        .orderBy(asc(countryTimezones.timezoneName))

      return {
        ...country,
        timezones: tzRows.map((r) => r.timezoneName),
      }
    },

    async listStates(
      {
        countryCode,
        search,
        locale,
      }: {
        countryCode?: string
        search?: string
        locale?: string
      } = {},
      tx?: Tx
    ) {
      const localizedName = locale
        ? sql<string>`COALESCE(${states.translations}->>${locale}, ${states.name})`.as("name")
        : states.name

      const conditions = []
      if (countryCode?.trim()) {
        conditions.push(eq(states.countryCode, countryCode.trim().toUpperCase()))
      }
      if (search?.trim()) {
        const pattern = `%${escapeLike(search.trim())}%`
        conditions.push(
          or(
            ilike(states.name, pattern),
            ilike(states.code, pattern),
            ilike(states.native, pattern)
          )
        )
      }

      return exec(tx)
        .select({
          id: states.id,
          countryCode: states.countryCode,
          name: localizedName,
          native: states.native,
          code: states.code,
        })
        .from(states)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(asc(localizedName))
    },

    async getStateById(id: string, locale?: string, tx?: Tx) {
      const localizedName = locale
        ? sql<string>`COALESCE(${states.translations}->>${locale}, ${states.name})`.as("name")
        : states.name

      const [state] = await exec(tx)
        .select({
          id: states.id,
          countryCode: states.countryCode,
          name: localizedName,
          native: states.native,
          code: states.code,
        })
        .from(states)
        .where(eq(states.id, id))
        .limit(1)

      return state ?? null
    },

    async listCurrencies(
      {
        search,
      }: {
        search?: string
      } = {},
      tx?: Tx
    ) {
      const conditions = []
      if (search?.trim()) {
        const pattern = `%${escapeLike(search.trim())}%`
        conditions.push(
          or(
            ilike(currencies.code, pattern),
            ilike(currencies.name, pattern)
          )
        )
      }

      return exec(tx)
        .select({
          code: currencies.code,
          name: currencies.name,
          symbol: currencies.symbol,
        })
        .from(currencies)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(asc(currencies.code))
    },

    async listTimezones(
      {
        countryCode,
        search,
      }: {
        countryCode?: string
        search?: string
      } = {},
      tx?: Tx
    ) {
      if (countryCode?.trim()) {
        const conditions = [
          eq(countryTimezones.countryCode, countryCode.trim().toUpperCase()),
        ]
        if (search?.trim()) {
          const pattern = `%${escapeLike(search.trim())}%`
          conditions.push(ilike(countryTimezones.timezoneName, pattern))
        }

        const rows = await exec(tx)
          .select({
            name: countryTimezones.timezoneName,
          })
          .from(countryTimezones)
          .where(and(...conditions))
          .orderBy(asc(countryTimezones.timezoneName))

        return rows
      }

      const conditions = []
      if (search?.trim()) {
        const pattern = `%${escapeLike(search.trim())}%`
        conditions.push(ilike(timezones.name, pattern))
      }

      return exec(tx)
        .select({
          name: timezones.name,
        })
        .from(timezones)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(asc(timezones.name))
    },
  }
}

export type GeoRepository = ReturnType<typeof createGeoRepository>
