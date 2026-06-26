import type { DashboardRefreshStatus } from "@/lib/dashboard-refresh-status";

export function shouldPollDashboardRefresh(status: DashboardRefreshStatus): boolean {
  return status === "started" || status === "running" || status === "in_progress";
}
