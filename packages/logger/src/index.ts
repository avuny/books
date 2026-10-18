import pino, { type Logger, type LoggerOptions } from "pino"

const env = process.env.NODE_ENV ?? "development"
const isDev = env === "development"
const isTest = env === "test"

const level =
  process.env.LOG_LEVEL ?? (isTest ? "silent" : isDev ? "debug" : "info")

const baseOptions: LoggerOptions = {
  level,
  base: { service: process.env.SERVICE_NAME ?? "avuny-api", env },
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: { err: pino.stdSerializers.err },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "token",
      "*.password",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
      "*.otp",
    ],
    censor: "[redacted]",
  },
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:HH:MM:ss",
        ignore: "service,env",
      },
    },
  }),
}

export function createLogger(overrides: LoggerOptions = {}): Logger {
  return pino({ ...baseOptions, ...overrides })
}

export const logger = createLogger()

export type { Logger }
