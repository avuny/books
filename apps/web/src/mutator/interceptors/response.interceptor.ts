import { AxiosError } from "axios"

import { refreshAccessToken } from "../auth/refresh-token"
import { refreshQueue } from "../auth/refresh-queue"
import { tokenStorage } from "../auth/token-storage"
import { API_CONFIG } from "../config"

type RetryableRequest = AxiosError["config"] & {
  _retry?: boolean
}

export async function responseErrorInterceptor(error: AxiosError<any>) {
  const originalRequest = error.config as RetryableRequest

  const shouldRefresh = canRefreshToken(error)

  if (!originalRequest || !shouldRefresh || originalRequest._retry) {
    return Promise.reject(error)
  }

  if (refreshQueue.isRefreshing()) {
    return enqueueRequest(originalRequest)
  }

  originalRequest._retry = true

  refreshQueue.startRefreshing()

  try {
    const newAccessToken = await refreshAccessToken()

    refreshQueue.process(null, newAccessToken)

    setRequestAuthorizationHeader(originalRequest, newAccessToken)

    return retryRequest(originalRequest)
  } catch (refreshError) {
    refreshQueue.process(refreshError)

    tokenStorage.removeAccessToken()

    return Promise.reject(refreshError)
  } finally {
    refreshQueue.stopRefreshing()
  }
}

function canRefreshToken(error: AxiosError<any>) {
  // those was when using fetch instead of axios, the error response structure is different
  // const status = error.response?.status

  // const code = error.response?.data?.code
  const status = error.response?.status

  const code = error.response?.data?.code
  return (
    status === API_CONFIG.auth.refreshStatusCode &&
    API_CONFIG.auth.refreshErrorCodes.includes(code)
  )
}

function setRequestAuthorizationHeader(
  request: RetryableRequest,
  token: string
) {
  if (!request?.headers) return
  if (typeof request.headers.set === "function") {
    request.headers.set("Authorization", `Bearer ${token}`)
  } else {
    request.headers.Authorization = `Bearer ${token}`
  }
}

function enqueueRequest(originalRequest: RetryableRequest) {
  originalRequest._retry = true

  return new Promise((resolve, reject) => {
    refreshQueue.enqueue({
      resolve: (token: string) => {
        setRequestAuthorizationHeader(originalRequest, token)

        resolve(retryRequest(originalRequest))
      },

      reject,
    })
  })
}

async function retryRequest(request: RetryableRequest) {
  const { AXIOS_INSTANCE } = await import("../axios-instance")

  return AXIOS_INSTANCE(request)
}
