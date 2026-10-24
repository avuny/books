import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import type { ComponentProps } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SignInForm, type SignInCopy } from "../sign-in-form"

const copy: SignInCopy = {
  title: "Sign in to Avuny",
  description: "Welcome back",
  identifier: { label: "Email or username", placeholder: "you@example.com" },
  password: { label: "Password", placeholder: "Your password" },
  submitLabel: "Sign in",
  submittingLabel: "Signing in…",
  signUpPrompt: "No account?",
  signUpLabel: "Create one",
}

type Overrides = Partial<
  Pick<ComponentProps<typeof SignInForm>, "isPending" | "errorMessage">
>

function renderForm(overrides: Overrides = {}) {
  const onSubmit = vi.fn()
  const onSignUp = vi.fn()
  render(
    <SignInForm
      copy={copy}
      onSubmit={onSubmit}
      onClickOnSignUpButton={onSignUp}
      isPending={false}
      {...overrides}
    />
  )
  return { onSubmit, onSignUp }
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

afterEach(cleanup)

describe("SignInForm", () => {
  it("submits the entered values", async () => {
    const { onSubmit } = renderForm()
    type(copy.identifier.label, "ada@example.com")
    type(copy.password.label, "Passw0rd!123")
    fireEvent.click(screen.getByRole("button", { name: copy.submitLabel }))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        identifier: "ada@example.com",
        password: "Passw0rd!123",
      })
    )
  })

  it("does not submit an empty form and marks the fields invalid", async () => {
    const { onSubmit } = renderForm()
    fireEvent.click(screen.getByRole("button", { name: copy.submitLabel }))

    await waitFor(() =>
      expect(
        screen
          .getByLabelText(copy.identifier.label)
          .getAttribute("aria-invalid")
      ).toBe("true")
    )
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("renders the injected strings", () => {
    renderForm()
    expect(screen.getByText(copy.title)).toBeTruthy()
    expect(screen.getByText(copy.description)).toBeTruthy()
  })

  it("shows the error message in an alert", () => {
    renderForm({ errorMessage: "Wrong credentials" })
    expect(screen.getByRole("alert").textContent).toContain("Wrong credentials")
  })

  it("disables the inputs while pending", () => {
    renderForm({ isPending: true })
    expect(
      (screen.getByLabelText(copy.identifier.label) as HTMLInputElement)
        .disabled
    ).toBe(true)
    expect(
      (screen.getByLabelText(copy.password.label) as HTMLInputElement).disabled
    ).toBe(true)
  })

  it("calls onSignUp", () => {
    const { onSignUp } = renderForm()
    fireEvent.click(screen.getByRole("button", { name: copy.signUpLabel }))
    expect(onSignUp).toHaveBeenCalledOnce()
  })
})
