// Platform API base URL. Defaults to the local `wrangler dev` port of apps/platform-server.
export const API_CONFIG = {
  baseURL: import.meta.env.VITE_PLATFORM_API_URL ?? "http://localhost:8788",
}
