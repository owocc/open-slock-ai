import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: "./server",
  preset: "bun",
  features: {
    websocket: true,
  },
});
