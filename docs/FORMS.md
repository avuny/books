# Forms

How to build forms in the web app. Reference implementations: `features/auth/sign-in` (single form) and `features/auth/sign-up` (multi-step flow). Read them before writing a new form.

## Architecture

Every form has three layers. Data flows down as props, events flow up as callbacks.

| Layer | File | Owns | Must not know |
| --- | --- | --- | --- |
| Form | `<name>-form.tsx` | `useForm` + `zodResolver`, layout, fields | i18n, API, auth, navigation |
| Container | `<name>.tsx` | `useTranslation`, mutation hook, `copy`, server errors | form markup, navigation |
| Route | `routes/**` | `createFileRoute`, `useNavigate`, callbacks | strings, API |

Rules:

- Take schemas from `@avuny/contracts/<domain>` (e.g. `/user`) and derive types with `z.infer`. Never redefine a request shape locally.
- Build forms from `@workspace/ui/blocks/form` (`FormShell`, `InputField`, `OtpField`, `SubmitButton`). Do not hand-roll fields or submit buttons.
- Style with theme tokens only (`text-muted-foreground`, never `text-gray-500`).
- Never hard-code user-facing text. Strings are locale keys read with `t()` in the container. Follow [COPY.md](COPY.md) when you add or change copy.
- Test a form by rendering it with literal `copy` and mock callbacks. It needs no router, query or i18n provider.

Helpers in `features/auth/lib/api-error`:

- `parseApiError(e)`: thrown error → `{ code, message }`.
- `unwrap<T>(res)`: response body.
- `fill(template, values)`: injects values into a translated template, e.g. `fill(t(key), { identifier })`.

## Single form

### Files

Place a form at `features/<feature>/<form-name>/`.

```
features/auth/sign-in/
  sign-in-form.tsx   # exports SignInForm, SignInCopy, SignInFormValues
  sign-in.tsx        # exports SignIn
  index.ts           # export { SignIn } from "./sign-in"
```

`index.ts` exports the container only. Re-export it from the feature barrel (`features/auth/index.ts`). Routes import from the barrel (`@/features/auth`), never from inner files.

### Form props

| Prop | Type | Purpose |
| --- | --- | --- |
| `copy` | `<Name>Copy` | Every string the form shows |
| `onSubmit` | `(values) => void` | Called only after validation passes |
| `isPending` | `boolean` | Disables fields and shows the submit loading state |
| `errorMessage` | `string?` | Already localized. Shown in the form-level alert |
| `onClickOn<X>Button` | `() => void` | Optional secondary action (e.g. "Sign up" link). The route decides where it goes |

### Form: `sign-in-form.tsx`

```tsx
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import type { z } from "@avuny/zod"
import { SignInBodySchema } from "@avuny/contracts/user"

import { Button } from "@workspace/ui/components/button"
import { FormShell, InputField, SubmitButton } from "@workspace/ui/blocks/form"
import type { FieldCopy } from "@workspace/ui/blocks/types"

export type SignInFormValues = z.infer<typeof SignInBodySchema>

/** Localized strings for this form. Built and injected by the container. */
export type SignInCopy = {
  title: string
  description: string
  identifier: FieldCopy
  password: FieldCopy
  submitLabel: string
  submittingLabel: string
  signUpPrompt: string
  signUpLabel: string
}

type SignInFormProps = {
  copy: SignInCopy
  onSubmit: (values: SignInFormValues) => void
  onClickOnSignUpButton: () => void
  isPending: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
}

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function SignInForm({
  copy,
  onSubmit,
  onClickOnSignUpButton,
  isPending,
  errorMessage,
}: SignInFormProps) {
  const form = useForm<SignInFormValues>({
    resolver: zodResolver(SignInBodySchema),
    defaultValues: { identifier: "", password: "" },
  })

  const fields = [
    {
      name: "identifier",
      copy: copy.identifier,
      type: "text",
      autoComplete: "username",
    },
    {
      name: "password",
      copy: copy.password,
      type: "password",
      autoComplete: "current-password",
    },
  ] as const

  return (
    <FormShell
      title={copy.title}
      description={copy.description}
      errorMessage={errorMessage}
    >
      <form
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
        noValidate
        className="space-y-6"
      >
        {fields.map((f, i) => (
          <InputField
            key={f.name}
            control={form.control}
            name={f.name}
            copy={f.copy}
            type={f.type}
            autoComplete={f.autoComplete}
            autoFocus={i === 0}
            disabled={isPending}
          />
        ))}

        <SubmitButton
          className="w-full"
          loading={isPending}
          label={copy.submitLabel}
          loadingLabel={copy.submittingLabel}
        />
      </form>

      <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
        <span>{copy.signUpPrompt}</span>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="px-0"
          disabled={isPending}
          onClick={onClickOnSignUpButton}
        >
          {copy.signUpLabel}
        </Button>
      </div>
    </FormShell>
  )
}
```

