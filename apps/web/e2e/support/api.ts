import { randomBytes } from "node:crypto"
import type { APIRequestContext } from "@playwright/test"
import { API_URL } from "./env.ts"
import { waitForOtp } from "./outbox.ts"

export const uniqueId = () =>
  `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`

export const TEST_PASSWORD = "Passw0rd!-e2e-test"

export interface Account {
  id: string
  name: string
  identifier: string
  password: string
  accessToken: string
}

interface Envelope<T> {
  success: boolean
  data: T
}

async function post<T>(
  request: APIRequestContext,
  path: string,
  data: unknown,
  token?: string
): Promise<T> {
  const res = await request.post(`${API_URL}/api${path}`, {
    data,
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  })
  const body = (await res.json()) as Envelope<T>
  if (!res.ok() || !body.success) {
    throw new Error(
      `POST ${path} failed: ${res.status()} ${JSON.stringify(body)}`
    )
  }
  return body.data
}

/**
 * Arrange helper: registers a user through the real public API (send-otp -> verify -> sign-up).
 * Pass `context.request` so the refresh cookie lands in the browser context too.
 * The UI sign-up flow itself is covered by specs/auth.e2e.ts; everything else starts from here.
 */
export async function registerAccount(
  request: APIRequestContext
): Promise<Account> {
  const id = uniqueId()
  const identifier = `e2e-${id}@example.com`
  const name = `E2E User ${id}`

  const challenge = await post<{ challengeId: string }>(
    request,
    "/auth/sign-up/send-otp",
    {
      identifier,
    }
  )
  const verified = await post<{ verificationToken: string }>(
    request,
    "/otp/verify",
    {
      challengeId: challenge.challengeId,
      code: await waitForOtp(identifier),
    }
  )
  const auth = await post<{
    user: { id: string }
    tokens: { accessToken: string }
  }>(request, "/auth/sign-up", {
    identifier,
    name,
    password: TEST_PASSWORD,
    verificationToken: verified.verificationToken,
  })
  return {
    id: auth.user.id,
    name,
    identifier,
    password: TEST_PASSWORD,
    accessToken: auth.tokens.accessToken,
  }
}

export async function listOrganizations(
  request: APIRequestContext,
  account: Account
): Promise<{ id: string; code: string; name: string }[]> {
  const res = await request.get(`${API_URL}/api/organizations`, {
    headers: { authorization: `Bearer ${account.accessToken}` },
  })
  const body = (await res.json()) as Envelope<{
    items: { id: string; code: string; name: string }[]
  }>
  return body.data.items
}
