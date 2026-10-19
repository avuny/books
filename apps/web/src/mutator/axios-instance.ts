import Axios from "axios"

import { API_CONFIG } from "./config"
import { requestInterceptor } from "./interceptors/request.interceptor"
import { responseErrorInterceptor } from "./interceptors/response.interceptor"

export const AXIOS_INSTANCE = Axios.create({
  baseURL: API_CONFIG.baseURL,

  withCredentials: true,
})

AXIOS_INSTANCE.interceptors.request.use(
  requestInterceptor
)

AXIOS_INSTANCE.interceptors.response.use(
  (response) => response,
  responseErrorInterceptor
)
