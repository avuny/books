# Proposal: real DB transactions (decision D1)

**Problem.** The Neon HTTP driver makes `db.transaction` a sequential wrapper with no rollback. PO confirm, shipment post and reverse update several rows and the inventory projection, so a failure midway leaves them inconsistent.

**Change.** Move write paths to the Neon WebSocket/Pool driver (or node-postgres) for transactional routes, keep HTTP for reads. Alternatively add an outbox with idempotent replay.

**Cost.** Driver switch in packages/db, connection handling in serverless, and integration tests for rollback. Until then every multi-step write is best-effort and documented as such in the SPEC.
