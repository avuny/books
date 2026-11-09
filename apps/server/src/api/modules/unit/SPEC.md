# Unit Module: Specification

> **Update this file** whenever a requirement changes: a new error code, a new route, a policy change, or anything else that alters observable behavior.

## 1. Purpose

Units of measure and unit collections. The unit catalog is global (seeded from `SYSTEM_UNITS`, read-only for tenants). A **unit collection** belongs to one organization: a base unit plus other units of the same type that convert to it. Items point at a collection; every stored quantity is normalized to the item's base unit.

## 2. Domain model

| Table | Owner | Notes |
|---|---|---|
| `units` | global | `symbol` is the identity (case-sensitive), `type` ∈ `UNIT_TYPES`, retired with `is_active = false` |
| `unit_collections` | organization | `base_unit_id` is immutable once any item uses it; **name is not unique** |
| `unit_collection_units` | via collection | one row per unit, `conversion_factor` = base units per 1 of this unit (`numeric(24,12)`, string in the API) |

## 3. Business rules (all in `unit.rules.ts`, pure)

- The base unit's own row always exists with factor exactly `"1"` and is never edited or removed by an update.
- Every unit must have the same `type` as the base unit (`UNIT_TYPE_MISMATCH`).
- A unit appears at most once; listing the base unit again is a duplicate (`UNIT_DUPLICATE_IN_COLLECTION`).
- Factors are decimal strings, > 0, at most 12 integer and 12 fraction digits (`UNIT_INVALID_CONVERSION_FACTOR`).
- At most `UNIT_COLLECTION_MAX_UNITS` rows including the base unit (`UNIT_COLLECTION_TOO_MANY_UNITS`).
- Units must exist and be active (`UNIT_NOT_FOUND`).
- Extra units (anything besides the base unit) need the `extraUnits` plan feature (`UNIT_FEATURE_NOT_AVAILABLE`).
- `PATCH` with `units` **replaces** the non-base units; only the difference is written (factors compared as normalized decimals).
- A collection used by items cannot be deleted (`UNIT_COLLECTION_IN_USE`). The FK is the safety net.
- Collections are also created automatically by the item module (base unit only). Changing a factor never rewrites history: documents keep their own factor snapshot.

## 4. Routes (permission resource `unit`)

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/organizations/{orgId}/units` | `read:unit` | active catalog, filter `type`, `search`, offset paging |
| GET | `/organizations/{orgId}/unit-collections` | `read:unit` | with `unitCount`, `itemCount` |
| GET | `/organizations/{orgId}/unit-options` | `read:unit` | picker: active units labelled `Meter (m)`, id + name, cursor paging, optional `sameTypeAs=<unitId>` |
| GET | `/organizations/{orgId}/unit-collection-options` | `read:unit` | picker: collections, id + name, cursor paging |
| GET | `/organizations/{orgId}/unit-collections/{collectionId}` | `read:unit` | base unit first |
| POST | `/organizations/{orgId}/unit-collections` | `create:unit` | name optional (generated) |
| PATCH | `/organizations/{orgId}/unit-collections/{collectionId}` | `update:unit` | `name` and/or `units` |
| DELETE | `/organizations/{orgId}/unit-collections/{collectionId}` | `delete:unit` | |

A missing permission answers `ROLE_PERMISSION_DENIED` (403) from the role middleware.

## 5. Error codes

| Code | HTTP | Description |
|---|---|---|
| `UNIT_NOT_FOUND` | 404 | Unit missing or inactive |
| `UNIT_COLLECTION_NOT_FOUND` | 404 | Collection missing or in another organization |
| `UNIT_COLLECTION_IN_USE` | 409 | Items still use the collection |
| `UNIT_FEATURE_NOT_AVAILABLE` | 403 | Plan does not allow extra units |
| `UNIT_TYPE_MISMATCH` | 422 | Unit type differs from the base unit |
| `UNIT_DUPLICATE_IN_COLLECTION` | 422 | Same unit twice (or base unit listed again) |
| `UNIT_COLLECTION_TOO_MANY_UNITS` | 422 | Over `UNIT_COLLECTION_MAX_UNITS` |
| `UNIT_INVALID_CONVERSION_FACTOR` | 422 | Not a positive decimal that fits numeric(24,12) |

## 6. Files

```
unit/
├── SPEC.md
├── deps.ts                 # DI wiring (lazy singletons)
├── index.ts                # public barrel
├── testing.ts              # DummyUnitPlanFeatures, DummyUnitActivityLog
├── unit.errors.ts          # code -> HTTP status/message
├── unit.error-map.ts       # full map
├── unit.mapper.ts          # rows -> DTOs
├── unit.repository.ts      # Drizzle queries and locks
├── unit.rules.ts           # PURE rules injected into the service
├── unit.seed.ts            # syncSystemUnits (upsert by symbol)
├── unit.service.ts         # orchestration only
├── unit.types.ts
├── unit.rules.spec.ts
├── unit.service.spec.ts
├── hono-routes/            # one file per route + index + module-routes.types
└── __tests__/unit.routes.test.ts
```
