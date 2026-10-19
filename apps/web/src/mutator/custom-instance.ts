import { AxiosError, type AxiosRequestConfig } from "axios"

import { AXIOS_INSTANCE } from "./axios-instance"

export const customInstance = async <T>(
  url: string,
  options: RequestInit = {}
): Promise<T> => {
  const response = await AXIOS_INSTANCE.request({
    url,
    method: options.method as AxiosRequestConfig["method"],
    headers: Object.fromEntries(new Headers(options.headers).entries()),
    data: options.body,
    signal: options.signal ?? undefined,
  })

  return {
    data: response.data,
    status: response.status,
    headers: new Headers(response.headers as Record<string, string>),
  } as T
}

export type ErrorType<Error> = AxiosError<Error>
