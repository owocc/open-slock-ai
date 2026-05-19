import { expect, test } from "vite-plus/test";
import { client } from "../src/index.ts";

test("client configuration", () => {
  expect(client).toBeDefined();
  expect(client.getConfig).toBeTypeOf("function");
});
