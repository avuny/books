import Axios from "axios"

import { API_CONFIG } from "../config"
import { tokenStorage } from "./token-storage"

export async function refreshAccessToken() {
  const response = await Axios.post(
    API_CONFIG.refreshTokenUrl,
    {},
    {
      withCredentials: true,
    }
  )

  const accessToken = response.data.data.accessToken

  tokenStorage.setAccessToken(accessToken)

  return accessToken
}
