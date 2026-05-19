import { HeadContent, Link, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { Button } from "#/components/ui/button";
import "../lib/api-client";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "TanStack Start Starter",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFoundComponent,
});

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas p-4 text-center font-sans">
      <div className="w-full max-w-md space-y-6 animate-in fade-in duration-200">
        {/* 精致的 404 状态条 */}
        <div className="inline-flex items-center gap-1.5 rounded-pill border border-hairline bg-surface px-3 py-1 text-xs font-mono font-medium text-muted shadow-soft">
          <span>STATUS</span>
          <span className="h-3 w-px bg-hairline-strong" />
          <span className="text-ink">404 NOT FOUND</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl text-ink font-semibold track-tight">页面未找到</h1>
          <p className="text-sm text-muted text-balance max-w-sm mx-auto leading-relaxed">
            您访问的页面不存在，已被移除，或者您输入了错误的 URL 地址。
          </p>
        </div>

        <div>
          <Button asChild>
            <Link to="/">返回主页</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: "bottom-right",
          }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  );
}
