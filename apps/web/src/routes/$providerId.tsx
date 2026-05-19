import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { getEndpoints, mapRouteIdToEndpointId } from "../lib/server-config";

export const Route = createFileRoute("/$providerId")({
  beforeLoad: ({ params, location }) => {
    const providerId = params.providerId;
    const mappedId = mapRouteIdToEndpointId(providerId);
    const endpoints = getEndpoints();
    const matched = endpoints.find((e) => e.id === mappedId);

    if (matched) {
      if (typeof window !== "undefined") {
        try {
          const currentActive = localStorage.getItem("open_slock_active_endpoint_id");
          if (currentActive !== matched.id) {
            localStorage.setItem("open_slock_active_endpoint_id", matched.id);
            // 重新刷新页面以让实例使用最新的 API Base URL
            window.location.reload();
          }
        } catch (e) {
          console.error("Failed to set active server in localStorage", e);
        }
      }

      const normalizedPath = location.pathname.replace(/\/$/, "");
      if (normalizedPath === `/${providerId}`) {
        throw redirect({
          to: "/$providerId/login",
          params: { providerId },
        });
      }
    } else {
      // 找不到匹配的提供商，重定向到主页选择器
      throw redirect({ to: "/" });
    }
  },
  component: () => <Outlet />,
});
