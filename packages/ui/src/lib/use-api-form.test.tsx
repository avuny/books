import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useApiForm } from "./use-api-form"

type Values = { username: string; password: string }

const errorMessages = {
  fallback: "Something went wrong",
  INVALID_CREDENTIALS: "Wrong credentials",
  USERNAME_TAKEN: "Username already taken",
}

const apiError = (code: string) => ({ response: { data: { code } } })

function setup(
  submit: (values: Values) => Promise<string>,
  extra: Partial<Parameters<typeof useApiForm<Values, string>>[0]> = {}
) {
  const onSuccess = vi.fn()
  const hook = renderHook(() =>
    useApiForm<Values, string>({
      resolver: async (values) => ({ values, errors: {} }),
      defaultValues: { username: "ada", password: "" },
      submit,
      onSuccess,
      errorMessages,
      ...extra,
    })
  )
  return { ...hook, onSuccess }
}

const submit = (r: { current: { onSubmit: () => Promise<void> } }) =>
  act(async () => {
    await r.current.onSubmit()
  })

describe("useApiForm", () => {
  it("passes the result to onSuccess", async () => {
    const { result, onSuccess } = setup(async () => "ok")
    await submit(result)
    expect(onSuccess).toHaveBeenCalledWith("ok")
    expect(result.current.errorMessage).toBeNull()
  })

  it("shows the localized message for a known code as a root error", async () => {
    const { result, onSuccess } = setup(() => Promise.reject(apiError("INVALID_CREDENTIALS")))
    await submit(result)
    expect(onSuccess).not.toHaveBeenCalled()
    expect(result.current.errorMessage).toBe("Wrong credentials")
  })

  it("uses the fallback for unknown errors", async () => {
    const { result } = setup(() => Promise.reject(new Error("network")))
    await submit(result)
    expect(result.current.errorMessage).toBe("Something went wrong")
  })

  it("maps a code to a field error instead of a root error", async () => {
    const { result } = setup(() => Promise.reject(apiError("USERNAME_TAKEN")), {
      fieldErrors: { USERNAME_TAKEN: "username" },
    })
    await submit(result)
    expect(result.current.form.formState.errors.username?.message).toBe("Username already taken")
    expect(result.current.errorMessage).toBeNull()
  })

  it("resets fields only for configured codes", async () => {
    const { result } = setup(() => Promise.reject(apiError("INVALID_CREDENTIALS")), {
      resetOnCode: { INVALID_CREDENTIALS: ["password"] },
    })
    act(() => result.current.form.setValue("password", "secret"))
    await submit(result)
    expect(result.current.form.getValues("password")).toBe("")

    const other = setup(() => Promise.reject(new Error("network")), {
      resetOnCode: { INVALID_CREDENTIALS: ["password"] },
    })
    act(() => other.result.current.form.setValue("password", "secret"))
    await submit(other.result)
    expect(other.result.current.form.getValues("password")).toBe("secret")
  })

  it("does not treat a throwing onSuccess as an API error", async () => {
    const { result } = setup(async () => "ok", {
      onSuccess: () => {
        throw new Error("router failed")
      },
    })
    await expect(submit(result)).rejects.toThrow("router failed")
    expect(result.current.errorMessage).toBeNull()
  })
})
