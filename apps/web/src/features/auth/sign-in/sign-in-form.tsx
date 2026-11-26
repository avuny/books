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
  forgotPasswordLabel: string
}

type SignInFormProps = {
  copy: SignInCopy
  onSubmit: (values: SignInFormValues) => void
  onClickOnSignUpButton: () => void
  onClickOnForgotPasswordButton: () => void
  isPending: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
}

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function SignInForm({
  copy,
  onSubmit,
  onClickOnSignUpButton,
  onClickOnForgotPasswordButton,
  isPending,
  errorMessage,
}: SignInFormProps) {
  const form = useForm<SignInFormValues>({
    resolver: zodResolver(SignInBodySchema),
    defaultValues: { identifier: "", password: "" },
  })

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
        <InputField
          control={form.control}
          name="identifier"
          copy={copy.identifier}
          type="text"
          autoComplete="username"
          autoFocus
          disabled={isPending}
        />

        <InputField
          control={form.control}
          name="password"
          copy={copy.password}
          type="password"
          autoComplete="current-password"
          disabled={isPending}
          action={
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
              disabled={isPending}
              onClick={onClickOnForgotPasswordButton}
            >
              {copy.forgotPasswordLabel}
            </Button>
          }
        />

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
