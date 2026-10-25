import { MultiStepFlow } from "@workspace/ui/blocks/multi-step"
import { fill } from "./lib/api-error"
import { useSignUpFlow } from "./hooks/use-sign-up-flow"
import { useSendOtpStep } from "./hooks/use-send-otp-step"
import { useVerifyOtpStep } from "./hooks/use-verify-otp-step"
import {
  useCompleteRegistrationStep,
  type AuthResponse,
} from "./hooks/use-complete-registration-step"
import { SendOtpForm } from "./ui/send-otp-form"
import { VerifyOtpForm } from "./ui/verify-otp-form"
import { CompleteRegistrationForm } from "./ui/complete-registration-form"
import type {
  AppRouter,
  ErrorMessages,
  OtpChallenge,
  SignUpCopy,
} from "./types"

export type SignUpFlowProps = {
  router: AppRouter
  copy: SignUpCopy
  errorMessages: ErrorMessages
  /** Where to go after registration succeeds. */
  redirectTo: string
  /** Message shown on step one when the verification proof expires. */
  proofExpiredMessage: string
  /** Optional client-side cap on resends (the server enforces its own limits). */
  maxResends?: number
  /** Store the access token / hydrate the session here. */
  onAuthenticated?: (auth: AuthResponse) => void
  /** Handle successful authentication. */
  onSuccess?: (data: { data: AuthResponse }) => void
}

const SIGN_UP_STEPS = ["identifier", "verify", "register"] as const

export function SignUpFlow(props: SignUpFlowProps) {
  const flow = useSignUpFlow()
  const { state } = flow

  return (
    <MultiStepFlow
      steps={SIGN_UP_STEPS}
      current={state.step}
      formatLabel={(position) => fill(props.copy.stepLabel, position)}
      views={{
        identifier: () => (
          <IdentifierStep
            {...props}
            defaultIdentifier={state.identifier}
            notice={state.notice}
            onSent={flow.sent}
          />
        ),
        verify: () =>
          state.challenge ? (
            <VerifyStep
              {...props}
              identifier={state.identifier}
              challenge={state.challenge}
              resendCount={state.resendCount}
              onVerified={flow.verified}
              onResent={flow.resent}
              onChangeIdentifier={() => flow.restart()}
            />
          ) : null,
        register: () =>
          state.verificationToken ? (
            <RegisterStep
              {...props}
              identifier={state.identifier}
              verificationToken={state.verificationToken}
              onProofInvalid={() => flow.restart(props.proofExpiredMessage)}
            />
          ) : null,
      }}
    />
  )
}

function IdentifierStep(
  p: SignUpFlowProps & {
    defaultIdentifier: string
    notice: string | null
    onSent: (identifier: string, challenge: OtpChallenge) => void
  }
) {
  const step = useSendOtpStep({
    defaultIdentifier: p.defaultIdentifier,
    errorMessages: p.errorMessages,
    onSent: p.onSent,
  })
  return (
    <SendOtpForm
      form={step.form}
      onSubmit={step.onSubmit}
      isSubmitting={step.isSubmitting}
      errorMessage={step.errorMessage ?? p.notice}
      copy={p.copy.identifier}
    />
  )
}

function VerifyStep(
  p: SignUpFlowProps & {
    identifier: string
    challenge: OtpChallenge
    resendCount: number
    onVerified: (token: string) => void
    onResent: (challenge: OtpChallenge) => void
    onChangeIdentifier: () => void
  }
) {
  const step = useVerifyOtpStep({
    identifier: p.identifier,
    challenge: p.challenge,
    resendCount: p.resendCount,
    maxResends: p.maxResends,
    errorMessages: p.errorMessages,
    onVerified: p.onVerified,
    onResent: p.onResent,
  })
  return (
    <VerifyOtpForm
      form={step.form}
      onSubmit={step.onSubmit}
      isSubmitting={step.isSubmitting}
      isResending={step.isResending}
      errorMessage={step.errorMessage}
      identifier={p.identifier}
      secondsLeft={step.secondsLeft}
      canResend={step.canResend}
      locked={step.locked}
      resendCount={step.resendCount}
      maxResends={p.maxResends}
      onResend={() => void step.resend()}
      onChangeIdentifier={p.onChangeIdentifier}
      copy={p.copy.verify}
    />
  )
}

function RegisterStep(
  p: SignUpFlowProps & {
    identifier: string
    verificationToken: string
    onProofInvalid: () => void
  }
) {
  const step = useCompleteRegistrationStep({
    identifier: p.identifier,
    verificationToken: p.verificationToken,
    router: p.router,
    redirectTo: p.redirectTo,
    passwordMismatchMessage: p.copy.register.passwordMismatchMessage,
    errorMessages: p.errorMessages,
    onAuthenticated: p.onAuthenticated,
    onSuccess: p.onSuccess,
    onProofInvalid: p.onProofInvalid,
  })
  return (
    <CompleteRegistrationForm
      form={step.form}
      onSubmit={step.onSubmit}
      isSubmitting={step.isSubmitting}
      errorMessage={step.errorMessage}
      copy={p.copy.register}
    />
  )
}
