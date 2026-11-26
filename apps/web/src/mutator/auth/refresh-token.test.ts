import { describe, it, expect, vi, beforeEach } from "vitest"
import Axios from "axios"
import { refreshAccessToken } from "./refresh-token"
import { tokenStorage } from "./token-storage"

vi.mock("axios")

// Node has no Web Storage before v25 and this suite runs without a DOM env.
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

describe("refreshAccessToken", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it("extracts accessToken from response.data.data.tokens and stores it", async () => {
    const mockPost = vi.mocked(Axios.post)
    mockPost.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          tokens: {
            accessToken: "valid-new-token",
            accessTokenExpiresAt: "2026-11-18T18:00:00Z",
          },
        },
      },
    })

    const token = await refreshAccessToken()

    expect(token).toBe("valid-new-token")
    expect(tokenStorage.getAccessToken()).toBe("valid-new-token")
    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/refresh"),
      {},
      {
        withCredentials: true,
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      }
    )
  })

  it("extracts accessToken if directly under response.data.data", async () => {
    const mockPost = vi.mocked(Axios.post)
    mockPost.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          accessToken: "direct-token",
        },
      },
    })

    const token = await refreshAccessToken()

    expect(token).toBe("direct-token")
    expect(tokenStorage.getAccessToken()).toBe("direct-token")
  })

  it("throws error and does not store invalid token if accessToken is missing", async () => {
    const mockPost = vi.mocked(Axios.post)
    mockPost.mockResolvedValueOnce({
      data: {
        success: true,
        data: {},
      },
    })

    await expect(refreshAccessToken()).rejects.toThrow(
      "Access token missing in refresh response"
    )
    expect(tokenStorage.getAccessToken()).toBeNull()
  })
})
