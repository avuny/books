import { randomUUID } from "node:crypto"
import {
  type ActivityLogAction,
  type PermissionKey,
  RoleErrorCode,
  WAREHOUSE_LOCATION_AUDIT_EVENTS as EV,
  WAREHOUSE_LOCATION_BULK_SAMPLE_SIZE,
  WAREHOUSE_LOCATION_DEFAULT_PURPOSE,
  WAREHOUSE_LOCATION_PURPOSE_FLAGS,
  WAREHOUSE_LOCATION_TREE_MAX_NODES,
  WarehouseLocationErrorCode as E,
  WarehouseLocationOptionCursorSchema,
  warehouseLocationTranslationsEn,
  buildFullCode,
  countBulkNodes,
  isPlacementAllowed,
  isStockableType,
  isTypeAllowedInWarehouse,
  planBulkCreate,
  resolveFlags,
  suggestNextCode,
  validateBulkLevels,
  validateFlags,
  type BulkCreateWarehouseLocationsInput,
  type BulkCreateWarehouseLocationsResult,
  type BlockWarehouseLocationInput,
  type ChangeWarehouseLocationBarcodeInput,
  type CreateWarehouseLocationInput,
  type DeactivateWarehouseLocationQuery,
  type DeleteWarehouseLocationResult,
  type MoveWarehouseLocationInput,
  type OptionListResponse,
  type UpdateWarehouseLocationInput,
  type WarehouseLocationDetailDto,
  type WarehouseLocationDto,
  type WarehouseLocationLookupQuery,
  type WarehouseLocationNextCodeQuery,
  type WarehouseLocationNextCodeResponse,
  type WarehouseLocationOffsetListQuery,
  type WarehouseLocationOffsetListResponse,
  type WarehouseLocationOptionListQuery,
  type WarehouseLocationPostingIntent,
  type WarehouseLocationTreeQuery,
  type WarehouseLocationTreeResponse,
  type WarehouseLocationType,
} from "@avuny/contracts"
import { decodeCursor, fail, ok, toCursorPage, type Result } from "@avuny/utils"
import { generateLocationBarcode } from "../shared/location-barcode.js"
import {
  toTreeNodes,
  toWarehouseLocationDetailDto,
  toWarehouseLocationDto,
  toWarehouseLocationListItemDto,
} from "./warehouse-location.mapper.js"
import { WAREHOUSE_LOCATION_PERMISSIONS as P } from "./warehouse-location.permissions.js"
import type {
  Code,
  LocationPatch,
  Tx,
  WarehouseLocation,
  WarehouseLocationServiceDeps,
  WarehouseSummary,
} from "./warehouse-location.types.js"

type Outcome<T> = { ok: true; value: T } | { ok: false; error: Code; msg: string }
const good = <T>(value: T): Outcome<T> => ({ ok: true, value })
/** English fallback messages come from the contracts locale, so they never drift from the codes. */
const stop = (error: E, msg?: string) => ({
  ok: false as const,
  error: error as Code,
  msg: msg ?? warehouseLocationTranslationsEn.errors[error],
})

const MEASURE_KEYS = ["width", "height", "depth", "maxWeight", "maxVolume"] as const

