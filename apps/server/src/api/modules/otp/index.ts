// OTP module public API.
// Other modules import from here, never from subdirectories.
export { OtpErrorCode, otpErrorsHttpMap } from "./core/errors/index.js"
export {
  issueOtp,
  verifyOtp,
  consumeVerificationProof,
  type IssueOtpInput,
  type IssueOtpData,
  type VerifyOtpInput,
  type VerifyOtpData,
  type ConsumeVerificationProofInput,
} from "./shell/otp.service.js"
export type { VerificationTokenPayload } from "./core/otp.crypto.js"
export { otpRoutes } from "./hono-routes/index.js"
