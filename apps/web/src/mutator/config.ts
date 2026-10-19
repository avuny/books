const baseURL = import.meta.env.VITE_API_URL

if (!baseURL) {
  throw new Error("VITE_API_URL is missing from environment variables")
}

export const API_CONFIG = {
  baseURL,

  refreshTokenUrl: `${baseURL}/api/auth/token/refresh`,

  auth: {
    refreshStatusCode: 401,
    refreshErrorCodes: ["UNAUTHENTICATED", "SERVER_ERROR"], // error code return by requireAuth when access token or session is invalid or expired
  },

  headers: {
    organizationId: "x-organization-id",
    language: "x-lang",
  },
}