### Container: `sign-in.tsx`

```tsx
import { useState } from "react"
import { useTranslation } from "react-i18next"
import type { AuthResponse } from "@avuny/contracts"

import { useSignIn } from "@/api"
import { useAuthSuccessHandler } from "@/features/auth"
import { parseApiError } from "../lib/api-error"
import { SignInForm, type SignInFormValues } from "./sign-in-form"

type SignInProps = {
  /** Where the "Sign up" link goes. The route decides how to navigate. */
  onClickOnSignUpButton: () => void
  onSuccess?: (data: AuthResponse) => void
}

// Composition only: strings + API behavior wired into the pure form.
export function SignIn({ onClickOnSignUpButton, onSuccess }: SignInProps) {
  const handleAuthSuccess = useAuthSuccessHandler()
  const { t } = useTranslation("user")
  const signInMutation = useSignIn()
  const [serverError, setServerError] = useState<string | null>(null)

  const copy = {
    title: t("auth.signIn.title"),
    description: t("auth.signIn.description"),
    identifier: {
      label: t("auth.signIn.identifier.label"),
      placeholder: t("auth.signIn.identifier.placeholder"),
    },
    password: {
      label: t("auth.signIn.password.label"),
      placeholder: t("auth.signIn.password.placeholder"),
    },
    submitLabel: t("auth.signIn.submitLabel"),
    submittingLabel: t("auth.signIn.submittingLabel"),
    signUpPrompt: t("auth.signIn.signUpPrompt"),
    signUpLabel: t("auth.signIn.signUpLabel"),
  }

  // Called only when Zod validation passes.
  const handleSubmit = async (values: SignInFormValues) => {
    setServerError(null)
    try {
      const data = await signInMutation.mutateAsync({ data: values })
      handleAuthSuccess(data)
      onSuccess?.(data.data)
    } catch (e) {
      setServerError(parseApiError(e).message || null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <SignInForm
        copy={copy}
        onSubmit={handleSubmit}
        onClickOnSignUpButton={onClickOnSignUpButton}
        isPending={signInMutation.isPending}
        errorMessage={serverError}
      />
    </div>
  )
}
```

- Translation keys are `auth.<form>.<field>` in the `user` namespace. Field copy is `{ label, placeholder }`. To add or change copy, follow [COPY.md](COPY.md): add each key to every locale file, then verify.
- Clear the server error at the start of every submit. On failure, show `parseApiError(e).message || null`.
- On success call `handleAuthSuccess(data)`, then `onSuccess`. The container never navigates.
- Wrap the form in `mx-auto w-full max-w-sm`.

### Route: `routes/auth/sign-in.tsx`

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { SignIn } from "@/features/auth"

export const Route = createFileRoute("/auth/sign-in")({ component: SignInPage })

function SignInPage() {
  const navigate = useNavigate()

  return (
    <SignIn
      onClickOnSignUpButton={() => navigate({ to: "/auth/sign-up" })}
      onSuccess={() => navigate({ to: "/" })}
    />
  )
}
```

### Patterns

Snippets omit imports.

**Derived schema.** For extra fields or cross-field rules, build the schema in the form file with a `createSchema()` function and memoize it. Localized messages come from `copy`. The container sends only the API fields.

```tsx
function createSchema(mismatchMessage: string) {
  return SignUpBodySchema.pick({ name: true, password: true })
    .extend({ confirmPassword: z.string() })
    .superRefine((v, ctx) => {
      if (v.password !== v.confirmPassword) {
        ctx.addIssue({
          code: "custom",
          path: ["confirmPassword"],
          message: mismatchMessage,
        })
      }
    })
}

export type CompleteSignUpFormValues = z.infer<ReturnType<typeof createSchema>>

// inside the form component
const schema = useMemo(
  () => createSchema(copy.passwordMismatchMessage),
  [copy.passwordMismatchMessage]
)
const form = useForm<CompleteSignUpFormValues>({
  resolver: zodResolver(schema),
  defaultValues: { name: "", password: "", confirmPassword: "" },
})
```

**Field-level server error.** Add an optional `<field>Error?: string | null` prop and apply it with `setError`. The container sets it for specific error codes and sends every other error to `errorMessage`. Compare `parsed.code` with contract enums (`AuthErrorCode`, `OtpErrorCode`), never with message text.

```tsx
// form
const { setError } = form
useEffect(() => {
  if (passwordError) setError("password", { message: passwordError })
}, [passwordError, setError])

