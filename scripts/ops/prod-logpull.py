#!/usr/bin/env python3
"""Hourly Workers log pull for hono-worker-api. Prints OK or ALERT; appends rows to ~/monitor/logs.jsonl.

Counts failing requests in the last N minutes (outcome other than ok/canceled, or HTTP status >= 500),
grouped by method, route (ids replaced) and outcome. ALERT when there is a new (route, outcome) pair
or the count for a known pair grew since the last pull. Canceled means the client hung up; not an alert.
Env: CF_TOKEN_FILE (vault file), CF_ACCOUNT_ID, PROBE_DIR. Never prints the token.
"""
import collections, json, os, re, sys, time, urllib.request

TOKEN = open(os.path.expanduser(os.environ.get("CF_TOKEN_FILE", "~/.vault/cloudflare-api-token-workers-logs-read-c96fc4/password"))).read().strip()
ACCT = os.environ.get("CF_ACCOUNT_ID", "770a0d5d4c75a71b1b41c689b9c6cf26")
DIR = os.path.expanduser(os.environ.get("PROBE_DIR", "~/monitor"))
MIN = int(os.environ.get("LOGPULL_MINUTES", "75"))


def query(filters, limit=500):
    now = int(time.time() * 1000)
    body = {"queryId": "pull", "view": "events", "limit": limit, "timeframe": {"from": now - MIN * 60000, "to": now},
            "parameters": {"datasets": ["cloudflare-workers"], "calculations": [], "groupBys": [],
                           "filters": [{"key": "$metadata.service", "operation": "eq", "type": "string", "value": "hono-worker-api"}] + filters,
                           "orderBy": {"value": "timestamp", "order": "desc"}}}
    req = urllib.request.Request(f"https://api.cloudflare.com/client/v4/accounts/{ACCT}/workers/observability/telemetry/query",
                                 data=json.dumps(body).encode(), headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"})
    r = json.load(urllib.request.urlopen(req, timeout=60))
    if not r.get("success"):
        raise SystemExit("ALERT log query failed: " + json.dumps(r.get("errors"))[:200])
    return r["result"]["events"]["events"]


def main():
    events = query([{"key": "$workers.outcome", "operation": "neq", "type": "string", "value": "ok"}])
    counts = collections.Counter()
    rows = []
    for e in events:
        w = e["$workers"]
        outcome = w.get("outcome")
        status = (w["event"].get("response") or {}).get("status") or 0
        if outcome == "canceled" and status < 500:
            continue
        route = re.sub(r"[0-9a-f]{8}-[0-9a-f-]{27}|REDACTED", "ID", w["event"].get("path", ""))
        key = f'{w["event"]["request"]["method"]} {route} {outcome} {status}'
        counts[key] += 1
        rows.append({"ts": e["timestamp"], "key": key, "cpuMs": w.get("cpuTimeMs"), "wallMs": w.get("wallTimeMs"), "version": (w.get("scriptVersion") or {}).get("id", "")[:8]})
    os.makedirs(DIR, exist_ok=True)
    with open(os.path.join(DIR, "logs.jsonl"), "a") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")
    sp = os.path.join(DIR, "logpull.state.json")
    prev = json.load(open(sp)) if os.path.exists(sp) else {}
    new = [f"{k} x{n}" + (" (new)" if k not in prev else f" (was {prev[k]})") for k, n in counts.items() if n > prev.get(k, 0)]
    json.dump(dict(counts), open(sp, "w"))
    open(os.path.join(DIR, "logpull.last"), "w").write(time.strftime("%Y-%m-%dT%H:%M:%S%z"))
    print("ALERT " + "; ".join(new) if new else "OK")
    sys.exit(1 if new else 0)


main()
