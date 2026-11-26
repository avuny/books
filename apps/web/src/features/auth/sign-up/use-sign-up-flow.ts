import { useReducer } from "react"
import type { OtpChallenge } from "../types"

export type FlowState = {
  step: "identifier" | "verify" | "register"
  identifier: string
  challenge: OtpChallenge | null
  resendCount: number
  verificationToken: string | null
  /** One-off message shown on the first step after a restart. */
  notice: string | null
}

type Action =
  | { type: "sent"; identifier: string; challenge: OtpChallenge }
  | { type: "resent"; challenge: OtpChallenge }
  | { type: "verified"; token: string }
  | { type: "restart"; notice?: string }

const initial: FlowState = {
  step: "identifier",
  identifier: "",
  challenge: null,
  resendCount: 0,
  verificationToken: null,
  notice: null,
}

function reducer(state: FlowState, a: Action): FlowState {
  switch (a.type) {
    case "sent":
      return {
        ...initial,
        step: "verify",
        identifier: a.identifier,
        challenge: a.challenge,
      }
    case "resent":
      return {
        ...state,
        challenge: a.challenge,
        resendCount: state.resendCount + 1,
      }
    case "verified":
      return { ...state, step: "register", verificationToken: a.token }
    case "restart":
      return {
        ...initial,
        identifier: state.identifier,
        notice: a.notice ?? null,
      }
  }
}

export function useSignUpFlow() {
  const [state, dispatch] = useReducer(reducer, initial)
  return {
    state,
    sent: (identifier: string, challenge: OtpChallenge) =>
      dispatch({ type: "sent", identifier, challenge }),
    resent: (challenge: OtpChallenge) =>
      dispatch({ type: "resent", challenge }),
    verified: (token: string) => dispatch({ type: "verified", token }),
    restart: (notice?: string) => dispatch({ type: "restart", notice }),
  }
}
