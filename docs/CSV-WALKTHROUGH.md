# Governed CSV walkthrough

This walkthrough reproduces the CSV data source behavior implemented by Talk
With Data. It uses only neutral `example.com` identities and synthetic values.

## What this demonstrates

- A superadmin inspects a CSV in Google Cloud Storage before saving a source.
- Source grants decide who may query the source.
- The owner column independently limits each viewer to their own rows.
- DuckDB exposes a filtered, read-only view and hides the owner column.
- Invalid configuration and unavailable storage fail closed.

## 1. Verify the behavior from a clean clone

Requirements: Git, Node.js 22 or newer, and npm.

```bash
git clone https://github.com/guifav/TalkWithData.git
cd TalkWithData/app
npm ci
npm test -- src/lib/__tests__/data-sources-access.test.ts \
  src/lib/__tests__/duckdb-engine.test.ts \
  src/lib/__tests__/data-sources-inspect-headers.test.ts \
  src/lib/__tests__/data-sources-admin.test.ts \
  src/lib/__tests__/query.test.ts
```

Expected result: Vitest reports `5 passed` test files and `77 passed` tests. The
tests exercise grants, per-viewer row scope, header inspection, source creation,
read-only SQL enforcement, row limits, and fail-closed errors. These focused
tests do not require Firebase, PostgreSQL, or GCP credentials.

Inspect the demo fixture:

```bash
sed -n '1,4p' e2e/fixtures/neutral-sales.csv
```

Expected output:

```csv
owner_email,region,revenue
owner@example.com,North,120
viewer@example.com,South,80
```

The `example.com` addresses are reserved examples. Replace them with two test
users that are allowed by your self-hosted deployment before exercising the UI.

## 2. Put the fixture in an isolated GCS prefix

CSV data sources currently read Google Cloud Storage. Create or choose a bucket
controlled by the self-hoster, then upload the fixture to a prefix that contains
only this demo CSV:

```bash
gcloud storage cp e2e/fixtures/neutral-sales.csv \
  gs://YOUR_BUCKET/talk-with-data-demo/neutral-sales.csv
```

Expected result: the command reports the copied object. Confirm it explicitly:

```bash
gcloud storage ls gs://YOUR_BUCKET/talk-with-data-demo/
```

Expected output includes:

```text
gs://YOUR_BUCKET/talk-with-data-demo/neutral-sales.csv
```

Use a dedicated service account that can list objects and read object content
from this bucket. Keep its JSON key outside the repository and outside shell
history. The header inspector selects the first `.csv` object returned from the
configured prefix, so an exclusive prefix makes the selection deterministic.

## 3. Create the source

Sign in as a superadmin and open **Admin > Data Sources**. Under **Create data
source**, enter:

| Field | Demo value | Meaning |
| --- | --- | --- |
| Name | `Neutral sales demo` | Operator-facing label |
| Bucket | `YOUR_BUCKET` | Bucket name without `gs://` |
| Prefix | `talk-with-data-demo/` | Prefix containing only the demo CSV |
| Credential ref | `neutral-demo-reader` | Opaque identifier for this stored credential |
| Service account JSON | Contents of the dedicated JSON key | Write-only onboarding input |

Select **Inspect headers**. The server lists the prefix, reads the CSV header,
encrypts the credential, and returns no plaintext credential. The browser clears
the pasted JSON after accepting the encrypted inspection result.

The headers should be `owner_email`, `region`, and `revenue`. Select
`owner_email` as **Owner column**.

Add the Firebase UIDs of both demo users to **Assigned users (UIDs,
comma-separated)**. Leave department grants empty for this demonstration, then
select **Create source**.

The assigned UIDs grant both users permission to query the source. They do not
grant either user access to the other user's rows.

## 4. Verify two distinct viewer scopes

Ensure each Firebase user document has the matching normalized email:

- Viewer A: `owner@example.com`
- Viewer B: `viewer@example.com`

Ask the same data question while signed in as each user, for example, "Show
region and revenue." The query may project `region` and `revenue`, but not
`owner_email`.

Expected result:

| Signed-in viewer | Visible row | Hidden row |
| --- | --- | --- |
| `owner@example.com` | `North, 120` | `South, 80` |
| `viewer@example.com` | `South, 80` | `North, 120` |

For an email owner identity, Talk With Data lowercases and trims both the
signed-in user's email and CSV owner values before comparing them. A department
grant follows the same rule: it authorizes the source, while the viewer still
receives only their own owner key.

## 5. Expected fail-closed behavior

| Scenario | Expected behavior |
| --- | --- |
| Empty viewer scope | The query succeeds with zero rows. It never falls back to all rows. |
| Configured owner column is absent | Loading fails closed. The public response is `Data source temporarily unavailable.` |
| Headers normalize to the same identity | Inspection shows `Duplicate normalized header identity` and blocks saving. The engine also rejects such a source if invalid configuration bypasses the UI. |
| Bucket, object, or credential is unavailable | Inspection fails, or queries return `Data source temporarily unavailable.` without exposing storage paths or credentials. |
| Viewer has no user or department grant | The request is denied with `You do not have access to this data source.` before credentials are loaded. |

For the duplicate case, headers such as `owner-email` and `owner_email` both
normalize to `owneremail` and are rejected.

## 6. Read-only query boundary

Each loaded source runs in an in-memory DuckDB instance. Before user-generated
SQL runs, Talk With Data creates a temporary authorization table and a filtered
view for the current viewer. The raw CSV table and authorization table are not
available to the query.

The SQL guard accepts one `SELECT` statement against the filtered view. It
rejects writes, schema changes, multiple statements, set operators, catalog
access, external file readers, and references to unauthorized tables. Results
are capped at 1,000 rows by default, and the default query timeout is 10 seconds.
The owner column is omitted from the filtered view, so it cannot be selected or
returned to the user.

This is an application-enforced read-only boundary, not a separate database
role. Its safety depends on the SQL guard, the isolated filtered view, and the
engine's fail-closed checks. Operators should keep the focused tests above in
their upgrade validation.

## Current boundaries

- CSV sources use GCS. Local dashboard storage does not make CSV sources local.
- `secretManager` credential references are not implemented. The UI encrypts
  the supplied service-account JSON for server-side storage.
- Header inspection reads the first `.csv` object found among the first 25
  objects returned for the prefix. Use one CSV per configured demo prefix.
- Source deletion removes its Firestore configuration. External CSV objects and
  service-account lifecycle remain the self-hoster's responsibility.
