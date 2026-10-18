import { createOpenAPIRouter } from "@avuny/hono"
import verifyOtpRoute from "./verify-otp.route.js"

export const otpRoutes = createOpenAPIRouter()

otpRoutes.route("/", verifyOtpRoute)
