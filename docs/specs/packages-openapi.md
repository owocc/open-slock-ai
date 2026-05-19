# OpenAPI 规范

## 概述

`openapi` 软件包（`packages/openapi`）的主要职责是：通过读取后端服务所暴露出来的 OpenAPI 规约定义，基于 `@hey-api/openapi-ts` 全自动地生成面向后端 API 强类型的客户端库（TypeScript 源码及相关接口契约），以供大仓（Monorepo）中的其他模块（例如前端 web、cli 等）直接调用，极大地降低服务联调成本。

为了支撑闪电般敏捷的本地集成和开发，此软件包被设计为了 **单源头直出且免去构建** 的架构模式。引用该软件包的任何模块都直接通过大仓的 Workspace 映射读取 `src/index.ts` 及其依赖的源码。

## 接口

该软件包导出的主要接口契约与通用规范主要包含：

```ts
// 默认配置化的 HTTP 请求处理客户端
export const client: Client;

// 常见 API 请求函数签名（此处仅作为自动生成的样例和说明形式）

// 注册新的 Agent
export function postApiAgentsRegister(options: {
  body: PostApiAgentsRegisterData;
}): Promise<PostApiAgentsRegisterResponse>;

// 获取服务器列表
export function getApiServers(options?: {
  query?: GetApiServersData;
}): Promise<GetApiServersResponses[200]>;
```

## 行为

### 代码生成

- **成功路径**：本地运行 HTTP 后端服务后（提供端口 `:3000`），在此包目录下调用终端脚本生成命令：
  ```bash
  bun run openapi:generate
  ```
  此时将自动向本地服务 `http://localhost:3000/api/openapi.json` 下载 OpenAPI Spec 内容，并在 `packages/openapi/src/client` 一键生成全部对应的 `types.gen.ts`, `sdk.gen.ts`, `client.gen.ts` 文件。

### 免构建规则与导出模式

- 本包已将 `package.json` 中的 `exports` 完全定位在 `./src/index.ts` 本身。
- 本包无需运行任何诸如 `vite pack` 或 `vp pack` 的打包封装过程，开发时在大仓中完全零延时、开箱即用地反射最新生成的源码文件。
- 打包和编译检查（`packages/openapi/package.json` 的 `build` 脚本）已简化成了类型检查（`vp check`）。

## 示例

在大仓中其他子项目包（如前端/客户端）调用时的常规用例：

```ts
import { client, postApiAgentsRegister, getApiServers } from "openapi";

// 运行时修改设置 Client
client.setConfig({
  baseUrl: "http://localhost:3000",
  headers: {
    Authorization: "Bearer sk_slock_xxxxxx",
  },
});

// 使用强类型的 API 方法发送 Fetch 请求
const servers = await getApiServers();
console.log(servers);
```

## 不变量

- **自动生成数据同步性**：`src/client/` 文件夹下生成的所有 API 和 Types 逻辑只由 `@hey-api/openapi-ts` 命令驱动，任何人工的手工更改在下次进行 client 生成时会被全部覆盖。如需配置自定义拦截器或定制化配置，一律应当在运行时通过 `client.setConfig` 或 `client.interceptors` 配置接口达成。
- **类型安全性不变量**：在每次执行 `openapi:generate` 生成接口规则后，在根目录下所运行的 `vp check --fix` 逻辑不能产生任何关于 `@typescript-eslint` 以及类型校验的编译报错。

## 变更记录

- 2026-05-20：初稿。增加基于 `@hey-api/openapi-ts` 自动生成的 client 模式以及单源码免构建直接导出的使用规范。
