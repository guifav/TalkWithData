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
npm ci && npm run build && npm run package:release
gcloud functions deploy generateThumbnail \
  --source .release \
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

The packaging step copies only tracked function sources plus the canonical
project notices and a generated license bundle for the installed dependency
graph. The bundle also verifies the checksums of the Chromium, SwiftShader,
Open Sans, and Amazon Linux payloads and includes their reviewed notices. Do not
deploy directly from the working directory.

After deploying, set the function URL on Cloud Run:

```bash
gcloud run services update <cloud-run-service> \
  --region southamerica-east1 \
  --project <firebase-project-id> \
  --update-env-vars THUMBNAIL_FUNCTION_URL=<function-url>,THUMBNAIL_SECRET=<secret>
```
