# Playwright Primary Journeys Design

## Goal

Provide browser-level proof for the public self-hosted journey without production credentials or live Firebase, GCP, or organization data. The suite must exercise real Next.js routes, Firebase client and Admin SDK boundaries, local dashboard storage, PostgreSQL, and the external CSV storage protocol.

## Chosen architecture

Run Chromium against the development server inside deterministic local services:

- Firebase Auth and Firestore emulators for identity, rules, client listeners, Admin SDK routes, and embed-token state.
- PostgreSQL 16 for the application database and migrations.
- Local dashboard storage rooted in a temporary directory.
- A bounded local GCS protocol fixture for one neutral CSV object. The application continues through `@google-cloud/storage`; Playwright does not intercept application routes.

The alternatives were rejected:

- Browser route interception would repeat the mocked-boundary weakness this issue exists to close.
- A test-only authentication bypass would add a production backdoor and maintenance debt.
- Live Firebase or GCP credentials would make contributor and fork CI non-reproducible.

## Authentication

The browser uses the Firebase Auth emulator's Google-provider popup. The test identity uses `owner@example.com`, matching the checked-in Firestore rules. A deterministic pending-role document promotes the owner to `superadmin` through the same `/api/auth/init` route used in production.

Client emulator connections are enabled only when explicit public emulator host variables are present. Production defaults remain unchanged. Email and department access IDs are refreshed through the authenticated server every 30 seconds because Firestore rules cannot safely prove those dynamic list queries.

## Journeys

1. Login through the emulator provider flow and land on the authenticated home page.
2. Upload a neutral, self-contained HTML dashboard through the UI and verify it appears on home.
3. Open the authenticated dashboard view and assert the sandboxed iframe renders the fixture.
4. Generate an embed token through the real API and verify the unauthenticated embed iframe renders the same fixture.
5. Prove viewer and embed dashboard sessions are read-only. Owners may receive write scope; non-owner and embed sessions receive read scope, and data API mutations fail closed.
6. Register a neutral CSV source through the superadmin UI: inspect headers through the local GCS protocol fixture, choose the owner column, save the governed source, and verify it is listed.

## Artifacts and privacy

Playwright records traces and screenshots only on failure. Fixtures use `example.com` identities and synthetic values. The suite redacts credential and session-token patterns from retained failure artifacts before CI uploads them.

## CI boundaries

The E2E job is separate from unit coverage, uses one Chromium worker, bounded retries and timeouts, and runs only after installing the pinned browser version from the lockfile. Service processes are child processes of the test command and are cleaned up on exit.

## Security correction exposed by the journey

The current view route injects a write-scoped dashboard token for every authenticated viewer and embed. The implementation will mint write scope only for the dashboard owner and read scope for viewers and token embeds. Dashboard session tokens expire after 10 minutes. The data API will accept a read-scoped bearer token only for GET or HEAD, preserving dynamic read-only dashboards while rejecting POST, PATCH, and DELETE.
