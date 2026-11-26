import {
  BATCH_AUDIT_EVENTS,
  BATCH_ENSURE_MAX,
  BatchErrorCode as Err,
  batchNumberKey,
  batchTranslationsEn,
  checkBatchSpec,
  mergeBatchSpecs,
  resolveBatchShelfLifeAndExpiry,
  type BatchDto,
  type BatchOffsetListQuery,
  type BatchOffsetListResponse,
  type BatchSpec,
  type BatchStatus,
  type ChangeBatchStatusInput,
} from "@avuny/contracts"
import type { Batch, NewBatch, Tx } from "@avuny/db"
import { fail, ok, type Result } from "@avuny/utils"
import { toBatchDto } from "./batch.mapper.js"
import type { BatchServiceDeps, Code } from "./batch.types.js"
import { DummyBatchActivityLog } from "./testing.js"

/** Expected failures travel as a value; every check that can fail runs before the first write. */
type Failure = { failed: true; error: Code; msg: string }
const failure = (error: Code, msg: string = batchTranslationsEn.errors[error]): Failure => ({
  failed: true,
  error,
  msg,
})
const isFailure = (v: unknown): v is Failure =>
  typeof v === "object" && v !== null && (v as Failure).failed === true
const toFail = (f: Failure) => fail({ error: f.error, msg: f.msg })

const message = (code: Code) => batchTranslationsEn.errors[code]

