import Axios from "axios"

import { API_CONFIG } from "@/lib/config"

// Admin session cookie only (PLATFORM-ADMIN-SPEC 3.2). No bearer tokens, no tenant headers.
export const AXIOS_INSTANCE = Axios.create({
  baseURL: API_CONFIG.baseURL,
  withCredentials: true,
})
