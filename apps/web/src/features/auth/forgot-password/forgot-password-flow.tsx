import { useTranslation } from "react-i18next"

import { MultiStepFlow } from "@workspace/ui/blocks/multi-step"
import { fill } from "@/features/auth/lib/api-error"
import { ResetPassword } from "./steps/reset-password"
import { SendOtp } from "./steps/send-otp"
import { VerifyOtp } from "./steps/verify-otp"
import { useForgotPasswordFlow } from "./use-forgot-password-flow"

type ForgotPasswordFlowProps = {
  /** Optional client-side cap on resends (the server enforces its own). */
  maxResends?: number
  /** Password changed. The user is not signed in yet: send them to sign-in. */
  onSuccess?: () => void
}

const FORGOT_PASSWORD_STEPS = ["identifier", "verify", "reset"] as const

// Composition only: owns the step state, wires each step container together.
export function ForgotPasswordFlow({
  maxResends,
  onSuccess,
}: ForgotPasswordFlowProps) {
  const { t } = useTranslation("user")
  const flow = useForgotPasswordFlow()
  const { state } = flow

  return (
    <MultiStepFlow
      steps={FORGOT_PASSWORD_STEPS}
      current={state.step}
      formatLabel={(position) =>
        fill(t("auth.forgotPassword.stepLabel"), position)
      }
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
        reset: () =>
          state.verificationToken ? (
            <ResetPassword
              verificationToken={state.verificationToken}
              onProofInvalid={() =>
                flow.restart(t("auth.forgotPassword.proofExpired"))
              }
              onSuccess={onSuccess}
            />
          ) : null,
      }}
    />
  )
}
