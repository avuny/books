export type LogLevel = "debug" | "info" | "warn" | "error"
export type LogFields = Record<string, unknown>

export interface Logger {
  debug(fields: LogFields | string, msg?: string): void
  info(fields: LogFields | string, msg?: string): void
  warn(fields: LogFields | string, msg?: string): void
  error(fields: LogFields | string, msg?: string): void
  child(bindings: LogFields): Logger
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

// JSON.stringify turns Error instances into "{}", so serialize them explicitly.
function replacer(_key: string, value: unknown) {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack }
  }
  return value
}

export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === "string" && value in LEVEL_ORDER
}

/**
 * Minimal structured JSON logger that works on Cloudflare Workers
 * (output goes to console, which Workers Logs / `wrangler tail` pick up).
 */
export function createLogger(
  options: { level?: LogLevel; bindings?: LogFields } = {}
): Logger {
  const minLevel = LEVEL_ORDER[options.level ?? "info"]
  const bindings = options.bindings ?? {}

  const write = (level: LogLevel, a: LogFields | string, b?: string) => {
    if (LEVEL_ORDER[level] < minLevel) return

    const fields = typeof a === "string" ? {} : a
    const msg = typeof a === "string" ? a : b

    const line = JSON.stringify(
      { level, time: new Date().toISOString(), ...bindings, ...fields, msg },
      replacer
    )

    switch (level) {
      case "error":
        console.error(line)
        break
      case "warn":
        console.warn(line)
        break
      case "debug":
        console.debug(line)
        break
      default:
        console.log(line)
    }
  }

  return {
    debug: (a, b) => write("debug", a, b),
    info: (a, b) => write("info", a, b),
    warn: (a, b) => write("warn", a, b),
    error: (a, b) => write("error", a, b),
    child: (extra) =>
      createLogger({
        level: options.level,
        bindings: { ...bindings, ...extra },
      }),
  }
}
