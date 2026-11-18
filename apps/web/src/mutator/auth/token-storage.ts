const ACCESS_TOKEN_KEY = "accessToken"

export const tokenStorage = {
  getAccessToken(): string | null {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY)
    if (!token || token === "undefined" || token === "null") {
      return null
    }
    return token
  },

  setAccessToken(token: string | null | undefined) {
    if (!token || token === "undefined" || token === "null") {
      localStorage.removeItem(ACCESS_TOKEN_KEY)
      return
    }
    localStorage.setItem(ACCESS_TOKEN_KEY, token)
  },

  removeAccessToken() {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
  },
}
