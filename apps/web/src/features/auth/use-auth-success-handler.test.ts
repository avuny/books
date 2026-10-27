import { describe, expect, it, vi, beforeEach } from "vitest"
import { useAuthSuccessHandler } from "./use-auth-success-handler"
import type { AuthResponse } from "@avuny/contracts/user"

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { thing?: string }) =>
      `Welcome ${opts?.thing ?? ""}`,
  }),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}))

const storage: Record<string, string> = {}
globalThis.localStorage = {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => {
    storage[key] = value
  },
  removeItem: (key: string) => {
    delete storage[key]
  },
  clear: () => {
    for (const key of Object.keys(storage)) delete storage[key]
  },
  length: 0,
  key: () => null,
}

globalThis.window = {
  setTimeout: setTimeout as any,
  location: {
    reload: vi.fn(),
    replace: vi.fn(),
  } as any,
} as any

describe("useAuthSuccessHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  const mockAuthData: { data: AuthResponse } = {
    data: {
      tokens: {
        accessToken: "test-token-123",
        accessTokenExpiresAt: new Date().toISOString(),
      },
      user: {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "John Doe",
        identifier: "john@example.com",
        identifierType: "email",
        avatarUrl: null,
        platformRole: "user",
      },
    },
  }

  it("stores token in localStorage and triggers toast", async () => {
    const { toast } = await import("sonner")
    const handler = useAuthSuccessHandler()

    handler(mockAuthData)

    expect(localStorage.getItem("accessToken")).toBe("test-token-123")
    expect(toast.success).toHaveBeenCalledWith("Welcome John Doe", {
      description: undefined,
    })
  })
})
