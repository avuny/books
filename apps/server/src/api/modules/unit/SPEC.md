# Unit Module: Specification

> **Update this file** whenever a requirement changes: a new error code, a new route, a policy change, or anything else that alters observable behavior.

## 1. Purpose

The unit catalog holds standard units of measure (system units seeded from `SYSTEM_UNITS`) plus custom units defined per organization. Used for inventory tracking, sales/purchase conversions, and items.

## 2. Domain model

| Table | Owner | Notes |
|---|---|---|
| `units` | system (`org_id IS NULL`) or org (`org_id IS NOT NULL`) | `symbol` is unique (case-sensitive); `name` is unique (case-insensitive); type immutable; system units cannot be edited or deleted |

## 3. Business rules (all in `unit.rules.ts`, pure)

- System units (`org_id IS NULL`) are immutable and cannot be updated or deleted (`UNIT_SYSTEM_IMMUTABLE`).
- Custom units must have a unique name (case-insensitive) and symbol within the organization and among system units (`UNIT_NAME_TAKEN`, `UNIT_SYMBOL_TAKEN`).
- Unit measurement type (`count`, `weight`, `length`, `area`, `volume`) cannot be changed after creation.
- A unit used in collections (`unit_collection_units`) or as an item base unit cannot be deleted (`UNIT_IN_USE`).
- Deactivation (`isActive = false`) is available for custom units instead of deletion when in use.

## 4. Routes (permission resource `unit`)

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/organizations/{orgId}/units` | `read:unit` | list system + custom units; search, filter by type/isActive, offset paging |
| GET | `/organizations/{orgId}/unit-options` | `read:unit` | picker: active units labelled `Name (symbol)`, cursor paging, optional `sameTypeAs` |
| GET | `/organizations/{orgId}/units/{unitId}` | `read:unit` | unit details by ID |
| POST | `/organizations/{orgId}/units` | `create:unit` | create custom unit for organization |
| PATCH | `/organizations/{orgId}/units/{unitId}` | `update:unit` | rename, change symbol, or toggle active status |
| DELETE | `/organizations/{orgId}/units/{unitId}` | `delete:unit` | delete custom unit (fails if in use) |

## 5. Error codes

| Code | HTTP | Description |
|---|---|---|
| `UNIT_NOT_FOUND` | 404 | Unit not found |
| `UNIT_FORBIDDEN` | 403 | You do not have access to this unit |
| `UNIT_NAME_TAKEN` | 409 | Unit name already exists |
| `UNIT_SYMBOL_TAKEN` | 409 | Unit symbol already exists |
| `UNIT_SYSTEM_IMMUTABLE` | 400 | System units cannot be modified or deleted |
| `UNIT_IN_USE` | 409 | Unit is in use and cannot be deleted |
| `UNIT_TYPE_IMMUTABLE` | 422 | Unit measurement type cannot be changed |
