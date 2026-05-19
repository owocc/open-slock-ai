import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "http://localhost:3000/api/openapi.json",
  output: "src/client",
  plugins: [
    {
      name: "@hey-api/client-fetch",
      exportFromIndex: true,
    },
  ],
});
