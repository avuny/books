import { defineConfig } from "orval"

const target = "./src/api"

export default defineConfig({
  platform: {
    input: "../platform-server/openapi/openapi.json",
    output: {
      target: `${target}/index.ts`,
      schemas: `${target}/model`,
      client: "react-query",
      httpClient: "axios",
      mode: "single",
      override: {
        mutator: {
          path: "./src/mutator/custom-instance.ts",
          name: "customInstance",
        },
      },
    },
  },
})
