import { defineConfig } from "orval"

const target = "./src/api"

export default defineConfig({
  mobile: {
    input: "../server/openapi/openapi.json",
    output: {
      target: `${target}/index.ts`,
      schemas: `${target}/model`,
      client: "react-query",
      mode: "single",
      override: {
        mutator: {
          path: "./src/mutator/custom-instance.ts",
          name: "customInstance",
        },
        // query: {
        //   useInfinite: true,
        //   useInfiniteQueryParam: "page",
        // },
      },
    },
  },
})
