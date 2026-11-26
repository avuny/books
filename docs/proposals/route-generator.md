# Proposal: spec-driven route generator

**Problem.** Each module has 6 to 20 near-identical route files. They are boilerplate with the type traps above.

**Change.** A script `scripts/generate-module-routes.ts` reading a small JSON spec (operationId, method, path, service method, request schema, success status, error codes) and emitting route files like party's. During purchase-order a throwaway Python version of this produced 16 routes that typechecked on the first run.

**Cost.** One script and a documented spec format. Generated files stay editable.
