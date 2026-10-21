import Axios, { AxiosError, type AxiosRequestConfig } from "axios"

import { AXIOS_INSTANCE } from "./axios-instance"

type CancelablePromise<T> = Promise<T> & {
  cancel?: () => void
}

export function customInstance<T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig
): CancelablePromise<T> {
  const source = Axios.CancelToken.source()

  const promise = AXIOS_INSTANCE({
    ...config,
    ...options,
    cancelToken: source.token,
  }).then((response) => response.data) as CancelablePromise<T>

  promise.cancel = () => {
    source.cancel("Request cancelled")
  }

  return promise
}

// In some case with react-query and swr you want to be able to override the return error type so you can also do it here like this
export type ErrorType<Error> = AxiosError<Error>
