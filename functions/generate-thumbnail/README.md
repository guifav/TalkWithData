# generate-thumbnail

Cloud Function that generates PNG thumbnails for Talk With Data dashboards using Puppeteer.

## How it works

1. Receives a `dashboardId` via HTTP POST
2. Reads the dashboard HTML from GCS
3. Renders it in headless Chrome (1280×720)
4. Takes a screenshot and uploads it to `thumbnails/{dashboardId}.png` in GCS
5. Updates the Firestore doc with the thumbnail URL

## Auth

The function checks `X-Internal-Key` header against the `THUMBNAIL_SECRET` env var.
The same secret must be configured on the Cloud Run app.

Successful authenticated requests emit redacted JSON lifecycle events. The function accepts a safe `X-Request-Id`, generates one when absent or invalid, and returns it in the response. See [Operational Observability](../../docs/OBSERVABILITY.md).

## Deploy

```bash
cd functions/generate-thumbnail
npm install && npm run build
gcloud functions deploy generateThumbnail \
  --gen2 \
  --runtime nodejs22 \
  --trigger-http \
  --allow-unauthenticated \
  --region southamerica-east1 \
  --memory 1GiB \
  --timeout 60s \
  --project <firebase-project-id> \
  --set-env-vars THUMBNAIL_SECRET=<secret>,STORAGE_BUCKET_NAME=<storage-bucket>
```

After deploying, set the function URL on Cloud Run:

```bash
gcloud run services update <cloud-run-service> \
  --region southamerica-east1 \
  --project <firebase-project-id> \
  --update-env-vars THUMBNAIL_FUNCTION_URL=<function-url>,THUMBNAIL_SECRET=<secret>
```
