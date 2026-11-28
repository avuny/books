# Prod monitoring (operating setup)

Goal: failures such as Cloudflare error 1102 (Worker CPU limit) and the subrequest limit show up within minutes, not during a smoke test.

## Who runs it
The release agent runs a recurring wake every 15 minutes. It reports to the main agent only when something material shows. Green runs stay silent.

## 1. Health probe (live)
`scripts/ops/prod-probe.py`, run every 15 minutes.
- `GET /api/health` every run, retried once after 10 seconds.
- Once an hour at most: sign in with the test account ("Avuny Books test account" in the vault), then one authenticated read (purchase order list). Sign-in costs bcrypt CPU on the Worker, so it is rate limited in the script. Do not run it more often.
- History is appended to `~/monitor/history.jsonl` (ts, kind, status, seconds, error code).
- ALERT when: health fails twice in a row; 2 of the last 4 sign-in/read probes returned 5xx; latency is above max(3s, 3x the recent median) on two probes in a row.
- The script never prints tokens or sign-in bodies.

## 2. Error-log pull (live: `scripts/ops/prod-logpull.py`, needs the Cloudflare token in the vault)
The script queries the Workers Observability telemetry API (`POST /accounts/{id}/workers/observability/telemetry/query`, filter `$workers.outcome != ok`). Each event carries outcome, cpuTimeMs, wallTimeMs, path, status and script version. `canceled` (client hung up) is ignored unless the status is 5xx. Alerts on a new (method, route, outcome, status) group or a higher count.

Every hour: query Workers Observability for `hono-worker-api` outcomes other than ok (5xx, `exceededCpu`, `exceededMemory`, exceptions) for the last hour, count them by route and status, and compare with the probe history. A new route or a new outcome type is an alert. Token: vault login "Cloudflare API token (Workers logs read)", read-only, account scope. Never write the token to the repo or logs.

## 3. Alerting
Report with evidence (times, routes, counts, probe rows). No report when all is green. A repeat of an already reported failure is not re-reported unless the rate or the routes change.

## Known failure modes
- 1102 on sign-in: bcryptjs cost 12. Mitigation in PR #93 (cost 10 plus rehash on sign-in).
- "Too many subrequests": one request composing several posting services. Keep each request small (see vendor-bill-payment D14).
