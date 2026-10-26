import { useTranslation } from "react-i18next"
import type { AuthResponse } from "@avuny/contracts/user"

import { MultiStepFlow } from "@workspace/ui/blocks/multi-step"
import { fill } from "@/features/auth/lib/api-error"
import { CompleteSignUp } from "./steps/complete-sign-up"
import { SendOtp } from "./steps/send-otp"
import { VerifyOtp } from "./steps/verify-otp"
import { useSignUpFlow } from "./use-sign-up-flow"

type SignUpFlowProps = {
  /** Optional client-side cap on resends (the server enforces its own). */
  maxResends?: number
  onClickOnSignInButton?: () => void
  onSuccess?: (data: AuthResponse) => void
}

const SIGN_UP_STEPS = ["identifier", "verify", "register"] as const

// Composition only: owns the step state, wires each step container together.
export function SignUpFlow({
  maxResends,
  onClickOnSignInButton,
  onSuccess,
}: SignUpFlowProps) {
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
            onClickOnSignInButton={onClickOnSignInButton}
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
              onProofInvalid={() =>
                flow.restart(t("auth.signUp.proofExpired"))
              }
              onSuccess={onSuccess}
            />
          ) : null,
      }}
    />
  )
}