export function createWarehouseLocationService(deps: WarehouseLocationServiceDeps) {
  const repo = deps.repository
  const permissions = deps.permissions
  const usage = deps.usage

  const can = (actorId: string, action: PermissionKey, orgId: string) =>
    permissions.check({ userId: actorId }, action, { resourceId: orgId, orgId })

  const forbidden = () =>
    fail({
      error: RoleErrorCode.ROLE_PERMISSION_DENIED,
      msg: "You do not have permission to perform this action",
    })

  // Audit rows are written only after the transaction committed.
  const audit = (
    orgId: string,
    actorId: string,
    action: ActivityLogAction,
    resourceId: string,
    metadata?: Record<string, unknown>
  ) => deps.activityLog.record({ orgId, actorId, action, resourceId, metadata })

  const toFailure = (o: { error: Code; msg: string }) => fail({ error: o.error, msg: o.msg })

  /** Loads the warehouse a location operation targets; writes need it active and not a system warehouse. */
  const resolveWarehouse = async (
    orgId: string,
    warehouseId: string,
    tx: Tx | undefined,
    forWrite: boolean
  ): Promise<Outcome<WarehouseSummary>> => {
    const w = await repo.findWarehouse(orgId, warehouseId, tx)
    if (!w) return stop(E.WAREHOUSE_LOCATION_WAREHOUSE_NOT_FOUND)
    if (forWrite && w.isSystem) return stop(E.WAREHOUSE_LOCATION_SYSTEM_PROTECTED)
    if (forWrite && !w.isActive) return stop(E.WAREHOUSE_LOCATION_WAREHOUSE_INACTIVE)
    return good(w)
  }

  /** Loads and validates the parent: same warehouse, and (for writes) active and not stockable. */
  const resolveParent = async (
    orgId: string,
    warehouseId: string,
    parentId: string | null | undefined,
    tx: Tx | undefined,
    forWrite: boolean
  ): Promise<Outcome<WarehouseLocation | null>> => {
    if (!parentId) return good(null)
    const parent = await repo.findLocation(orgId, parentId, tx, forWrite ? "update" : undefined)
    if (!parent) return stop(E.WAREHOUSE_LOCATION_PARENT_NOT_FOUND)
    if (parent.warehouseId !== warehouseId) return stop(E.WAREHOUSE_LOCATION_PARENT_WAREHOUSE_MISMATCH)
    if (forWrite && !parent.isActive) return stop(E.WAREHOUSE_LOCATION_PARENT_INACTIVE)
    if (forWrite && parent.isStockable) return stop(E.WAREHOUSE_LOCATION_PARENT_IS_STOCKABLE)
    return good(parent)
  }

  /** Placement rank under the parent, plus virtual/physical warehouse type rules. */
  const checkType = (
    warehouse: WarehouseSummary,
    parentType: WarehouseLocationType | null,
    type: WarehouseLocationType
  ): E | null => {
    if (!isTypeAllowedInWarehouse(warehouse.type, type)) return E.WAREHOUSE_LOCATION_VIRTUAL_TYPE_MISMATCH
    if (!isPlacementAllowed(parentType, type)) return E.WAREHOUSE_LOCATION_INVALID_PLACEMENT
    return null
  }

  /** Reloads a location (effective status, children) for the response DTO. */
  const reloadDto = async (orgId: string, id: string, tx?: Tx): Promise<WarehouseLocationDto> => {
    const row = await repo.findDetail(orgId, id, tx)
    return toWarehouseLocationDto(row!)
  }

  return {
    /**
     * Creates one location (root or child).
     * Business logic:
     *  - requires create:warehouse-location; the warehouse must exist, be active and not be a
     *    system warehouse (transit locations are created by the system only).
     *  - the parent must be in the SAME warehouse, active and NOT stockable (a stockable location
     *    is a leaf), and the new type must rank below the parent's (levels may be skipped).
     *  - virtual_bin only exists in virtual warehouses, which hold only virtual_bin and area.
     *  - purpose defaults to the parent's purpose, then storage; stockable/pickable/receivable
     *    default from type and purpose and explicit values win, but are validated (only
     *    area/dock/level/shelf/bin/virtual_bin may be stockable; pickable and receivable need stockable).
     *  - full_code, path_ids and tree_depth are computed here; code is unique among siblings and
     *    a barcode is generated when none is given.
     *  - the parent row is locked so it cannot become stockable or move while we attach a child.
     */
    async create(
      actorId: string,
      orgId: string,
      warehouseId: string,
      input: CreateWarehouseLocationInput
    ): Promise<Result<WarehouseLocationDto, Code>> {
      if (!(await can(actorId, P.CREATE, orgId))) return forbidden()

      const outcome = await repo.transaction(async (tx): Promise<Outcome<WarehouseLocationDto>> => {
        const w = await resolveWarehouse(orgId, warehouseId, tx, true)
        if (!w.ok) return w
        const p = await resolveParent(orgId, warehouseId, input.parentId, tx, true)
        if (!p.ok) return p
        const parent = p.value

        const typeError = checkType(w.value, parent?.type ?? null, input.type)
        if (typeError) return stop(typeError)

        const purpose = input.purpose ?? parent?.purpose ?? WAREHOUSE_LOCATION_DEFAULT_PURPOSE
        const flags = resolveFlags({
          type: input.type,
          purpose,
          isStockable: input.isStockable,
          isPickable: input.isPickable,
          isReceivable: input.isReceivable,
        })
        if (!flags.ok) return stop(flags.error)

        const id = randomUUID()
        const pathIds = [...(parent?.pathIds ?? []), id]
        const inserted = await repo.insert(
          {
            id,
            orgId,
            warehouseId,
            parentId: parent?.id ?? null,
            code: input.code,
            fullCode: buildFullCode(parent?.fullCode ?? null, input.code),
            name: input.name ?? input.code,
            type: input.type,
            purpose,
            pathIds,
            treeDepth: pathIds.length - 1,
            // A generated barcode colliding (60 random bits) is reported as taken; retrying works.
            barcode: input.barcode ?? generateLocationBarcode(),
            sortOrder: input.sortOrder,
            ...flags.flags,
            width: input.width ?? null,
            height: input.height ?? null,
            depth: input.depth ?? null,
            maxWeight: input.maxWeight ?? null,
            maxVolume: input.maxVolume ?? null,
          },
          tx
        )
        if (!inserted.ok) {
          return stop(
            inserted.reason === "barcode_taken" ? E.WAREHOUSE_LOCATION_BARCODE_TAKEN : E.WAREHOUSE_LOCATION_CODE_TAKEN
          )
        }
        return good(await reloadDto(orgId, id, tx))
      })
      if (!outcome.ok) return toFailure(outcome)

      await audit(orgId, actorId, EV.CREATED, outcome.value.id, {
        warehouseId,
        fullCode: outcome.value.fullCode,
        type: outcome.value.type,
      })
      return ok({ data: outcome.value, msg: "Location created successfully" })
    },

    /**
     * Generates a whole branch of locations in one request (aisles x racks x bins...).
     * Business logic:
     *  - requires create:warehouse-location (bulk_created is a logged-only action).
     *  - the levels form a cross-product; the total is computed first and capped (5,000) before
     *    anything is read or written. Ranks must strictly increase from the parent through the
     *    levels, and every type must be allowed in this kind of warehouse.
     *  - numbering restarts under every parent (R-01 exists under each aisle); only the first
     *    level can collide with existing siblings, so those codes are checked up front and a
     *    collision rejects the whole request.
     *  - dryRun reports counts and sample full codes and writes nothing.
     *  - a real run is atomic (one transaction, chunked inserts) and logs ONE summary audit
     *    entry rather than one per generated location. Each node gets the same defaults and an
     *    auto-generated barcode as a single create.
     */
    async bulkCreate(
      actorId: string,
      orgId: string,
      warehouseId: string,
      input: BulkCreateWarehouseLocationsInput
    ): Promise<Result<BulkCreateWarehouseLocationsResult, Code>> {
      if (!(await can(actorId, P.CREATE, orgId))) return forbidden()

      const total = countBulkNodes(input.levels)
      if (!Number.isFinite(total)) return fail({ error: E.WAREHOUSE_LOCATION_BULK_LIMIT_EXCEEDED, msg: warehouseLocationTranslationsEn.errors.WAREHOUSE_LOCATION_BULK_LIMIT_EXCEEDED })

      const outcome = await repo.transaction(async (tx): Promise<Outcome<BulkCreateWarehouseLocationsResult>> => {
        const w = await resolveWarehouse(orgId, warehouseId, tx, true)
        if (!w.ok) return w
        const p = await resolveParent(orgId, warehouseId, input.parentId, tx, true)
        if (!p.ok) return p
        const parent = p.value

        if (input.levels.some((l) => !isTypeAllowedInWarehouse(w.value.type, l.type))) {
          return stop(E.WAREHOUSE_LOCATION_VIRTUAL_TYPE_MISMATCH)
        }
        if (!validateBulkLevels(parent?.type ?? null, input.levels)) {
          return stop(E.WAREHOUSE_LOCATION_INVALID_PLACEMENT)
        }

        const plan = planBulkCreate(input.levels)

        // Only first-level nodes hang under existing siblings; deeper levels sit under brand-new parents.
        const existing = new Set(
          (await repo.listSiblingCodes(orgId, warehouseId, parent?.id ?? null, "", tx)).map((c) => c.toUpperCase())
        )
        const collisions = plan.filter((n) => n.parentIndex === null && existing.has(n.code))
        if (collisions.length > 0) {
          return stop(
            E.WAREHOUSE_LOCATION_BULK_CODE_COLLISION,
            `Codes already exist under the parent: ${collisions.slice(0, 5).map((n) => n.code).join(", ")}`
          )
        }

        const purpose = input.purpose ?? parent?.purpose ?? WAREHOUSE_LOCATION_DEFAULT_PURPOSE
        const rows = plan.map((n) => ({ node: n, id: randomUUID() }))
        const built = rows.map(({ node, id }) => {
          const parentRow = node.parentIndex === null ? null : rows[node.parentIndex]!
          return { node, id, parentRow }
        })
        // Parents come before children in the plan, so each full code / path builds on a finished parent.
        const full: string[] = []
        const paths: string[][] = []
        const values = built.map(({ node, id, parentRow }) => {
          const parentFull = parentRow ? full[parentRow.node.index]! : (parent?.fullCode ?? null)
          const parentPath = parentRow ? paths[parentRow.node.index]! : (parent?.pathIds ?? [])
          const fullCode = buildFullCode(parentFull, node.code)
          const pathIds = [...parentPath, id]
          full[node.index] = fullCode
          paths[node.index] = pathIds
          const flags = resolveFlags({ type: node.type, purpose })
          return {
            id,
            orgId,
            warehouseId,
            parentId: parentRow ? parentRow.id : (parent?.id ?? null),
            code: node.code,
            fullCode,
            name: node.code,
            type: node.type,
            purpose,
            pathIds,
            treeDepth: pathIds.length - 1,
            barcode: generateLocationBarcode(),
            sortOrder: 0,
            ...(flags.ok ? flags.flags : { isStockable: false, isPickable: false, isReceivable: false }),
          }
        })

        const countsByType = {} as BulkCreateWarehouseLocationsResult["countsByType"]
        for (const n of plan) countsByType[n.type] = (countsByType[n.type] ?? 0) + 1
        const result: BulkCreateWarehouseLocationsResult = {
          dryRun: input.dryRun,
          total: plan.length,
          countsByType,
          sampleFullCodes: full.slice(0, WAREHOUSE_LOCATION_BULK_SAMPLE_SIZE),
        }
        if (input.dryRun) return good(result)

        const inserted = await repo.insertMany(values, tx)
        if (!inserted.ok) return stop(E.WAREHOUSE_LOCATION_CODE_TAKEN)
        return good(result)
      })
      if (!outcome.ok) return toFailure(outcome)

      if (!outcome.value.dryRun) {
        await audit(orgId, actorId, EV.BULK_CREATED, warehouseId, {
          parentId: input.parentId ?? null,
          total: outcome.value.total,
          countsByType: outcome.value.countsByType,
        })
      }
      return ok({
        data: outcome.value,
        msg: input.dryRun ? "Bulk preview generated successfully" : "Locations created successfully",
      })
    },

    /**
     * Lists locations for the data table.
     * Business logic: requires read:warehouse-location; offset pagination with total; search
     * over code, name, full code and barcode; filters for warehouse, parent/roots, type, purpose,
     * capability flags, active, effective blocked (own or any ancestor) and `usable`
     * (stockable + active + active warehouse + not effectively blocked); ordered by warehouse
     * then full code so the table reads like the physical layout.
     */
    async list(
      actorId: string,
      orgId: string,
      query: WarehouseLocationOffsetListQuery
    ): Promise<Result<WarehouseLocationOffsetListResponse, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      const { rows, total } = await repo.listLocations(orgId, {
        ...query,
        search: query.search || undefined,
      })
      return ok({
        data: { items: rows.map(toWarehouseLocationListItemDto), page: query.page, pageSize: query.pageSize, total },
        msg: "Locations retrieved successfully",
      })
    },

    /**
     * Options for the location select combobox.
     * Business logic: requires read:warehouse-location; containerOnly lists only non-stockable
     * locations (valid parents, for the parent picker) and overrides stockableOnly; by default only STOCKABLE and USABLE
     * (active, active warehouse, not effectively blocked) locations are offered because pickers
     * normally choose where stock goes; callers can narrow further (pickable, receivable,
     * purpose, warehouse); labels read "<warehouse code> · <full code>"; keyset pagination by
     * (label, id).
     */
    async listOptions(
      actorId: string,
      orgId: string,
      query: WarehouseLocationOptionListQuery
    ): Promise<Result<OptionListResponse, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      const rows = await repo.listOptions(orgId, {
        search: query.search,
        warehouseId: query.warehouseId,
        purpose: query.purpose,
        containerOnly: query.containerOnly ?? false,
        stockableOnly: query.stockableOnly ?? true,
        pickableOnly: query.pickableOnly ?? false,
        receivableOnly: query.receivableOnly ?? false,
        usableOnly: query.usableOnly ?? true,
        after: decodeCursor(query.cursor, WarehouseLocationOptionCursorSchema),
        limit: query.limit + 1,
      })
      const page = toCursorPage(rows, query.limit, (row) => ({ name: row.name, id: row.id }))
      return ok({
        data: { items: page.items.map(({ id, name }) => ({ id, name })), nextCursor: page.nextCursor },
        msg: "Location options retrieved successfully",
      })
    },

    /**
     * Returns a warehouse's location tree as a flat list the client nests by parentId.
     * Business logic: requires read:warehouse-location; with parentId only that location's
     * descendants (lazy loading, parent must be in this warehouse); `depth` limits how many
     * levels are returned; inactive locations are hidden unless asked for; each node says
     * whether it has children so the UI can show an expander; a tree larger than the cap is
     * refused so the client switches to level-by-level loading.
     */
    async tree(
      actorId: string,
      orgId: string,
      warehouseId: string,
      query: WarehouseLocationTreeQuery
    ): Promise<Result<WarehouseLocationTreeResponse, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      const w = await resolveWarehouse(orgId, warehouseId, undefined, false)
      if (!w.ok) return toFailure(w)
      const p = await resolveParent(orgId, warehouseId, query.parentId, undefined, false)
      if (!p.ok) return toFailure(p)

      const rows = await repo.listTree(orgId, {
        warehouseId,
        parent: p.value ?? undefined,
        depth: query.depth,
        includeInactive: query.includeInactive ?? false,
        limit: WAREHOUSE_LOCATION_TREE_MAX_NODES + 1,
      })
      if (rows.length > WAREHOUSE_LOCATION_TREE_MAX_NODES) {
        return fail({ error: E.WAREHOUSE_LOCATION_TREE_TOO_LARGE, msg: warehouseLocationTranslationsEn.errors.WAREHOUSE_LOCATION_TREE_TOO_LARGE })
      }
      return ok({ data: { items: toTreeNodes(rows) }, msg: "Location tree retrieved successfully" })
    },

    /**
     * Suggests the next free sibling code for a prefix (e.g. BIN- -> BIN-08).
     * Business logic: requires read:warehouse-location; looks only at siblings under the given
     * parent (or the warehouse roots), takes the highest numeric suffix for the prefix and adds
     * one; it is a suggestion only, the unique index still decides at create time.
     */
    async nextCode(
      actorId: string,
      orgId: string,
      warehouseId: string,
      query: WarehouseLocationNextCodeQuery
    ): Promise<Result<WarehouseLocationNextCodeResponse, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      const w = await resolveWarehouse(orgId, warehouseId, undefined, false)
      if (!w.ok) return toFailure(w)
      const p = await resolveParent(orgId, warehouseId, query.parentId, undefined, false)
      if (!p.ok) return toFailure(p)

      const siblings = await repo.listSiblingCodes(orgId, warehouseId, p.value?.id ?? null, query.prefix)
      return ok({
        data: { code: suggestNextCode(query.prefix, siblings, query.pad) },
        msg: "Next code suggested successfully",
      })
    },

    /**
     * Reads one location with its ancestors and warehouse.
     * Business logic: requires read:warehouse-location; the response carries the full path
     * (root..self) and the EFFECTIVE blocked state (own or inherited), which is what posting
     * and picking screens must respect; other organizations' locations behave as not found.
     */
    async get(actorId: string, orgId: string, id: string): Promise<Result<WarehouseLocationDetailDto, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      const row = await repo.findDetail(orgId, id)
      if (!row) return fail({ error: E.WAREHOUSE_LOCATION_NOT_FOUND, msg: warehouseLocationTranslationsEn.errors.WAREHOUSE_LOCATION_NOT_FOUND })
      const path = await repo.listPath(orgId, row.loc.pathIds)
      return ok({ data: toWarehouseLocationDetailDto(row, path), msg: "Location retrieved successfully" })
    },

    /**
     * Finds a location from a scan: by barcode, or by warehouse + full code.
     * Business logic: requires read:warehouse-location; barcode and full code match
     * case-insensitively; returns the same detail as `get` in one call so a handheld needs
     * no second request.
     */
    async lookup(
      actorId: string,
      orgId: string,
      query: WarehouseLocationLookupQuery
    ): Promise<Result<WarehouseLocationDetailDto, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      const row = query.barcode
        ? await repo.findDetailByBarcode(orgId, query.barcode)
        : await repo.findDetailByFullCode(orgId, query.warehouseId!, query.fullCode!)
      if (!row) return fail({ error: E.WAREHOUSE_LOCATION_NOT_FOUND, msg: warehouseLocationTranslationsEn.errors.WAREHOUSE_LOCATION_NOT_FOUND })
      const path = await repo.listPath(orgId, row.loc.pathIds)
      return ok({ data: toWarehouseLocationDetailDto(row, path), msg: "Location retrieved successfully" })
    },

    /**
     * Updates a location's code, name, type, purpose, flags, order and measures.
     * Business logic:
     *  - requires update:warehouse-location; system warehouses are protected and the warehouse
     *    must be active; the row is locked.
     *  - a type change must still fit under the parent, above every child, and the warehouse kind.
     *  - changing purpose re-applies that purpose's default pickable/receivable unless the caller
     *    states them; `applyToDescendants` copies the purpose (and its default flags) down the subtree.
     *  - turning stockable OFF needs the location empty (asked from the usage registry); turning it
     *    ON needs a leaf; a type that cannot hold stock forces stockable off.
     *  - a code change rewrites full_code for the whole subtree in the same transaction; barcodes
     *    never change, so printed labels stay valid.
     *  - null clears a measure; the change set is audited.
     */
    async update(
      actorId: string,
      orgId: string,
      id: string,
      input: UpdateWarehouseLocationInput
    ): Promise<Result<WarehouseLocationDto, Code>> {
      if (!(await can(actorId, P.UPDATE, orgId))) return forbidden()

      const outcome = await repo.transaction(async (tx): Promise<Outcome<WarehouseLocationDto>> => {
        const ctx = await repo.findWithWarehouse(orgId, id, tx, "update")
        if (!ctx) return stop(E.WAREHOUSE_LOCATION_NOT_FOUND)
        const { loc, warehouse } = ctx
        if (warehouse.isSystem) return stop(E.WAREHOUSE_LOCATION_SYSTEM_PROTECTED)
        if (!warehouse.isActive) return stop(E.WAREHOUSE_LOCATION_WAREHOUSE_INACTIVE)

        const parent = loc.parentId ? await repo.findLocation(orgId, loc.parentId, tx) : null
        const nextType = input.type ?? loc.type
        const typeChanged = nextType !== loc.type
        if (typeChanged) {
          const typeError = checkType(warehouse, parent?.type ?? null, nextType)
          if (typeError) return stop(typeError)
          const childTypes = await repo.listChildTypes(orgId, id, tx)
          if (childTypes.some((t) => !isPlacementAllowed(nextType, t))) {
            return stop(E.WAREHOUSE_LOCATION_INVALID_PLACEMENT)
          }
        }

        const nextPurpose = input.purpose ?? loc.purpose
        const purposeChanged = nextPurpose !== loc.purpose
        const purposeFlags = WAREHOUSE_LOCATION_PURPOSE_FLAGS[nextPurpose]
        const isStockable = input.isStockable ?? (typeChanged && !isStockableType(nextType) ? false : loc.isStockable)
        const isPickable =
          input.isPickable ?? (isStockable && (purposeChanged ? purposeFlags.isPickable : loc.isPickable))
        const isReceivable =
          input.isReceivable ?? (isStockable && (purposeChanged ? purposeFlags.isReceivable : loc.isReceivable))
        const flagError = validateFlags(nextType, { isStockable, isPickable, isReceivable })
        if (flagError) return stop(flagError)

        if (isStockable && !loc.isStockable && (await repo.hasChildren(orgId, id, tx))) {
          return stop(E.WAREHOUSE_LOCATION_STOCKABLE_REQUIRES_LEAF)
        }
        if (!isStockable && loc.isStockable) {
          const u = await usage.locationUsage(orgId, [id], tx)
          if (u.withStock.includes(id)) return stop(E.WAREHOUSE_LOCATION_NOT_EMPTY)
        }

        const patch: LocationPatch = {
          type: nextType,
          purpose: nextPurpose,
          isStockable,
          isPickable,
          isReceivable,
        }
        if (input.name !== undefined) patch.name = input.name
        if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder
        for (const key of MEASURE_KEYS) {
          if (input[key] !== undefined) patch[key] = input[key] ?? null
        }
        const codeChanged = input.code !== undefined && input.code !== loc.code
        if (codeChanged) patch.code = input.code // full_code is rewritten below for the whole subtree

        const updated = await repo.update(orgId, id, patch, tx)
        if (!updated.ok) return stop(E.WAREHOUSE_LOCATION_CODE_TAKEN)
        if (codeChanged) {
          await repo.rebaseFullCodes(orgId, id, loc.fullCode, buildFullCode(parent?.fullCode ?? null, input.code!), tx)
        }
        if (input.applyToDescendants && purposeChanged) await repo.cascadePurpose(orgId, id, nextPurpose, tx)
        return good(await reloadDto(orgId, id, tx))
      })
      if (!outcome.ok) return toFailure(outcome)

      await audit(orgId, actorId, EV.UPDATED, id, {
        changedFields: Object.keys(input).filter((k) => input[k as keyof UpdateWarehouseLocationInput] !== undefined),
      })
      return ok({ data: outcome.value, msg: "Location updated successfully" })
    },

    /**
     * Moves a location (with its subtree) to another parent in the same warehouse.
     * Business logic:
     *  - requires move:warehouse-location; the warehouse must be active, not a system one.
     *  - the whole subtree must be EMPTY: moving is a physical relocation, so stock is relocated
     *    first (the usage registry says which locations hold stock).
     *  - the target must be in the same warehouse, active, not stockable, not the location itself
     *    or any descendant (no cycles), and the type must rank below the target's.
     *  - parentId null moves it to the warehouse root; moving to the current parent only
     *    changes sortOrder.
     *  - the node's parent_id changes first (sibling-code uniqueness is enforced by the unique
     *    index at the new place), then path_ids, tree_depth and full_code are rebased for the
     *    whole subtree in the same transaction. Barcodes are untouched.
     */
    async move(
      actorId: string,
      orgId: string,
      id: string,
      input: MoveWarehouseLocationInput
    ): Promise<Result<WarehouseLocationDto, Code>> {
      if (!(await can(actorId, P.MOVE, orgId))) return forbidden()

      const outcome = await repo.transaction(async (tx): Promise<Outcome<WarehouseLocationDto>> => {
        const ctx = await repo.findWithWarehouse(orgId, id, tx, "update")
        if (!ctx) return stop(E.WAREHOUSE_LOCATION_NOT_FOUND)
        const { loc, warehouse } = ctx
        if (warehouse.isSystem) return stop(E.WAREHOUSE_LOCATION_SYSTEM_PROTECTED)
        if (!warehouse.isActive) return stop(E.WAREHOUSE_LOCATION_WAREHOUSE_INACTIVE)

        let target: WarehouseLocation | null = null
        if (input.parentId) {
          target = await repo.findLocation(orgId, input.parentId, tx, "update")
          if (!target) return stop(E.WAREHOUSE_LOCATION_PARENT_NOT_FOUND)
          if (target.warehouseId !== loc.warehouseId) return stop(E.WAREHOUSE_LOCATION_PARENT_WAREHOUSE_MISMATCH)
          if (target.pathIds.includes(loc.id)) return stop(E.WAREHOUSE_LOCATION_CYCLE_DETECTED)
          if (!target.isActive) return stop(E.WAREHOUSE_LOCATION_PARENT_INACTIVE)
          if (target.isStockable) return stop(E.WAREHOUSE_LOCATION_PARENT_IS_STOCKABLE)
          if (!isPlacementAllowed(target.type, loc.type)) return stop(E.WAREHOUSE_LOCATION_INVALID_PLACEMENT)
        }

        const sameParent = (loc.parentId ?? null) === (target?.id ?? null)
        if (!sameParent) {
          const subtree = await repo.listSubtreeIds(orgId, id, tx)
          const u = await usage.locationUsage(orgId, subtree, tx)
          if (u.withStock.length > 0) return stop(E.WAREHOUSE_LOCATION_NOT_EMPTY)

          const newFull = buildFullCode(target?.fullCode ?? null, loc.code)
          const patch: LocationPatch = { parentId: target?.id ?? null }
          if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder
          const updated = await repo.update(orgId, id, patch, tx)
          if (!updated.ok) return stop(E.WAREHOUSE_LOCATION_CODE_TAKEN)
          await repo.rebaseMovedSubtree(orgId, id, loc.pathIds.length, target?.pathIds ?? [], loc.fullCode, newFull, tx)
        } else if (input.sortOrder !== undefined) {
          await repo.update(orgId, id, { sortOrder: input.sortOrder }, tx)
        }
        return good(await reloadDto(orgId, id, tx))
      })
      if (!outcome.ok) return toFailure(outcome)

      await audit(orgId, actorId, EV.MOVED, id, {
        parentId: input.parentId,
        fullCode: outcome.value.fullCode,
      })
      return ok({ data: outcome.value, msg: "Location moved successfully" })
    },

    /**
     * Blocks a location (operational hold).
     * Business logic: requires block:warehouse-location; a reason is mandatory; stock may be
     * present (it stays on hand but becomes unavailable, receipts in and picks out are refused,
     * moves out and count adjustments still work so the location can be emptied); because
     * "effective blocked" is read from ancestors, blocking an aisle blocks every bin under it
     * without rewriting those rows; blocking twice is a conflict.
     */
    async block(
      actorId: string,
      orgId: string,
      id: string,
      input: BlockWarehouseLocationInput
    ): Promise<Result<WarehouseLocationDto, Code>> {
      if (!(await can(actorId, P.BLOCK, orgId))) return forbidden()

      const outcome = await repo.transaction(async (tx): Promise<Outcome<WarehouseLocationDto>> => {
        const ctx = await repo.findWithWarehouse(orgId, id, tx, "update")
        if (!ctx) return stop(E.WAREHOUSE_LOCATION_NOT_FOUND)
        if (ctx.warehouse.isSystem) return stop(E.WAREHOUSE_LOCATION_SYSTEM_PROTECTED)
        if (ctx.loc.isBlocked) return stop(E.WAREHOUSE_LOCATION_ALREADY_BLOCKED)
        await repo.update(orgId, id, { isBlocked: true, blockedReason: input.reason, blockedAt: new Date() }, tx)
        return good(await reloadDto(orgId, id, tx))
      })
      if (!outcome.ok) return toFailure(outcome)

      await audit(orgId, actorId, EV.BLOCKED, id, { reason: input.reason })
      return ok({ data: outcome.value, msg: "Location blocked successfully" })
    },

    /**
     * Lifts a block.
     * Business logic: authorized by block:warehouse-location (unblocked is a logged-only
     * action); the reason and time are cleared; unblocking a location that is not blocked is a
     * conflict. If an ancestor is still blocked the location stays effectively blocked, which the
     * response shows through effectiveIsBlocked.
     */
    async unblock(actorId: string, orgId: string, id: string): Promise<Result<WarehouseLocationDto, Code>> {
      if (!(await can(actorId, P.BLOCK, orgId))) return forbidden()

      const outcome = await repo.transaction(async (tx): Promise<Outcome<WarehouseLocationDto>> => {
        const ctx = await repo.findWithWarehouse(orgId, id, tx, "update")
        if (!ctx) return stop(E.WAREHOUSE_LOCATION_NOT_FOUND)
        if (ctx.warehouse.isSystem) return stop(E.WAREHOUSE_LOCATION_SYSTEM_PROTECTED)
        if (!ctx.loc.isBlocked) return stop(E.WAREHOUSE_LOCATION_NOT_BLOCKED)
        await repo.update(orgId, id, { isBlocked: false, blockedReason: null, blockedAt: null }, tx)
        return good(await reloadDto(orgId, id, tx))
      })
      if (!outcome.ok) return toFailure(outcome)

      await audit(orgId, actorId, EV.UNBLOCKED, id)
      return ok({ data: outcome.value, msg: "Location unblocked successfully" })
    },

    /**
     * Deactivates (retires) a location, optionally with all its descendants.
     * Business logic:
     *  - requires deactivate:warehouse-location; system warehouses are protected.
     *  - the location AND its subtree must hold no stock and appear in no open document (asked
     *    from the usage registry), because a retired location must be truly empty.
     *  - active descendants block it unless cascade is set, in which case they are deactivated
     *    with it; an inactive parent therefore never has active children.
     *  - history stays readable; nothing is deleted.
     */
    async deactivate(
      actorId: string,
      orgId: string,
      id: string,
      query: DeactivateWarehouseLocationQuery
    ): Promise<Result<WarehouseLocationDto, Code>> {
      if (!(await can(actorId, P.DEACTIVATE, orgId))) return forbidden()
      const cascade = query.cascade ?? false

      const outcome = await repo.transaction(async (tx): Promise<Outcome<WarehouseLocationDto>> => {
        const ctx = await repo.findWithWarehouse(orgId, id, tx, "update")
        if (!ctx) return stop(E.WAREHOUSE_LOCATION_NOT_FOUND)
        if (ctx.warehouse.isSystem) return stop(E.WAREHOUSE_LOCATION_SYSTEM_PROTECTED)
        if (!ctx.loc.isActive) return stop(E.WAREHOUSE_LOCATION_ALREADY_INACTIVE)

        const activeDescendants = await repo.listActiveDescendantIds(orgId, id, tx)
        if (activeDescendants.length > 0 && !cascade) return stop(E.WAREHOUSE_LOCATION_HAS_ACTIVE_CHILDREN)

        const subtree = await repo.listSubtreeIds(orgId, id, tx)
        const u = await usage.locationUsage(orgId, subtree, tx)
        if (u.withStock.length > 0) return stop(E.WAREHOUSE_LOCATION_NOT_EMPTY)
        if (u.withOpenDocuments.length > 0) return stop(E.WAREHOUSE_LOCATION_IN_USE)

        await repo.setActive(orgId, [id, ...activeDescendants], false, tx)
        return good(await reloadDto(orgId, id, tx))
      })
      if (!outcome.ok) return toFailure(outcome)

      await audit(orgId, actorId, EV.DEACTIVATED, id, { cascade })
      return ok({ data: outcome.value, msg: "Location deactivated successfully" })
    },

    /**
     * Reactivates a retired location.
     * Business logic: authorized by deactivate:warehouse-location (reactivated is a logged-only
     * action); the warehouse must be active and the parent (if any) must be active, so an active
     * location never hangs under an inactive one; it does not cascade to descendants, which are
     * reactivated one by one on purpose.
     */
    async reactivate(actorId: string, orgId: string, id: string): Promise<Result<WarehouseLocationDto, Code>> {
      if (!(await can(actorId, P.DEACTIVATE, orgId))) return forbidden()

      const outcome = await repo.transaction(async (tx): Promise<Outcome<WarehouseLocationDto>> => {
        const ctx = await repo.findWithWarehouse(orgId, id, tx, "update")
        if (!ctx) return stop(E.WAREHOUSE_LOCATION_NOT_FOUND)
        if (ctx.warehouse.isSystem) return stop(E.WAREHOUSE_LOCATION_SYSTEM_PROTECTED)
        if (ctx.loc.isActive) return stop(E.WAREHOUSE_LOCATION_ALREADY_ACTIVE)
        if (!ctx.warehouse.isActive) return stop(E.WAREHOUSE_LOCATION_WAREHOUSE_INACTIVE)
        if (ctx.loc.parentId) {
          const parent = await repo.findLocation(orgId, ctx.loc.parentId, tx)
          if (parent && !parent.isActive) return stop(E.WAREHOUSE_LOCATION_PARENT_INACTIVE)
        }
        await repo.setActive(orgId, [id], true, tx)
        return good(await reloadDto(orgId, id, tx))
      })
      if (!outcome.ok) return toFailure(outcome)

      await audit(orgId, actorId, EV.REACTIVATED, id)
      return ok({ data: outcome.value, msg: "Location reactivated successfully" })
    },

    /**
     * Sets or regenerates a location's barcode.
     * Business logic: requires change_barcode:warehouse-location because it invalidates printed
     * labels; with no barcode in the request a new opaque one is generated; the barcode is unique
     * per organization (case-insensitive); the old and new values are audited so a label mix-up
     * can be traced.
     */
    async changeBarcode(
      actorId: string,
      orgId: string,
      id: string,
      input: ChangeWarehouseLocationBarcodeInput
    ): Promise<Result<WarehouseLocationDto, Code>> {
      if (!(await can(actorId, P.CHANGE_BARCODE, orgId))) return forbidden()

      const outcome = await repo.transaction(
        async (tx): Promise<Outcome<{ dto: WarehouseLocationDto; previous: string | null }>> => {
          const ctx = await repo.findWithWarehouse(orgId, id, tx, "update")
          if (!ctx) return stop(E.WAREHOUSE_LOCATION_NOT_FOUND)
          if (ctx.warehouse.isSystem) return stop(E.WAREHOUSE_LOCATION_SYSTEM_PROTECTED)
          const updated = await repo.update(orgId, id, { barcode: input.barcode ?? generateLocationBarcode() }, tx)
          if (!updated.ok) return stop(E.WAREHOUSE_LOCATION_BARCODE_TAKEN)
          return good({ dto: await reloadDto(orgId, id, tx), previous: ctx.loc.barcode })
        }
      )
      if (!outcome.ok) return toFailure(outcome)

      await audit(orgId, actorId, EV.BARCODE_CHANGED, id, {
        previousBarcode: outcome.value.previous,
        barcode: outcome.value.dto.barcode,
      })
      return ok({ data: outcome.value.dto, msg: "Barcode changed successfully" })
    },

    /**
     * Hard-deletes a location that was never used.
     * Business logic: requires delete:warehouse-location; system warehouses are protected; the
     * location must have no children; it must never have held stock or appeared in a document
     * (usage registry: history), otherwise it is deactivated instead so history stays intact; a
     * restrict foreign key from another table is the last line of defence and also maps to "in use".
     */
    async delete(actorId: string, orgId: string, id: string): Promise<Result<DeleteWarehouseLocationResult, Code>> {
      if (!(await can(actorId, P.DELETE, orgId))) return forbidden()

      const outcome = await repo.transaction(async (tx): Promise<Outcome<{ fullCode: string }>> => {
        const ctx = await repo.findWithWarehouse(orgId, id, tx, "update")
        if (!ctx) return stop(E.WAREHOUSE_LOCATION_NOT_FOUND)
        if (ctx.warehouse.isSystem) return stop(E.WAREHOUSE_LOCATION_SYSTEM_PROTECTED)
        if (await repo.hasChildren(orgId, id, tx)) return stop(E.WAREHOUSE_LOCATION_HAS_CHILDREN)
        const u = await usage.locationUsage(orgId, [id], tx)
        if (u.withStock.includes(id) || u.withOpenDocuments.includes(id) || u.withHistory.includes(id)) {
          return stop(E.WAREHOUSE_LOCATION_IN_USE)
        }
        const deleted = await repo.delete(orgId, id, tx)
        if (!deleted.ok) return stop(E.WAREHOUSE_LOCATION_IN_USE)
        return good({ fullCode: ctx.loc.fullCode })
      })
      if (!outcome.ok) return toFailure(outcome)

      await audit(orgId, actorId, EV.DELETED, id, { fullCode: outcome.value.fullCode })
      return ok({ data: { id }, msg: "Location deleted successfully" })
    },

    /**
     * Gate for other modules before they post stock to a location (INTERNAL: no actor, no
     * permission check; the calling module authorized its own operation).
     * Business logic: pass the caller's transaction so the location row is read with a shared
     * lock, which keeps structural changes (stockable off, move, deactivate) from slipping in
     * between this check and the posting. The location must exist, its warehouse and itself must
     * be active, and it must be stockable. receive needs receivable; issue (picking/allocation)
     * needs pickable. Unless the posting only moves stock OUT or ADJUSTS a count, the location
     * must not be blocked, directly or through an ancestor.
     */
    async assertPostable(
      orgId: string,
      locationId: string,
      intent: WarehouseLocationPostingIntent,
      tx?: Tx
    ): Promise<Result<{ id: string; warehouseId: string; fullCode: string }, E>> {
      const ctx = await repo.findWithWarehouse(orgId, locationId, tx, "share")
      const failWith = (error: E) =>
        fail({ error, msg: warehouseLocationTranslationsEn.errors[error] })
      if (!ctx) return failWith(E.WAREHOUSE_LOCATION_NOT_FOUND)
      const { loc, warehouse } = ctx
      if (!warehouse.isActive) return failWith(E.WAREHOUSE_LOCATION_WAREHOUSE_INACTIVE)
      if (!loc.isActive) return failWith(E.WAREHOUSE_LOCATION_INACTIVE)
      if (!loc.isStockable) return failWith(E.WAREHOUSE_LOCATION_NOT_STOCKABLE)
      if (intent === "receive" && !loc.isReceivable) return failWith(E.WAREHOUSE_LOCATION_NOT_RECEIVABLE)
      if (intent === "issue" && !loc.isPickable) return failWith(E.WAREHOUSE_LOCATION_NOT_PICKABLE)
      if (intent !== "move_out" && intent !== "adjust") {
        if (await repo.hasBlockedInChain(orgId, loc.pathIds, tx)) return failWith(E.WAREHOUSE_LOCATION_BLOCKED)
      }
      return ok({
        data: { id: loc.id, warehouseId: loc.warehouseId, fullCode: loc.fullCode },
        msg: "Location is postable",
      })
    },
  }
}
