import { describe, expect, it } from "vitest";

import { getFavoriteDashboards } from "@/lib/home-dashboard-filters";
import type { Dashboard } from "@/lib/types";
process.env.ALLOWED_AUTH_DOMAIN = "example.com";
process.env.STORAGE_BUCKET_NAME = "test-bucket";

function dashboard(id: string, createdBy: string): Dashboard {
  return {
    id,
    title: id,
    description: "",
    category: "Other",
    visibility: "private",
    createdBy,
    createdByName: createdBy,
    createdAt: null,
    updatedAt: null,
    archivedAt: null,
    archivedBy: null,
    storagePath: "",
    publicUrl: "",
  } as unknown as Dashboard;
}

describe("getFavoriteDashboards", () => {
  it("returns favorited own and shared dashboards from the visible list", () => {
    const dashboards = [
      dashboard("own-favorite", "current-user"),
      dashboard("shared-favorite", "other-user"),
      dashboard("not-favorite", "current-user"),
    ];

    expect(
      getFavoriteDashboards(
        dashboards,
        new Set(["own-favorite", "shared-favorite"])
      ).map((item) => item.id)
    ).toEqual(["own-favorite", "shared-favorite"]);
  });

  it("does not return favorite ids that are not in the accessible dashboard list", () => {
    expect(
      getFavoriteDashboards(
        [dashboard("visible-favorite", "current-user")],
        new Set(["visible-favorite", "hidden-favorite"])
      ).map((item) => item.id)
    ).toEqual(["visible-favorite"]);
  });
});
