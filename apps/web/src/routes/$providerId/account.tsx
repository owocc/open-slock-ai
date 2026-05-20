import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/$providerId/account")({
  component: () => <div className="p-8">Account Center (Placeholder)</div>,
});
