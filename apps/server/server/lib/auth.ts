import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";
import { db } from "../db/index";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },

  plugins: [
    openAPI({
      disableDefaultReference: true,
    }),
  ],
  database: drizzleAdapter(db, {
    provider: "pg",
  }),

  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",

  // BFF 转发客户端请求时，会透传 "Origin: http://localhost:3001" 到 Core API
  // 必须在此将前端宿主 Host 加为受信任源，防止 Better Auth 服务端触发 CSRF 安全防护阻断登录
  trustedOrigins: ["http://localhost:3001", ...(process.env.TRUSTED_ORIGINS?.split(",") || [])],
});
