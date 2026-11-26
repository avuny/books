import { describe, expect, it, vi } from "vitest"
import { GeoErrorCode as Err } from "@avuny/contracts"
import { createGeoService, type GeoCache } from "./geo.service.js"
import type { GeoRepository } from "./geo.repository.js"

describe("GeoService", () => {
  const mockRepository: GeoRepository = {
    listCountries: vi.fn(),
    getCountryByCode: vi.fn(),
    listStates: vi.fn(),
    getStateById: vi.fn(),
    listCurrencies: vi.fn(),
    listTimezones: vi.fn(),
  }

  const mockCache: GeoCache = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
  }

  const service = createGeoService({
    repository: mockRepository,
    cache: mockCache,
  })

  describe("listCountries", () => {
    it("returns countries list and stores in cache", async () => {
      const mockCountries = [
        {
          code: "EG",
          name: "Egypt",
          native: "مصر",
          phoneCode: "20",
          currencyCode: "EGP",
          emoji: "🇪🇬",
        },
      ]
      vi.mocked(mockRepository.listCountries).mockResolvedValueOnce(mockCountries)

      const result = await service.listCountries({ locale: "en" })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockCountries)
      }
      expect(mockRepository.listCountries).toHaveBeenCalledWith({
        search: undefined,
        locale: "en",
      })
      expect(mockCache.set).toHaveBeenCalled()
    })
  })

  describe("getCountryByCode", () => {
    it("returns country detail when found", async () => {
      const mockCountry = {
        code: "EG",
        name: "Egypt",
        native: "مصر",
        phoneCode: "20",
        currencyCode: "EGP",
        emoji: "🇪🇬",
        iso3: "EGY",
        numericCode: "818",
        capital: "Cairo",
        tld: ".eg",
        region: "Africa",
        subregion: "Northern Africa",
        timezones: ["Africa/Cairo"],
      }
      vi.mocked(mockRepository.getCountryByCode).mockResolvedValueOnce(mockCountry)

      const result = await service.getCountryByCode("EG")

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockCountry)
      }
    })

    it("returns fail with COUNTRY_NOT_FOUND when country does not exist", async () => {
      vi.mocked(mockRepository.getCountryByCode).mockResolvedValueOnce(null)

      const result = await service.getCountryByCode("ZZ")

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe(Err.COUNTRY_NOT_FOUND)
      }
    })
  })

  describe("listStates", () => {
    it("returns states filtered by country", async () => {
      const mockStates = [
        {
          id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
          countryCode: "EG",
          name: "Cairo",
          native: "القاهرة",
          code: "C",
        },
      ]
      vi.mocked(mockRepository.listStates).mockResolvedValueOnce(mockStates)

      const result = await service.listStates({ countryCode: "EG" })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockStates)
      }
      expect(mockRepository.listStates).toHaveBeenCalledWith({
        countryCode: "EG",
        search: undefined,
        locale: undefined,
      })
    })
  })

  describe("listCurrencies", () => {
    it("returns currencies list", async () => {
      const mockCurrencies = [
        { code: "EGP", name: "Egyptian Pound", symbol: "E£" },
        { code: "USD", name: "US Dollar", symbol: "$" },
      ]
      vi.mocked(mockRepository.listCurrencies).mockResolvedValueOnce(mockCurrencies)

      const result = await service.listCurrencies()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockCurrencies)
      }
    })
  })

  describe("listTimezones", () => {
    it("returns timezones filtered by country", async () => {
      const mockTimezones = [{ name: "Africa/Cairo" }]
      vi.mocked(mockRepository.listTimezones).mockResolvedValueOnce(mockTimezones)

      const result = await service.listTimezones({ countryCode: "EG" })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(mockTimezones)
      }
    })
  })
})
