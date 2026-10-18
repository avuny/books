// Users module public API.
// Other modules import from here, never from subdirectories.
export { UsersErrorCode, usersErrorsHttpMap } from "./core/errors/index.js"
export {
  classifyIdentifier,
  normalizeIdentifier,
  validateIdentifierForType,
  isEmailOrPhone,
  maskIdentifier,
  type IdentifierType,
} from "./core/identifier.rules.js"
export { validatePassword } from "./core/password.rules.js"
export {
  hashPassword,
  verifyPassword,
  verifyDummyPassword,
} from "./shell/users.crypto.js"
export {
  createUser,
  getUserProfile,
  updateUserProfile,
  type CreateUserInput,
  type UpdateProfileInput,
  type MeResponse,
} from "./shell/users.service.js"
export {
  findUserById,
  findUserByIdentifier,
  updateUserLastSignIn,
  updateUserLastActive,
  updateUserName,
} from "./shell/users.repo.js"
export { usersRoutes } from "./hono-routes/index.js"
