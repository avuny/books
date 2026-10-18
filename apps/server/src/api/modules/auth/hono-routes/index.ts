import { createOpenAPIRouter } from "@avuny/hono"
import signUpSendOtpRoute from "./send-otp.route.js"
import signUpRoute from "./sign-up.route.js"
import signInRoute from "./sign-in.route.js"
import refreshRoute from "./refresh.route.js"
import signOutRoute from "./sign-out.route.js"
import passwordRoute from "./password.route.js"
import signOutAllRoute from "./sign-out-all.route.js"
import sessionsRoute from "./sessions.route.js"
import forgotPasswordSendOtpRoute from "./forgot-password-send-otp.route.js"
import forgotPasswordResetRoute from "./forgot-password-reset.route.js"

export const authRoutes = createOpenAPIRouter()

authRoutes.route("/", signUpSendOtpRoute)
authRoutes.route("/", signUpRoute)
authRoutes.route("/", signInRoute)
authRoutes.route("/", refreshRoute)
authRoutes.route("/", signOutRoute)
authRoutes.route("/", passwordRoute)
authRoutes.route("/", signOutAllRoute)
authRoutes.route("/", sessionsRoute)
authRoutes.route("/", forgotPasswordSendOtpRoute)
authRoutes.route("/", forgotPasswordResetRoute)
