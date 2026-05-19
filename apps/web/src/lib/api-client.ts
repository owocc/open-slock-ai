import { client } from "openapi";

client.setConfig({
  baseUrl: "http://localhost:3000",
  credentials: "include",
});

export { client };
