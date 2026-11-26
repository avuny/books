import { randomBytes } from "node:crypto"
import type {
  AuthResponse,
  CreateOrganizationInput,
  OrganizationDto,
} from "@avuny/contracts"
import { getCaptureOutbox } from "../modules/messaging/index.js"
import { ApiClient, expectOk, type RequestableApp } from "./api-client.js"

/** Short, collision-free suffix for identifiers, org codes and usernames. */
export const uniqueId = (): string =>
  `${Date.now().toString(36)}${randomBytes(3).toString("hex")}`

export interface TestUser {
  id: string
  name: string
  identifier: string
  password: string
  /** Authenticated caller for this user. */
  api: ApiClient
}

export interface TestOrganization extends OrganizationDto {
  /** The owner's sign-in handle inside this organization. */
  ownerUsername: string
}

const DEFAULT_PASSWORD = "Passw0rd!-integration"

/**
 * Registers a user through the REAL public flow:
 * send-otp -> (OTP read from the capture outbox) -> verify -> sign-up.
 */
export async function createUser(
  app: RequestableApp,
  overrides: Partial<Pick<TestUser, "name" | "identifier" | "password">> = {}
): Promise<TestUser> {
  const id = uniqueId()
  const identifier = (
    overrides.identifier ?? `it-${id}@example.com`
  ).toLowerCase()
  const password = overrides.password ?? DEFAULT_PASSWORD
  const name = overrides.name ?? `Test User ${id}`
  const caller = ApiClient.create(app)

  const challenge = expectOk(
    await caller.post<{ challengeId: string }>("/auth/sign-up/send-otp", {
      json: { identifier },
    }),
    202
  )
  const verified = expectOk(
    await caller.post<{ verificationToken: string }>("/otp/verify", {
      json: {
        challengeId: challenge.challengeId,
        code: getCaptureOutbox().lastOtp(identifier),
      },
    })
  )
  const auth = expectOk(
    await caller.post<AuthResponse>("/auth/sign-up", {
      json: {
        identifier,
        name,
        password,
        verificationToken: verified.verificationToken,
      },
    })
  )

  return {
    id: auth.user.id,
    name,
    identifier,
    password,
    api: caller.withToken(auth.tokens.accessToken),
  }
}

/** Signs an existing user in again (new session, new token). */
export async function signIn(
  app: RequestableApp,
  user: TestUser
): Promise<TestUser> {
  const caller = ApiClient.create(app)
  const auth = expectOk(
    await caller.post<AuthResponse>("/auth/sign-in", {
      json: { identifier: user.identifier, password: user.password },
    })
  )
  return { ...user, api: caller.withToken(auth.tokens.accessToken) }
}

/** Creates an organization owned by `owner` through the real endpoint. */
export async function createOrganization(
  owner: TestUser,
  overrides: Partial<CreateOrganizationInput> = {}
): Promise<TestOrganization> {
  const id = uniqueId()
  const input: CreateOrganizationInput = {
    code: `t-${id}`,
    name: `Test Org ${id}`,
    defaultCurrency: "USD",
    timezone: "UTC",
    ownerUsername: `owner-${id}`,
    ...overrides,
  }
  const org = expectOk(
    await owner.api.post<OrganizationDto>("/organizations", { json: input }),
    201
  )
  return { ...org, ownerUsername: input.ownerUsername }
}

/** The most common arrange step: a signed-in user who owns a fresh organization. */
export async function createUserWithOrganization(app: RequestableApp) {
  const owner = await createUser(app)
  const org = await createOrganization(owner)
  return { owner, org }
}
