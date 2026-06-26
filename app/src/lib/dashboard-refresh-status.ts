export type DashboardRefreshJobState =
  | "queued"
  | "running"
  | "completed"
  | "failed";

export type DashboardRefreshStatus =
  | "idle"
  | "started"
  | "running"
  | "completed"
  | "failed"
  | "recently_completed"
  | "in_progress";

export interface DashboardRefreshJob {
  status?: DashboardRefreshJobState;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  error?: string;
}

export interface DerivedDashboardRefreshStatus {
  status: DashboardRefreshStatus;
  lastRefreshedAt?: string;
  lockedUntil?: string;
  error?: string;
}

export function deriveDashboardRefreshStatus({
  now,
  minRefreshIntervalMs,
  lastRefreshedAt,
  refreshLockedUntil,
  refreshJob,
}: {
  now: number;
  minRefreshIntervalMs: number;
  lastRefreshedAt?: string;
  refreshLockedUntil?: number;
  refreshJob?: DashboardRefreshJob;
}): DerivedDashboardRefreshStatus {
  const lastRefreshMs = lastRefreshedAt ? new Date(lastRefreshedAt).getTime() : 0;

  if (lastRefreshedAt && Number.isFinite(lastRefreshMs) && now - lastRefreshMs < minRefreshIntervalMs) {
    return {
      status: "recently_completed",
      lastRefreshedAt,
    };
  }

  if (refreshLockedUntil && refreshLockedUntil > now) {
    return {
      status: "running",
      lockedUntil: new Date(refreshLockedUntil).toISOString(),
      lastRefreshedAt,
    };
  }

  if (refreshJob?.status === "failed") {
    return {
      status: "failed",
      error: refreshJob.error || "Refresh failed",
      lastRefreshedAt,
    };
  }

  if (refreshJob?.status === "completed") {
    return {
      status: "completed",
      lastRefreshedAt,
    };
  }

  return {
    status: "idle",
    lastRefreshedAt,
  };
}
