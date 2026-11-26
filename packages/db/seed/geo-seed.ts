/**
 * Seeds the geo reference tables (currencies, timezones, countries, country_timezones,
 * states and optionally cities) from the dr5hn countries-states-cities dataset.
 *
 *   pnpm seed:geo                  # currencies, timezones, countries, states
 *   SEED_CITIES=1 pnpm seed:geo    # ...plus ~150k cities
 *   tsx seed/geo-seed.ts
 *
 * Environment:
 *   SEED_CITIES=1          also seed cities (off by default)
 *   GEO_DATA_DIR=/path     read <name>.json from a local clone instead of GitHub
 *   GEO_DATA_BASE_URL=...  override the remote location of the JSON files
 *
 * Properties:
 *   - Idempotent: every table is upserted, so re-running refreshes data and never duplicates.
 *   - Atomic: all writes happen in ONE transaction; a failure leaves the tables untouched.
 *   - Downloads happen before the transaction opens, so it stays short.
 *   - Parsing/validation lives in pure `build*` functions; only `seed*` functions touch the DB.
 */
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { getTableColumns, sql } from "drizzle-orm"
import type { PgTable, PgUpdateSetSource } from "drizzle-orm/pg-core"
import dotenv from "dotenv"
import {
    createDbClient,
    currencies,
    timezones,
    countries,
    countryTimezones,
    states,
    cities,
    type Database,
} from "../src/index.js"

dotenv.config()
if (!process.env.DATABASE_URL) {
    dotenv.config({ path: join(import.meta.dirname, "../.env") })
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required to run the geo seed script.")
}

const db = createDbClient(databaseUrl)

/* -------------------------------------------------------------------------- */
/* Config                                                                     */
/* -------------------------------------------------------------------------- */

const BASE_URL = (
    process.env.GEO_DATA_BASE_URL ??
    "https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json"
).replace(/\/$/, "")
const LOCAL_DIR = process.env.GEO_DATA_DIR
const SEED_CITIES = process.env.SEED_CITIES === "1"

/** Rows per INSERT. Keep (rows x columns) well below Postgres' 65,535 parameter limit. */
const BATCH_SIZE = 1000

/** Zone that `organizations.timezone` defaults to; the dataset does not list it. */
const FALLBACK_TIMEZONE = "UTC"

/** The dataset uses non-standard keys for a few languages; map them to BCP-47. */
const LOCALE_ALIASES: Record<string, string> = { kr: "ko", cn: "zh" }

const CURRENCY_CODE = /^[A-Z]{3}$/ // mirrors ck_currency_code
const COUNTRY_CODE = /^[A-Z]{2}$/ // mirrors ck_country_code

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type Tx = Database
type Maybe<T> = T | null | undefined

type NewCurrency = typeof currencies.$inferInsert
type NewTimezone = typeof timezones.$inferInsert
type NewCountry = typeof countries.$inferInsert
type NewCountryTimezone = typeof countryTimezones.$inferInsert
type NewState = typeof states.$inferInsert
type NewCity = typeof cities.$inferInsert

/** Only the dataset fields we read. Everything is optional: the dataset is inconsistent. */
interface SrcCountry {
    iso2?: Maybe<string>
    iso3?: Maybe<string>
    numeric_code?: Maybe<string>
    name?: Maybe<string>
    native?: Maybe<string>
    translations?: Maybe<Record<string, unknown>>
    capital?: Maybe<string>
    tld?: Maybe<string>
    phonecode?: Maybe<string | number> // current key
    phone_code?: Maybe<string | number> // older key
    currency?: Maybe<string>
    currency_name?: Maybe<string>
    currency_symbol?: Maybe<string>
    region?: Maybe<string>
    subregion?: Maybe<string>
    latitude?: Maybe<string | number>
    longitude?: Maybe<string | number>
    emoji?: Maybe<string>
    wikiDataId?: Maybe<string>
    timezones?: Maybe<{ zoneName?: Maybe<string> }[]>
}

