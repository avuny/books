import Axios from "axios"

import { API_CONFIG } from "../config"
import { tokenStorage } from "./token-storage"

export async function refreshAccessToken(): Promise<string> {
  const response = await Axios.post(
    API_CONFIG.refreshTokenUrl,
    {},
    {
      withCredentials: true,
      headers: {
        "X-Requested-With": "XMLHttpRequest",
      },
    }
  )

  const accessToken =
    response.data?.data?.tokens?.accessToken ?? response.data?.data?.accessToken

  if (!accessToken || typeof accessToken !== "string") {
    throw new Error("Access token missing in refresh response")
  }

  tokenStorage.setAccessToken(accessToken)

  return accessToken
}
