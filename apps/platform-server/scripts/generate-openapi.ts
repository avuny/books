import { writeFileSync, mkdirSync } from "fs"
import { dirname } from "path"

const { app } = await import("../src/index.js")
const outputPath = "./openapi/openapi.json"

mkdirSync(dirname(outputPath), { recursive: true })

const spec = app.getOpenAPIDocument({
  openapi: "3.0.0",
  info: {
    title: "Avuny Platform API",
    version: "0.1.0",
  },
})

writeFileSync(outputPath, JSON.stringify(spec, null, 2), "utf-8")

console.log("OpenAPI spec generated at", outputPath)
