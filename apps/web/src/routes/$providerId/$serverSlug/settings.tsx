import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/$providerId/$serverSlug/settings")({
  component: () => <div className="p-8">Workspace Settings (Placeholder)</div>,
});
