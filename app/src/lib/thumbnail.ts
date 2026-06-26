/**
 * Fire-and-forget thumbnail generation trigger.
 * Calls the Cloud Function to generate a PNG thumbnail for a dashboard.
 */
export function triggerThumbnailGeneration(dashboardId: string): void {
  const thumbnailUrl = process.env.THUMBNAIL_FUNCTION_URL;
  const thumbnailSecret = process.env.THUMBNAIL_SECRET;

  if (!thumbnailUrl || !thumbnailSecret) return;

  fetch(thumbnailUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Key": thumbnailSecret,
    },
    body: JSON.stringify({ dashboardId }),
  }).catch((err) => {
    console.warn(`[Thumbnail] Fire-and-forget failed for ${dashboardId}:`, err?.message);
  });
}