// container, catch block
const parsed = parseApiError(e)
if (parsed.code === AuthErrorCode.WEAK_PASSWORD) {
  setPasswordError(parsed.message || null)
  return
}
setServerError(parsed.message || null)
```

**Resetting from outside.** Bump a `key` on the form from the container to remount it. This clears the values and refocuses the first field, e.g. after a rejected OTP code.

```tsx
const [formKey, setFormKey] = useState(0)
// on failure: setFormKey((k) => k + 1)
return <VerifyOtpForm key={formKey} {...props} />
```

**Derived UI state.** Compute resend countdowns, lock-outs and limits in the container (`useCountdown`, `locked`, `canResend`) and pass plain props. The form renders them; it never runs timers or policy.

## Multi-step form

Use it when each step calls the API and the next step needs the result (sign-up: send OTP → verify OTP → complete registration). Otherwise use a single form.

Each step is a complete single form. Everything above applies unless stated below.

### Files

```
features/auth/sign-up/
  steps/
    send-otp/
      send-otp-form.tsx
      send-otp.tsx
      index.ts
    verify-otp/
      verify-otp-form.tsx
      verify-otp.tsx
      use-countdown.ts       # helper used by this step only
      index.ts
    complete-sign-up/
      complete-sign-up-form.tsx
      complete-sign-up.tsx
      index.ts
  use-sign-up-flow.ts        # step state (reducer)
  sign-up-flow.tsx           # composes the steps
  index.ts                   # export { SignUpFlow } from "./sign-up-flow"
```

### How to build one

**1. One step per API call.** Build each step like a single form, with these differences:

- Data from earlier steps arrives as props (`identifier`, `challenge`, `verificationToken`).
- Results leave through callbacks named after the event (`onSent`, `onVerified`, `onResent`). A step never touches flow state or another step.
- A failure that invalidates earlier steps calls a callback (`onProofInvalid`). The flow decides what happens next.
- The container renders the form only. `MultiStepFlow` owns the surrounding layout.

**2. Keep flow state in a reducer** (`use-sign-up-flow.ts`). State holds the current `step`, the data carried between steps and a one-off `notice`. Carried data lives here, never in react-hook-form: each step owns its own `useForm`.

```ts
export type FlowState = {
  step: "identifier" | "verify" | "register"
  identifier: string
  challenge: OtpChallenge | null
  resendCount: number
  verificationToken: string | null
  /** One-off message shown on the first step after a restart. */
  notice: string | null
}
```

Name actions after what happened. The hook returns `{ state, sent, resent, verified, restart }`.

| Action | Effect |
| --- | --- |
| `sent(identifier, challenge)` | Go to `verify`, store both, reset everything else |
| `resent(challenge)` | Store the new challenge, `resendCount + 1` |
| `verified(token)` | Go to `register`, store the token |
| `restart(notice?)` | Go to `identifier`, keep the identifier for prefill, set `notice` |

**3. Compose the steps** in `sign-up-flow.tsx`.

```tsx
type SignUpFlowProps = {
  /** Optional client-side cap on resends (the server enforces its own). */
  maxResends?: number
  onSuccess?: (data: AuthResponse) => void
}

const SIGN_UP_STEPS = ["identifier", "verify", "register"] as const

// Composition only: owns the step state, wires each step container together.
export function SignUpFlow({ maxResends, onSuccess }: SignUpFlowProps) {
  const { t } = useTranslation("user")
  const flow = useSignUpFlow()
  const { state } = flow

  return (
    <MultiStepFlow
      steps={SIGN_UP_STEPS}
      current={state.step}
      formatLabel={(position) => fill(t("auth.signUp.stepLabel"), position)}
      views={{
        identifier: () => (
          <SendOtp
            defaultIdentifier={state.identifier}
            notice={state.notice}
            onSent={flow.sent}
          />
        ),
        verify: () =>
          state.challenge ? (
            <VerifyOtp
              identifier={state.identifier}
              challenge={state.challenge}
              resendCount={state.resendCount}
              maxResends={maxResends}
              onVerified={flow.verified}
              onResent={flow.resent}
              onChangeIdentifier={() => flow.restart()}
            />
          ) : null,
        register: () =>
          state.verificationToken ? (
            <CompleteSignUp
              identifier={state.identifier}
              verificationToken={state.verificationToken}
              onProofInvalid={() => flow.restart(t("auth.signUp.proofExpired"))}
              onSuccess={onSuccess}
            />
          ) : null,
      }}
    />
  )
}
```

- Guard every step that needs carried data (`state.challenge ? <Step /> : null`).
- Forward `onSuccess` and options (`maxResends`) to the steps that use them.
- Translate flow-level strings here: `auth.signUp.stepLabel` and `auth.signUp.proofExpired`. Step strings use `auth.signUp.<step>.<field>` with the step in camelCase (e.g. `auth.signUp.verifyOtp.title`).

**4. Route.** Identical to the single-form route: navigate in `onSuccess`.

## Before finishing

- Forms import none of `react-i18next`, `@/api` or `@tanstack/react-router`. Containers don't import `@tanstack/react-router`.
- Every `t()` key exists in every locale file of the module. Run the check in [COPY.md](COPY.md#verify-keys).
- Typecheck and lint pass.