export function createBatchService(deps: BatchServiceDeps) {
  const repo = deps.repository
  const activityLog = deps.activityLog ?? new DummyBatchActivityLog()

  return {
    /**
     * Finds or creates the batches of one item. INTERNAL: no actor permission check; the calling
     * module (opening stock, purchasing, production) authorized its own operation and passes its
     * transaction so the batches commit together with the stock that uses them.
     * Business logic:
     *  - numbers are trimmed and case-insensitive; the same number twice in one request is one
     *    batch (details may be left out on one of the two, contradicting details are a conflict).
     *  - a batch that already exists is reused and never changed; dates that contradict the stored
     *    ones are a conflict, so a lot cannot silently get two expiry dates.
     *  - the item's batches are locked while this runs, so two requests creating the same new lot
     *    cannot race.
     * Returns one batch per distinct number, in first-seen order; match them with batchNumberKey.
     * It does not check that the item is batch tracked: the stock movement service does when stock
     * is posted against a batch.
     */
    async ensureBatches(
      orgId: string,
      itemId: string,
      specs: readonly BatchSpec[],
      tx?: Tx
    ): Promise<Result<BatchDto[], Code>> {
      if (specs.length === 0) return ok({ data: [], msg: "No batches requested" })
      if (specs.length > BATCH_ENSURE_MAX) return fail({ error: Err.BATCH_TOO_MANY, msg: message(Err.BATCH_TOO_MANY) })
      for (const spec of specs) {
        const problem = checkBatchSpec(spec)
        if (problem) return fail({ error: problem, msg: message(problem) })
      }
      const merged = mergeBatchSpecs(specs)
      if (!merged.ok) return fail({ error: merged.error, msg: message(merged.error) })

      const run = async (t: Tx): Promise<Failure | Batch[]> => {
        await repo.lockItemBatches(orgId, itemId, t)
        const keys = merged.value.map((s) => batchNumberKey(s.number))
        const existing = new Map(
          (await repo.findByKeys(orgId, itemId, keys, t)).map((b) => [batchNumberKey(b.batchNumber), b])
        )

        const defaultShelfLife = await repo.findItemDefaultShelfLife(orgId, itemId, t)
        const missing: NewBatch[] = []
        for (const spec of merged.value) {
          const found = existing.get(batchNumberKey(spec.number))
          if (!found) {
            const resolved = resolveBatchShelfLifeAndExpiry({
              spec,
              defaultShelfLife: defaultShelfLife
                ? {
                    value: defaultShelfLife.defaultShelfLifeValue,
                    unit: defaultShelfLife.defaultShelfLifeUnit,
                  }
                : null,
            })
            missing.push({
              orgId,
              itemId,
              batchNumber: spec.number,
              manufacturedOn: spec.manufacturedOn ?? null,
              expiresOn: resolved.expiresOn,
              shelfLifeValue: resolved.shelfLifeValue,
              shelfLifeUnit: resolved.shelfLifeUnit,
              notes: spec.notes ?? null,
            })
            continue
          }
          const contradicts = (given: string | null | undefined, stored: string | null) =>
            given != null && stored !== null && given !== stored
          if (
            contradicts(spec.manufacturedOn, found.manufacturedOn) ||
            contradicts(spec.expiresOn, found.expiresOn)
          ) {
            return failure(Err.BATCH_DETAILS_CONFLICT)
          }
        }

        if (missing.length > 0) {
          const inserted = await repo.insertMany(missing, t)
          if (!inserted.ok) {
            return failure(inserted.reason === "item_not_found" ? Err.BATCH_ITEM_NOT_FOUND : Err.BATCH_DETAILS_CONFLICT)
          }
          for (const row of inserted.rows) existing.set(batchNumberKey(row.batchNumber), row)
        }
        return keys.map((key) => existing.get(key)!) // every key was found or inserted above
      }
      const outcome = await (tx ? run(tx) : repo.transaction(run))
      if (isFailure(outcome)) return toFail(outcome)
      return ok({ data: outcome.map(toBatchDto), msg: "Batches ready" })
    },

    /**
     * What the stock movement service asks before posting against batches: which item each batch
     * belongs to and its status. A batch missing from the result does not exist in the organization.
     */
    async findForPosting(orgId: string, ids: readonly string[], tx?: Tx) {
      const rows = await repo.findForPosting(orgId, ids, tx)
      return new Map(rows.map((r) => [r.id, { itemId: r.itemId, status: r.status, expiresOn: r.expiresOn }]))
    },

    async get(orgId: string, id: string): Promise<Result<BatchDto, Code>> {
      const row = await repo.findById(orgId, id)
      if (!row) return fail({ error: Err.BATCH_NOT_FOUND, msg: message(Err.BATCH_NOT_FOUND) })
      return ok({ data: toBatchDto(row), msg: "Batch retrieved successfully" })
    },

    /** Batches of one item: soonest expiry first, optionally by status or number. */
    async list(orgId: string, query: BatchOffsetListQuery): Promise<Result<BatchOffsetListResponse, Code>> {
      const { rows, total } = await repo.list(orgId, query)
      return ok({
        data: { items: rows.map(toBatchDto), page: query.page, pageSize: query.pageSize, total },
        msg: "Batches retrieved successfully",
      })
    },

    /**
     * Quarantines, blocks, recalls or releases a batch.
     * Business logic: the status must change; the row is locked; the change is audited after commit.
     * The stock already in the batch stays where it is: statuses only decide which postings are
     * allowed next (see batchAllowsIntent). Who may change a status is decided by the route.
     */
    async changeStatus(
      actorId: string,
      orgId: string,
      id: string,
      input: ChangeBatchStatusInput
    ): Promise<Result<BatchDto, Code>> {
      const outcome = await repo.transaction(
        async (tx): Promise<Failure | { batch: Batch; previous: BatchStatus }> => {
          const row = await repo.findById(orgId, id, tx, { forUpdate: true })
          if (!row) return failure(Err.BATCH_NOT_FOUND)
          if (row.status === input.status) return failure(Err.BATCH_STATUS_UNCHANGED)
          const updated = await repo.updateStatus(orgId, id, input.status, tx)
          if (!updated) return failure(Err.BATCH_NOT_FOUND)
          return { batch: updated, previous: row.status }
        }
      )
      if (isFailure(outcome)) return toFail(outcome)

      await activityLog.log({
        action: BATCH_AUDIT_EVENTS.STATUS_CHANGED,
        actorId,
        orgId,
        resourceId: id,
        metadata: { from: outcome.previous, to: input.status, note: input.note ?? null },
      })
      return ok({ data: toBatchDto(outcome.batch), msg: "Batch status changed successfully" })
    },
  }
}
