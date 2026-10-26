import { useCallback, useReducer } from "react"

import type { OtpChallenge } from "@/features/auth/types"

export type ForgotPasswordStep = "identifier" | "verify" | "reset"

export type ForgotPasswordFlowState = {
  step: ForgotPasswordStep
  identifier: string
  challenge: OtpChallenge | null
  /** Resends on the current identifier. The first send does not count. */
  resendCount: number
  verificationToken: string | null
  /** One-off, already localized message for the first step (e.g. proof expired). */
  notice: string | null
}

type Action =
  | { type: "sent"; identifier: string; challenge: OtpChallenge }
  | { type: "resent"; challenge: OtpChallenge }
  | { type: "verified"; verificationToken: string }
  | { type: "restart"; notice: string | null }

const INITIAL_STATE: ForgotPasswordFlowState = {
  step: "identifier",
  identifier: "",
  challenge: null,
  resendCount: 0,
  verificationToken: null,
  notice: null,
}

function reducer(
  state: ForgotPasswordFlowState,
  action: Action
): ForgotPasswordFlowState {
  switch (action.type) {
    case "sent":
      return {
        step: "verify",
        identifier: action.identifier,
        challenge: action.challenge,
        resendCount: 0,
        verificationToken: null,
        notice: null,
      }
    case "resent":
      return {
        ...state,
        challenge: action.challenge,
        resendCount: state.resendCount + 1,
      }
    case "verified":
      return {
        ...state,
        step: "reset",
        verificationToken: action.verificationToken,
      }
    case "restart":
      // Keeps the identifier so the first step comes back pre-filled.
      return {
        ...INITIAL_STATE,
        identifier: state.identifier,
        notice: action.notice,
      }
  }
}

// Owns the step state only. No UI, i18n or API knowledge.
export function useForgotPasswordFlow() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE)

  const sent = useCallback(
    (identifier: string, challenge: OtpChallenge) =>
      dispatch({ type: "sent", identifier, challenge }),
    []
  )
  const resent = useCallback(
    (challenge: OtpChallenge) => dispatch({ type: "resent", challenge }),
    []
  )
  const verified = useCallback(
    (verificationToken: string) =>
      dispatch({ type: "verified", verificationToken }),
    []
  )
  const restart = useCallback(
    (notice?: string) => dispatch({ type: "restart", notice: notice ?? null }),
    []
  )

  return { state, sent, resent, verified, restart }
}
