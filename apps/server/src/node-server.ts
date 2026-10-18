import { serve } from "@hono/node-server"
import { app, config } from "./api/index.js"

serve(
  {
    fetch: app.fetch,
    port: 4000,
  },
  (info) => {
    console.log(`Server running on http://localhost:${info.port}`)
  }
)
