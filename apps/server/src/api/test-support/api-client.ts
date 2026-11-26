import { randomInt } from "node:crypto"

const API_BASE_PATH = "/api"

/** Response envelope every route returns (see handleResult / validationHook). */
export type ApiSuccess<T> = { success: true; data: T }
export type ApiFailure = {
  success: false
  code: string
  message: string
  type: "domain" | "validation" | "server" | "not_found"
  /** Present on 422 validation errors. */
  errors?: { path: (string | number)[]; code: string; message: string }[]
}
export type ApiBody<T> = ApiSuccess<T> | ApiFailure
export interface ApiResponse<T = unknown> {
  status: number
  body: ApiBody<T>
  headers: Headers
}

/** What the harness needs from the Hono app: `app.request`. */
export interface RequestableApp {
  request(input: string, init?: RequestInit): Response | Promise<Response>
}

export interface RequestOptions {
  json?: unknown
  query?: Record<string, string | number | boolean | undefined>
  headers?: Record<string, string>
}

interface ClientState {
  token?: string
  lang: string
  ip: string
}

const randomIp = () =>
  `10.${randomInt(0, 256)}.${randomInt(0, 256)}.${randomInt(1, 255)}`

/**
 * A browser-like caller for the real app: bearer token, cookie jar, Accept-Language and a
 * client IP of its own. Requests go through the full middleware stack with `app.request`
 * (no network), so what runs is the production app.
 *
 * Paths are relative to the API base: `api.get("/organizations")` calls `/api/organizations`.
 */
export class ApiClient {
  private constructor(
    private readonly app: RequestableApp,
    private readonly state: ClientState,
    private readonly cookies: Map<string, string>
  ) {}

  static create(
    app: RequestableApp,
    state: Partial<ClientState> = {}
  ): ApiClient {
    return new ApiClient(
      app,
      { lang: "en", ip: randomIp(), ...state },
      new Map()
    )
  }

  /** Same caller (cookie jar and IP) acting with another access token. */
  withToken(token: string | undefined): ApiClient {
    return new ApiClient(this.app, { ...this.state, token }, this.cookies)
  }

  withLang(lang: string): ApiClient {
    return new ApiClient(this.app, { ...this.state, lang }, this.cookies)
  }

  /** A brand-new anonymous caller: new IP, empty cookie jar. */
  anonymous(): ApiClient {
    return ApiClient.create(this.app, { lang: this.state.lang })
  }

  get cookie(): ReadonlyMap<string, string> {
    return this.cookies
  }

  get<T = unknown>(path: string, options: RequestOptions = {}) {
    return this.request<T>("GET", path, options)
  }
  post<T = unknown>(path: string, options: RequestOptions = {}) {
    return this.request<T>("POST", path, options)
  }
  put<T = unknown>(path: string, options: RequestOptions = {}) {
    return this.request<T>("PUT", path, options)
  }
  patch<T = unknown>(path: string, options: RequestOptions = {}) {
    return this.request<T>("PATCH", path, options)
  }
  delete<T = unknown>(path: string, options: RequestOptions = {}) {
    return this.request<T>("DELETE", path, options)
  }

  async request<T = unknown>(
    method: string,
    path: string,
    { json, query, headers }: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) search.set(key, String(value))
    }
    const qs = search.size ? `?${search.toString()}` : ""
    const url = `${path.startsWith(API_BASE_PATH) ? "" : API_BASE_PATH}${path}${qs}`

    const requestHeaders: Record<string, string> = {
      "accept-language": this.state.lang,
      "x-forwarded-for": this.state.ip,
      "user-agent": "vitest-integration",
      ...headers,
    }
    if (json !== undefined) requestHeaders["content-type"] = "application/json"
    if (this.state.token)
      requestHeaders.authorization = `Bearer ${this.state.token}`
    if (this.cookies.size) {
      requestHeaders.cookie = [...this.cookies]
        .map(([k, v]) => `${k}=${v}`)
        .join("; ")
    }

    const res = await this.app.request(url, {
      method,
      headers: requestHeaders,
      body: json === undefined ? undefined : JSON.stringify(json),
    })
    this.storeCookies(res)

    const text = await res.text()
    let body: unknown = undefined
    if (text) {
      try {
        body = JSON.parse(text)
      } catch {
        body = {
          success: false,
          code: "NON_JSON_RESPONSE",
          message: text,
          type: "server",
        }
      }
    }
    return {
      status: res.status,
      body: body as ApiBody<T>,
      headers: res.headers,
    }
  }

  private storeCookies(res: Response) {
    for (const line of res.headers.getSetCookie()) {
      const [pair = "", ...attributes] = line
        .split(";")
        .map((part) => part.trim())
      const eq = pair.indexOf("=")
      if (eq < 1) continue
      const name = pair.slice(0, eq)
      const value = pair.slice(eq + 1)
      const expired =
        attributes.some((a) => /^max-age=0$/i.test(a)) || value === ""
      if (expired) this.cookies.delete(name)
      else this.cookies.set(name, value)
    }
  }
}

const describeBody = (res: ApiResponse<unknown>) =>
  `${res.status} ${JSON.stringify(res.body)}`

/** Asserts a success envelope (and optionally the status) and returns `data`. */
export function expectOk<T>(res: ApiResponse<T>, status?: number): T {
  if (!res.body?.success || (status !== undefined && res.status !== status)) {
    throw new Error(
      `Expected success${status !== undefined ? ` with status ${status}` : ""}, got ${describeBody(res)}`
    )
  }
  return res.body.data
}

/** Asserts a failure envelope with the given status (and domain error code) and returns it. */
export function expectFailure(
  res: ApiResponse<unknown>,
  status: number,
  code?: string
): ApiFailure {
  if (
    res.body?.success !== false ||
    res.status !== status ||
    (code !== undefined && res.body.code !== code)
  ) {
    throw new Error(
      `Expected ${status}${code ? ` ${code}` : ""}, got ${describeBody(res)}`
    )
  }
  return res.body
}
