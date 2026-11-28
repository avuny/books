#!/usr/bin/env python3
"""Prod health probe. Run every 15 minutes. Prints OK or ALERT lines and appends to a history file.

- Every run: GET /api/health (retried once after 10s on failure).
- At most once per hour: sign in with the test account, then one authenticated read.
  Sign-in costs bcrypt CPU on the Worker, so it is rate limited here.
- ALERT when: health fails twice in a row, 2 of the last 4 sign-ins or reads returned 5xx,
  or latency is above max(3s, 3x the median of the last 20 samples) twice in a row.
Env: PROBE_DIR (history dir, default ~/monitor), PROBE_API, PROBE_ORG, PROBE_USER_FILE, PROBE_PASS_FILE.
Never prints tokens or the sign-in response body.
"""
import json, os, statistics, sys, time, urllib.error, urllib.request

API = os.environ.get("PROBE_API", "https://hono-worker-api.khaledeveloper.workers.dev")
ORG = os.environ.get("PROBE_ORG", "f543dade-4b8b-4f77-98ac-ca9192de7e63")
DIR = os.path.expanduser(os.environ.get("PROBE_DIR", "~/monitor"))
UF = os.path.expanduser(os.environ.get("PROBE_USER_FILE", "~/.vault/avuny-books-test-account-8c1ec0/username"))
PF = os.path.expanduser(os.environ.get("PROBE_PASS_FILE", "~/.vault/avuny-books-test-account-8c1ec0/password"))
HIST = os.path.join(DIR, "history.jsonl")
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/120", "Content-Type": "application/json", "Accept": "application/json"}


def call(method, path, body=None, tok=None):
    h = dict(UA)
    if tok:
        h["Authorization"] = "Bearer " + tok
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method)
    t = time.time()
    try:
        r = urllib.request.urlopen(req, timeout=30)
        raw, code = r.read(), r.status
    except urllib.error.HTTPError as e:
        raw, code = e.read(), e.code
    except Exception:
        return 0, time.time() - t, None
    try:
        data = json.loads(raw)
    except Exception:
        data = None
    return code, time.time() - t, data


def rec(kind, code, dt, err=None):
    row = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "kind": kind, "status": code, "sec": round(dt, 2)}
    if err:
        row["err"] = err
    os.makedirs(DIR, exist_ok=True)
    open(HIST, "a").write(json.dumps(row) + "\n")
    return row


def history():
    try:
        return [json.loads(l) for l in open(HIST)]
    except FileNotFoundError:
        return []


def errcode(data):
    return data.get("error_code") if isinstance(data, dict) else None


def main():
    alerts = []
    h = history()
    code, dt, data = call("GET", "/api/health")
    if not 200 <= code < 300:
        time.sleep(10)
        rec("health", code, dt, errcode(data))
        code, dt, data = call("GET", "/api/health")
    rec("health", code, dt, errcode(data))
    if not 200 <= code < 300:
        alerts.append(f"health failed twice (status {code}, error {errcode(data)})")

    last_login = next((r for r in reversed(h) if r["kind"] == "login"), None)
    due = last_login is None or time.time() - time.mktime(time.strptime(last_login["ts"][:19], "%Y-%m-%dT%H:%M:%S")) > 55 * 60
    if due and os.path.exists(PF):
        u, p = open(UF).read().strip(), open(PF).read()
        c, d, data = call("POST", "/api/auth/sign-in", {"identifier": u, "password": p})
        rec("login", c, d, errcode(data))
        if c == 200:
            tok = data["data"]["tokens"]["accessToken"]
            c2, d2, data2 = call("GET", f"/api/purchaseOrder/organizations/{ORG}/purchase-orders?limit=20", None, tok)
            rec("read", c2, d2, errcode(data2))
        recent = [r for r in history() if r["kind"] in ("login", "read")][-4:]
        bad = [r for r in recent if r["status"] >= 500 or r["status"] == 0]
        if len(bad) >= 2:
            alerts.append("2 of the last 4 sign-in/read probes failed: " + ", ".join(f'{r["kind"]} {r["status"]} {r.get("err") or ""}' for r in bad))

    hh = history()
    for kind in ("health", "login", "read"):
        s = [r for r in hh if r["kind"] == kind and 200 <= r["status"] < 300]
        if len(s) >= 8:
            base = statistics.median([r["sec"] for r in s[-21:-1]])
            thr = max(3.0, 3 * base)
            if s[-1]["sec"] > thr and s[-2]["sec"] > thr:
                alerts.append(f"{kind} latency {s[-1]['sec']}s and {s[-2]['sec']}s vs median {base}s")

    print("ALERT " + "; ".join(alerts) if alerts else "OK")
    sys.exit(1 if alerts else 0)


main()
