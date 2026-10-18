// Auth module public API.
// Other modules import from here, never from subdirectories.
export {
  requireAuth,
  type AuthContextEnv,
} from "./shell/require-auth.middleware.js"
export { AuthErrorCode, authErrorsHttpMap } from "./core/errors/index.js"
export {
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  type AccessTokenPayload,
} from "./core/auth.crypto.js"
export {
  signUp,
  signIn,
  refresh,
  signOut,
  changePassword,
  resetPassword,
  signOutAll,
  listSessions,
  revokeUserSession,
  type SignUpInput,
  type SignInInput,
  type RefreshInput,
  type SignOutInput,
  type ChangePasswordInput,
  type ResetPasswordInput,
  type ResetPasswordErrorCode,
  type SignOutAllInput,
  type RevokeUserSessionInput,
  type AuthResponse,
  type RefreshResponse,
} from "./shell/auth.service.js"
export { authRoutes } from "./hono-routes/index.js"
