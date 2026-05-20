import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/$providerId/$serverSlug/")({
  component: DashboardIndex,
});

function DashboardIndex() {
  return (
    <div className="flex-1 flex items-center justify-center p-6 text-muted-soft font-sans select-none">
      <div className="text-center space-y-2 max-w-sm border border-dashed border-hairline p-6 rounded-lg bg-surface">
        <h3 className="text-body-strong text-ink font-semibold">欢迎来到工作空间</h3>
        <p className="text-xs text-muted leading-relaxed">
          选择左侧的一个频道开始进行团队交流，或点击“+”按钮创建一个新频道。
        </p>
      </div>
    </div>
  );
}
