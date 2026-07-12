# Redacted Operational Observability Design

## Context

Talk With Data is a self-hosted open-source service. Operators need stable signals for failed requests, storage access, migrations, and thumbnail generation, but logs must not become a second data store for credentials, personal data, prompts, uploaded content, or dashboard capabilities.

## Goals

- Emit one-line JSON events with stable names, levels, timestamps, outcomes, and correlation identifiers.
- Remove sensitive fields recursively before serialization.
- Serialize errors as bounded metadata without messages, stacks, or causes by default.
- Instrument request failures, storage operations, migration checks, and thumbnail generation.
- Keep production defaults useful with standard output only and no paid monitoring dependency.
- Prove through tests that sensitive field names and representative values never reach serialized output.

## Non-goals

- Add a vendor-specific telemetry SDK.
- Log request or response bodies.
- Log row data, prompts, uploaded document content, user emails, or raw object paths.
- Replace application metrics with full distributed tracing.

## Event Contract

Every event contains:

- `timestamp`: ISO 8601 UTC timestamp.
- `level`: `info`, `warn`, or `error`.
- `event`: a stable dotted name.
- `correlationId`: a safe caller-provided identifier or a generated UUID.
- `outcome`: `started`, `succeeded`, `rejected`, or `failed` when applicable.

Initial event names:

- `request.upload.rejected`
- `request.upload.failed`
- `storage.operation.started`
- `storage.operation.succeeded`
- `storage.operation.failed`
- `migration.verification.started`
- `migration.verification.succeeded`
- `migration.verification.failed`
- `thumbnail.generation.started`
- `thumbnail.generation.succeeded`
- `thumbnail.generation.failed`

## Redaction Contract

The serializer drops keys matching authentication, cookie, token, key, secret, credential, capability, service-account, private-key, prompt, row, document-content, uploaded-content, email, and body families. Matching is case-insensitive after punctuation normalization and applies recursively to objects and arrays.

Errors serialize only a normalized `name` and optional scalar `code` or numeric `status`. Error messages, stacks, causes, and arbitrary enumerable properties are not included.

Log metadata must be bounded to a maximum depth, collection length, key count, and string length. Circular references are represented by a fixed marker.

## Correlation

HTTP boundaries accept `x-request-id` only when it is a valid UUID. Invalid or missing values are replaced by `crypto.randomUUID()`. Responses expose the selected value through `x-request-id`, never an authentication value.

Storage operations receive a fresh operation correlation ID unless a request-scoped value is explicitly supplied in a future API. Object paths and bucket names are not logged.

## Runtime Boundaries

- The Next.js app owns the full typed logger and request correlation helper.
- The thumbnail Cloud Function keeps a small local logger because it is built and deployed as an independent package.
- The migration verification shell emits the same JSON envelope with a run identifier generated without reading the database URL.

This boundary avoids runtime coupling between independently packaged artifacts while preserving one documented event vocabulary.

## Log Levels and Defaults

- `info`: lifecycle start and success events.
- `warn`: expected rejection or recoverable cleanup failure.
- `error`: operation failure requiring operator attention.

All environments emit JSON to standard output and standard error. `TWD_LOG_LEVEL` defaults to `info`; accepted values are `info`, `warn`, and `error`. Lower-priority events are suppressed without changing request behavior.

## Troubleshooting Contract

Operators correlate a client-visible `x-request-id` with structured events, then inspect `event`, `outcome`, `operation`, safe error name/code, duration, and byte counts. Investigation must not require bodies, credentials, storage paths, prompt text, or user data.
