# Runtime Firebase Public Configuration

## Goal

Allow one Talk With Data container image to run in multiple environments with
different Firebase Web App configuration. Public browser configuration is
resolved from the process environment at server runtime. Secrets remain in the
server process and never enter the bootstrap payload.

## Chosen approach

The root server layout emits a small inline bootstrap script before any client
components hydrate. The script assigns a validated, allowlisted object to a
well-known browser global. The Firebase client module reads and validates that
object synchronously before calling the Firebase SDK.

This preserves the existing synchronous `auth` and `db` exports. A React
provider would require changing every Firestore consumer to wait for context.
A JSON endpoint would add a network round trip and an initialization race.
Docker build arguments would make images environment-specific and are rejected
by issue #38 unless runtime injection proves impossible.

## Components

### Shared public contract

A small isomorphic module defines the six Firebase public fields, their runtime
shape, and strict parsing. It accepts only non-empty strings and returns a new
allowlisted object. Unknown input fields are discarded.

### Server bootstrap

A server-only module reads the existing `NEXT_PUBLIC_FIREBASE_*` variables by
dynamic key lookup. Dynamic access is required so Next.js does not replace the
values during image build. It validates the result and serializes it for an
inline script, escaping characters that could terminate a script element.

The root layout places the script in `<head>` so it executes before client
chunks. Missing or malformed configuration throws a clear server-render error
that names fields but never values.

### Firebase client initialization

The browser module reads the bootstrap global and validates it before
initializing Firebase. A missing bootstrap produces a clear error. Existing
`auth`, `db`, and default app exports remain synchronous and unchanged for
consumers.

## Data flow

1. The container starts with `app/.env` or platform environment variables.
2. A request reaches the root server layout.
3. The server reads only the six allowlisted public Firebase variables.
4. The server validates and emits the escaped bootstrap object in `<head>`.
5. The browser executes the bootstrap before loading hydrated client modules.
6. `firebase/client.ts` validates the global and initializes the Firebase SDK.

## Error handling and security

- Missing fields produce a deterministic error listing variable names only.
- Non-string values are rejected by the shared parser.
- The payload includes only the six public Firebase values.
- Serialization escapes `<`, `>`, `&`, and Unicode line separators.
- No server secret, full environment object, or configuration value is logged.
- Local development and containers use the same `app/.env` contract.

## Tests

- Shared parser accepts a complete object and rejects missing or malformed
  fields.
- Server reader proves dynamic environment lookup and exact allowlisting.
- Serializer proves script-breaking content is escaped.
- Client initializer passes the runtime object to Firebase and fails clearly
  when the global is absent.
- Existing Firebase consumers keep their synchronous imports.
- A clean Docker build without Firebase build arguments succeeds, and the same
  image is started with two distinct runtime configurations for a smoke proof.

## Documentation

README, deployment documentation, and `app/.env.example` will explain that
`NEXT_PUBLIC_FIREBASE_*` values are read by the server at runtime and safely
bootstrapped to the browser. They will no longer claim that rebuilding the
image is required for these values.
