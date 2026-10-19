import { AxiosError } from "axios"

import { refreshAccessToken } from "../auth/refresh-token"
import { refreshQueue } from "../auth/refresh-queue"
import { tokenStorage } from "../auth/token-storage"
import { API_CONFIG } from "../config"

type RetryableRequest = AxiosError["config"] & {
  _retry?: boolean
}

export async function responseErrorInterceptor(
  error: AxiosError<any>
) {
  const originalRequest = error.config as RetryableRequest

  const shouldRefresh = canRefreshToken(error)

  if (!shouldRefresh || originalRequest?._retry) {
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

    if (originalRequest.headers) {
      originalRequest.headers.Authorization =
        `Bearer ${newAccessToken}`
    }

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
  const status = error.response?.data?.status

  const code = error.response?.data?.body?.code

  return (
    status === API_CONFIG.auth.refreshStatusCode &&
    API_CONFIG.auth.refreshErrorCodes.includes(code)
  )
}

function enqueueRequest(originalRequest: RetryableRequest) {
  return new Promise((resolve, reject) => {
    refreshQueue.enqueue({
      resolve: (token: string) => {
        if (originalRequest.headers) {
          originalRequest.headers.Authorization =
            `Bearer ${token}`
        }

        resolve(retryRequest(originalRequest))
      },

      reject,
    })
  })
}

async function retryRequest(
  request: RetryableRequest
) {
  const { AXIOS_INSTANCE } = await import("../axios-instance")

  return AXIOS_INSTANCE(request)
}
