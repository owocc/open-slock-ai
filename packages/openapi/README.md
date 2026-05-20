# openapi

API 客户端包，基于 OpenAPI 规范自动生成。

## 生成 API 客户端

确保后端服务运行在 `http://localhost:3000`，然后执行：

```bash
bun run --cwd packages/openapi openapi:generate
```

这会从 `http://localhost:3000/api/openapi.json` 拉取最新的 OpenAPI 规范，并重新生成 `src/client/` 下的类型定义和 SDK 函数。

## 前置条件

- 本地后端服务必须处于运行状态（开放 API 端口 `3000`）
- 生成的代码由 `openapi-ts.config.ts` 配置