interface SrcState {
    id: number
    country_code?: Maybe<string>
    name?: Maybe<string>
    native?: Maybe<string>
    translations?: Maybe<Record<string, unknown>>
    iso2?: Maybe<string> // subdivision code
    state_code?: Maybe<string> // alternative key in newer dumps
    fips_code?: Maybe<string>
    type?: Maybe<string>
    latitude?: Maybe<string | number>
    longitude?: Maybe<string | number>
    wikiDataId?: Maybe<string>
}

interface SrcCity {
    state_id: number
    name?: Maybe<string>
    native?: Maybe<string>
    latitude?: Maybe<string | number>
    longitude?: Maybe<string | number>
    wikiDataId?: Maybe<string>
}

/* -------------------------------------------------------------------------- */
/* Small helpers                                                              */
/* -------------------------------------------------------------------------- */

const log = (msg: string) => console.log(msg)

/** Trimmed string or null (empty / non-string values become null). */
function str(v: unknown): string | null {
    if (typeof v === "number") v = String(v)
    if (typeof v !== "string") return null
    const t = v.trim()
    return t === "" ? null : t
}

/** The dataset stores coordinates as strings ("30.00000000"). */
function num(v: unknown): number | null {
    if (v === null || v === undefined || v === "") return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}

/** String of an exact length (for char(n) columns) or null. */
function fixed(v: unknown, length: number): string | null {
    const s = str(v)
    return s !== null && s.length === length ? s : null
}

function upper(v: unknown): string | null {
    return str(v)?.toUpperCase() ?? null
}

/** `{ kr: "...", pt-BR: "..." }` -> `{ ko: "...", "pt-BR": "..." }`, dropping blanks. */
function normalizeTranslations(raw: Maybe<Record<string, unknown>>): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(raw ?? {})) {
        const text = str(value)
        if (text) out[LOCALE_ALIASES[key] ?? key] = text
    }
    return out
}

function zoneNames(country: SrcCountry): string[] {
    return (country.timezones ?? [])
        .map((t) => str(t.zoneName))
        .filter((name): name is string => name !== null)
}

async function inBatches<T>(rows: T[], write: (batch: T[]) => Promise<unknown>) {
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        await write(rows.slice(i, i + BATCH_SIZE))
    }
}

/** `SET col = excluded.col` for every column except `skip` (the key columns). */
function refresh<T extends PgTable>(table: T, skip: string[]): PgUpdateSetSource<T> {
    const set: Record<string, unknown> = {}
    for (const [key, column] of Object.entries(getTableColumns(table))) {
        if (!skip.includes(key)) set[key] = sql.raw(`excluded."${column.name}"`)
    }
    return set as PgUpdateSetSource<T>
}

/* -------------------------------------------------------------------------- */
/* Load                                                                       */
/* -------------------------------------------------------------------------- */

