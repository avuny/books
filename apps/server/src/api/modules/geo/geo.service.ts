import { ok, fail, type Result, type Ok } from "@avuny/utils"
import {
  GeoErrorCode as Err,
  type CountryDetailDto,
  type CountryDto,
  type CurrencyDto,
  type StateDto,
  type TimezoneDto,
} from "@avuny/contracts"
import { db } from "../../db.js"
import {
  createGeoRepository,
  type GeoRepository,
} from "./geo.repository.js"

export interface GeoCache {
  get<T>(key: string): Promise<T | null>
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>
  del(key: string): Promise<void>
}

export class DummyGeoCache implements GeoCache {
  async get<T>(): Promise<T | null> {
    return null
  }
  async set(): Promise<void> {}
  async del(): Promise<void> {}
}

export interface GeoServiceDeps {
  repository: GeoRepository
  cache?: GeoCache
}

export const createGeoService = ({ repository, cache }: GeoServiceDeps) => {
  return {
    async listCountries({
      search,
      locale,
    }: {
      search?: string
      locale?: string
    } = {}): Promise<Ok<CountryDto[]>> {
      const cacheKey = `geo:countries:${locale ?? "default"}:${search?.toLowerCase() ?? "all"}`
      if (cache) {
        const cached = await cache.get<CountryDto[]>(cacheKey)
        if (cached) return ok({ data: cached })
      }

      const rows = await repository.listCountries({ search, locale })

      if (cache) {
        await cache.set(cacheKey, rows, 3600)
      }

      return ok({ data: rows })
    },

    async getCountryByCode(
      code: string,
      locale?: string
    ): Promise<Result<CountryDetailDto, typeof Err.COUNTRY_NOT_FOUND>> {
      const cacheKey = `geo:country:${code.toUpperCase()}:${locale ?? "default"}`
      if (cache) {
        const cached = await cache.get<CountryDetailDto>(cacheKey)
        if (cached) return ok({ data: cached })
      }

      const country = await repository.getCountryByCode(code, locale)
      if (!country) {
        return fail({
          error: Err.COUNTRY_NOT_FOUND,
          msg: "Country not found",
        })
      }

      if (cache) {
        await cache.set(cacheKey, country, 3600)
      }

      return ok({ data: country })
    },

    async listStates({
      countryCode,
      search,
      locale,
    }: {
      countryCode?: string
      search?: string
      locale?: string
    } = {}): Promise<Ok<StateDto[]>> {
      const cacheKey = `geo:states:${countryCode?.toUpperCase() ?? "all"}:${locale ?? "default"}:${search?.toLowerCase() ?? "all"}`
      if (cache) {
        const cached = await cache.get<StateDto[]>(cacheKey)
        if (cached) return ok({ data: cached })
      }

      const rows = await repository.listStates({ countryCode, search, locale })

      if (cache) {
        await cache.set(cacheKey, rows, 3600)
      }

      return ok({ data: rows })
    },

    async listCurrencies({
      search,
    }: {
      search?: string
    } = {}): Promise<Ok<CurrencyDto[]>> {
      const cacheKey = `geo:currencies:${search?.toLowerCase() ?? "all"}`
      if (cache) {
        const cached = await cache.get<CurrencyDto[]>(cacheKey)
        if (cached) return ok({ data: cached })
      }

      const rows = await repository.listCurrencies({ search })

      if (cache) {
        await cache.set(cacheKey, rows, 3600)
      }

      return ok({ data: rows })
    },

    async listTimezones({
      countryCode,
      search,
    }: {
      countryCode?: string
      search?: string
    } = {}): Promise<Ok<TimezoneDto[]>> {
      const cacheKey = `geo:timezones:${countryCode?.toUpperCase() ?? "all"}:${search?.toLowerCase() ?? "all"}`
      if (cache) {
        const cached = await cache.get<TimezoneDto[]>(cacheKey)
        if (cached) return ok({ data: cached })
      }

      const rows = await repository.listTimezones({ countryCode, search })

      if (cache) {
        await cache.set(cacheKey, rows, 3600)
      }

      return ok({ data: rows })
    },
  }
}

export type GeoService = ReturnType<typeof createGeoService>

export const createDefaultGeoService = (): GeoService => {
  const repository = createGeoRepository({ db })
  const cache = new DummyGeoCache()
  return createGeoService({ repository, cache })
}

export const geoService = createDefaultGeoService()