async function load<T>(name: string): Promise<T[]> {
    if (LOCAL_DIR) {
        return JSON.parse(await readFile(join(LOCAL_DIR, `${name}.json`), "utf8")) as T[]
    }
    const url = `${BASE_URL}/${name}.json`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`)
    return (await res.json()) as T[]
}

/* -------------------------------------------------------------------------- */
/* Transform (pure)                                                           */
/* -------------------------------------------------------------------------- */

function buildCurrencies(src: SrcCountry[]): NewCurrency[] {
    const byCode = new Map<string, NewCurrency>()
    for (const c of src) {
        const code = upper(c.currency)
        const name = str(c.currency_name)
        if (!code || !name || !CURRENCY_CODE.test(code) || byCode.has(code)) continue
        byCode.set(code, { code, name, symbol: str(c.currency_symbol) })
    }
    return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code))
}

function buildTimezones(src: SrcCountry[]): NewTimezone[] {
    const names = new Set<string>([FALLBACK_TIMEZONE])
    for (const c of src) for (const name of zoneNames(c)) names.add(name)
    return [...names].sort().map((name) => ({ name }))
}

function buildCountries(src: SrcCountry[], knownCurrencies: Set<string>): NewCountry[] {
    const byCode = new Map<string, NewCountry>()
    for (const c of src) {
        const code = upper(c.iso2)
        const name = str(c.name)
        if (!code || !name || !COUNTRY_CODE.test(code)) {
            console.warn(`  skipped country without a valid ISO2 code: ${name ?? "(unnamed)"}`)
            continue
        }
        if (byCode.has(code)) continue

        const currency = upper(c.currency)
        byCode.set(code, {
            code,
            iso3: fixed(c.iso3, 3),
            numericCode: fixed(c.numeric_code, 3),
            name,
            native: str(c.native),
            translations: normalizeTranslations(c.translations),
            capital: str(c.capital),
            tld: str(c.tld),
            phoneCode: str(c.phonecode ?? c.phone_code)?.replace(/^\+/, "") ?? null,
            currencyCode: currency && knownCurrencies.has(currency) ? currency : null,
            region: str(c.region),
            subregion: str(c.subregion),
            latitude: num(c.latitude),
            longitude: num(c.longitude),
            emoji: str(c.emoji),
            wikiDataId: str(c.wikiDataId),
        })
    }
    return [...byCode.values()]
}

function buildCountryTimezones(
    src: SrcCountry[],
    knownCountries: Set<string>
): NewCountryTimezone[] {
    const pairs = new Map<string, NewCountryTimezone>()
    for (const c of src) {
        const countryCode = upper(c.iso2)
        if (!countryCode || !knownCountries.has(countryCode)) continue
        for (const timezoneName of zoneNames(c)) {
            pairs.set(`${countryCode}|${timezoneName}`, { countryCode, timezoneName })
        }
    }
    return [...pairs.values()]
}

const stateKey = (countryCode: string, name: string) => `${countryCode}|${name}`

/**
 * States are keyed by (country_code, name), the same natural key as `ux_state_country_name`.
 * `keyByDatasetId` lets cities (which reference the dataset's numeric state id) find their
 * state after the surrogate uuids have been generated.
 */
function buildStates(src: SrcState[], knownCountries: Set<string>) {
    const rows = new Map<string, NewState>()
    const keyByDatasetId = new Map<number, string>()

    for (const s of src) {
        const countryCode = upper(s.country_code)
        const name = str(s.name)
        if (!countryCode || !name || !knownCountries.has(countryCode)) continue

        const key = stateKey(countryCode, name)
        keyByDatasetId.set(s.id, key)
        if (rows.has(key)) continue

        rows.set(key, {
            countryCode,
            name,
            native: str(s.native),
            translations: normalizeTranslations(s.translations),
            code: str(s.iso2 ?? s.state_code),
            fipsCode: str(s.fips_code),
            type: str(s.type),
            latitude: num(s.latitude),
            longitude: num(s.longitude),
            wikiDataId: str(s.wikiDataId),
        })
    }
    return { rows: [...rows.values()], keyByDatasetId }
}

function buildCities(
    src: SrcCity[],
    keyByDatasetId: Map<number, string>,
    stateByKey: Map<string, { id: string; countryCode: string }>
): NewCity[] {
    const rows = new Map<string, NewCity>()
    let orphaned = 0

    for (const c of src) {
        const name = str(c.name)
        const key = keyByDatasetId.get(c.state_id)
        const state = key ? stateByKey.get(key) : undefined
        if (!name || !state) {
            orphaned++
            continue
        }
        // Use the state's country so the composite FK (country_code, state_id) always holds.
        const dedupeKey = `${state.id}|${name}`
        if (rows.has(dedupeKey)) continue

        rows.set(dedupeKey, {
            countryCode: state.countryCode,
            stateId: state.id,
            name,
            native: str(c.native),
            latitude: num(c.latitude),
            longitude: num(c.longitude),
            wikiDataId: str(c.wikiDataId),
        })
    }
    if (orphaned > 0) console.warn(`  skipped ${orphaned} cities without a known state`)
    return [...rows.values()]
}

/* -------------------------------------------------------------------------- */
/* Write                                                                      */
/* -------------------------------------------------------------------------- */

async function seedCurrencies(tx: Tx, rows: NewCurrency[]) {
    await inBatches(rows, (batch) =>
        tx
            .insert(currencies)
            .values(batch)
            .onConflictDoUpdate({ target: currencies.code, set: refresh(currencies, ["code"]) })
    )
}

async function seedTimezones(tx: Tx, rows: NewTimezone[]) {
    await inBatches(rows, (batch) => tx.insert(timezones).values(batch).onConflictDoNothing())
}

async function seedCountries(tx: Tx, rows: NewCountry[]) {
    await inBatches(rows, (batch) =>
        tx
            .insert(countries)
            .values(batch)
            .onConflictDoUpdate({ target: countries.code, set: refresh(countries, ["code"]) })
    )
}

async function seedCountryTimezones(tx: Tx, rows: NewCountryTimezone[]) {
    await inBatches(rows, (batch) =>
        tx.insert(countryTimezones).values(batch).onConflictDoNothing()
    )
}

async function seedStates(tx: Tx, rows: NewState[]) {
    await inBatches(rows, (batch) =>
        tx
            .insert(states)
            .values(batch)
            .onConflictDoUpdate({
                target: [states.countryCode, states.name],
                set: refresh(states, ["id", "countryCode", "name"]),
            })
    )
}

async function loadStateIndex(tx: Tx) {
    const rows = await tx
        .select({ id: states.id, countryCode: states.countryCode, name: states.name })
        .from(states)
    return new Map(
        rows.map((s) => [stateKey(s.countryCode, s.name), { id: s.id, countryCode: s.countryCode }])
    )
}

async function seedCityRows(tx: Tx, rows: NewCity[]) {
    await inBatches(rows, (batch) =>
        tx
            .insert(cities)
            .values(batch)
            .onConflictDoUpdate({
                target: [cities.stateId, cities.name],
                set: refresh(cities, ["id", "countryCode", "stateId", "name"]),
            })
    )
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

async function main() {
    const startedAt = Date.now()
    log(`Seeding geo data (${LOCAL_DIR ? `local: ${LOCAL_DIR}` : "remote"}, cities: ${SEED_CITIES ? "on" : "off"})`)

    // 1. Download everything first so the transaction stays short.
    log("Loading dataset...")
    const [srcCountries, srcStates, srcCities] = await Promise.all([
        load<SrcCountry>("countries"),
        load<SrcState>("states"),
        SEED_CITIES ? load<SrcCity>("cities") : Promise.resolve<SrcCity[]>([]),
    ])

    // 2. Transform and validate in memory.
    const currencyRows = buildCurrencies(srcCountries)
    const timezoneRows = buildTimezones(srcCountries)
    const countryRows = buildCountries(srcCountries, new Set(currencyRows.map((c) => c.code)))
    const knownCountries = new Set(countryRows.map((c) => c.code))
    const countryTimezoneRows = buildCountryTimezones(srcCountries, knownCountries)
    const { rows: stateRows, keyByDatasetId } = buildStates(srcStates, knownCountries)

    // 3. Write, parents before children, all in one transaction.
    await db.transaction(async (tx) => {
        await seedCurrencies(tx, currencyRows)
        log(`  currencies          ${currencyRows.length}`)

        await seedTimezones(tx, timezoneRows)
        log(`  timezones           ${timezoneRows.length}`)

        await seedCountries(tx, countryRows)
        log(`  countries           ${countryRows.length}`)

        await seedCountryTimezones(tx, countryTimezoneRows)
        log(`  country_timezones   ${countryTimezoneRows.length}`)

        await seedStates(tx, stateRows)
        log(`  states              ${stateRows.length}`)

        if (SEED_CITIES) {
            const cityRows = buildCities(srcCities, keyByDatasetId, await loadStateIndex(tx))
            await seedCityRows(tx, cityRows)
            log(`  cities              ${cityRows.length}`)
        }
    })

    log(`Done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`)
}

// A seed script is short-lived: exit explicitly so the DB pool doesn't keep the process alive.
main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Geo seeding failed:", err)
        process.exit(1)
    })