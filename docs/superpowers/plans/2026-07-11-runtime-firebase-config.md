# Runtime Firebase Public Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one Docker image consume different public Firebase Web App configuration at server runtime.

**Architecture:** The root server layout emits an escaped, allowlisted bootstrap object in `<head>`. The Firebase client module synchronously validates that browser global before initializing the SDK, preserving all existing `auth` and `db` consumers.

**Tech Stack:** Next.js 16 Server Components, React 19, TypeScript, Firebase Web SDK, Vitest, Docker.

## Global Constraints

- Continue using `app/.env` and `app/.env.example` as the only local environment contract.
- Expose only the existing `NEXT_PUBLIC_FIREBASE_*` values and
  `NEXT_PUBLIC_ALLOWED_AUTH_DOMAIN`.
- Never serialize, log, or copy the full process environment.
- Read runtime values through dynamic key lookup so Next.js cannot inline build-time values.
- Preserve synchronous `auth`, `db`, and default Firebase app exports.
- Do not use Docker build arguments for Firebase configuration.

---

### Task 1: Shared runtime configuration contract

**Files:**
- Create: `app/src/lib/firebase/runtime-config.ts`
- Create: `app/src/lib/__tests__/firebase-runtime-config.test.ts`

**Interfaces:**
- Produces: `FirebasePublicConfig`, `parseFirebasePublicConfig(input: unknown): FirebasePublicConfig`, and `FIREBASE_PUBLIC_ENV_KEYS`.

- [ ] **Step 1: Write the failing parser tests**

Create tests that pass all six camel-case fields, assert the returned object contains only those fields, and assert missing or non-string fields throw `Invalid public Firebase configuration: missing or invalid <field>` without including values.

- [ ] **Step 2: Verify RED**

Run: `cd app && npm test -- src/lib/__tests__/firebase-runtime-config.test.ts`

Expected: FAIL because `@/lib/firebase/runtime-config` does not exist.

- [ ] **Step 3: Implement the minimal shared contract**

Define this exact shape:

```ts
export interface FirebasePublicConfig {
  allowedAuthDomain: string;
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export const FIREBASE_PUBLIC_ENV_KEYS = {
  allowedAuthDomain: "NEXT_PUBLIC_ALLOWED_AUTH_DOMAIN",
  apiKey: "NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "NEXT_PUBLIC_FIREBASE_APP_ID",
} as const;
```

Build a fresh object by iterating those keys and rejecting every value that is not a non-empty string.

- [ ] **Step 4: Verify GREEN**

Run: `cd app && npm test -- src/lib/__tests__/firebase-runtime-config.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/firebase/runtime-config.ts app/src/lib/__tests__/firebase-runtime-config.test.ts
git commit -m "feat: define Firebase runtime config contract"
```

### Task 2: Server bootstrap and safe serialization

**Files:**
- Create: `app/src/lib/firebase/runtime-config.server.ts`
- Create: `app/src/components/firebase-runtime-config.tsx`
- Modify: `app/src/app/layout.tsx`
- Extend test: `app/src/lib/__tests__/firebase-runtime-config.test.ts`

**Interfaces:**
- Consumes: `FIREBASE_PUBLIC_ENV_KEYS`, `FirebasePublicConfig`, `parseFirebasePublicConfig`.
- Produces: `readFirebasePublicConfig(env?: NodeJS.ProcessEnv): FirebasePublicConfig`, `serializeFirebaseRuntimeConfig(config: FirebasePublicConfig): string`, and `FirebaseRuntimeConfig` server component.

- [ ] **Step 1: Write failing server tests**

Test that environment names map to camel-case fields, extra secret keys are absent, missing fields fail by name only, and serialized input containing `</script><script>` contains no literal `<`, `>`, `&`, `\u2028`, or `\u2029`.

- [ ] **Step 2: Verify RED**

Run: `cd app && npm test -- src/lib/__tests__/firebase-runtime-config.test.ts`

Expected: FAIL because the server reader and serializer do not exist.

- [ ] **Step 3: Implement the server boundary**

Use `import "server-only"`. Read each key with `env[envName]`, validate through the shared parser, and serialize with:

```ts
JSON.stringify(config).replace(/[<>&\u2028\u2029]/g, (character) =>
  `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
)
```

Render this exact assignment in a `<script>` inside the root `<head>`:

```ts
window.__TWD_FIREBASE_CONFIG__ = ${serializedConfig};
```

- [ ] **Step 4: Verify GREEN and type safety**

Run: `cd app && npm test -- src/lib/__tests__/firebase-runtime-config.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/firebase/runtime-config.server.ts app/src/components/firebase-runtime-config.tsx app/src/app/layout.tsx app/src/lib/__tests__/firebase-runtime-config.test.ts
git commit -m "feat: bootstrap Firebase config at runtime"
```

### Task 3: Client initialization from the runtime bootstrap

**Files:**
- Modify: `app/src/lib/firebase/client.ts`
- Create: `app/src/lib/__tests__/firebase-client-runtime-config.test.ts`
- Modify: `app/src/lib/firebase/runtime-config.ts`

**Interfaces:**
- Consumes: `parseFirebasePublicConfig` and `window.__TWD_FIREBASE_CONFIG__`.
- Produces: `getBrowserFirebasePublicConfig(): FirebasePublicConfig`; preserves existing Firebase exports.

- [ ] **Step 1: Write failing client tests**

Mock `firebase/app`, `firebase/auth`, and `firebase/firestore`. Set the browser global to a complete config and assert `initializeApp` receives that exact object. Delete the global and assert module import rejects with `Firebase runtime configuration is missing`.

- [ ] **Step 2: Verify RED**

Run: `cd app && npm test -- src/lib/__tests__/firebase-client-runtime-config.test.ts`

Expected: FAIL because the client still reads `process.env.NEXT_PUBLIC_*`.

- [ ] **Step 3: Implement the browser reader**

Declare the global in the shared module and implement:

```ts
export function getBrowserFirebasePublicConfig(): FirebasePublicConfig {
  if (typeof window === "undefined" || !window.__TWD_FIREBASE_CONFIG__) {
    throw new Error("Firebase runtime configuration is missing");
  }
  return parseFirebasePublicConfig(window.__TWD_FIREBASE_CONFIG__);
}
```

Replace the environment object in `firebase/client.ts` with `getBrowserFirebasePublicConfig()`.

- [ ] **Step 4: Verify GREEN and regression tests**

Run: `cd app && npm test -- src/lib/__tests__/firebase-client-runtime-config.test.ts src/lib/__tests__/firebase-runtime-config.test.ts && npm run typecheck && npm run lint`

Expected: PASS with no warnings.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/firebase/client.ts app/src/lib/firebase/runtime-config.ts app/src/lib/__tests__/firebase-client-runtime-config.test.ts
git commit -m "feat: initialize Firebase from runtime config"
```

### Task 4: Portable image proof and documentation

**Files:**
- Create: `scripts/test-runtime-firebase-container.sh`
- Modify: `README.md`
- Modify: `README.pt-BR.md`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `app/.env.example`
- Modify: `app/package.json`

**Interfaces:**
- Consumes: the runtime bootstrap HTML emitted by Tasks 2 and 3.
- Produces: `npm run test:runtime-config-container` smoke proof.

- [ ] **Step 1: Write the failing container smoke script**

Build one image once, start it twice with complete non-secret environment files whose Firebase project IDs differ, request `/login`, and assert each HTML response contains only its own project ID. Use traps to remove both containers and temporary files.

- [ ] **Step 2: Verify RED**

Run: `cd app && npm run test:runtime-config-container`

Expected before Tasks 2 and 3: FAIL because no runtime bootstrap exists in HTML.

- [ ] **Step 3: Update the public contract documentation**

State that the six `NEXT_PUBLIC_FIREBASE_*` names are read by the server at container runtime and bootstrapped to the browser. Remove the claim that a prebuilt image cannot consume different Firebase public values. Keep all secret variables server-only.

- [ ] **Step 4: Run the complete verification bundle**

Run:

```bash
cd app
npm run test:runtime-config-container
npm run lint
npm run typecheck
npm run test:coverage
npm run build
cd ..
git diff --check
```

Expected: one image passes with two runtime configurations; all repository gates pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/test-runtime-firebase-container.sh app/package.json app/.env.example README.md README.pt-BR.md docs/DEPLOYMENT.md
git commit -m "test: prove portable Firebase runtime config"
```

### Task 5: E4 and pull request

**Files:**
- No source changes unless E4 finds a defect.

**Interfaces:**
- Consumes: complete issue #38 implementation and verification evidence.
- Produces: a PR linked to issue #38 with two conclusive independent E4 approvals and green CI.

- [ ] **Step 1: Push the branch and open the PR**

Use branch `feat/38-runtime-firebase-config`, include `Closes #38`, exact local validation, and the same-image/two-environment proof.

- [ ] **Step 2: Attempt all three E4 validators**

Run fresh review-only sessions with GPT 5.6 Sol max, Claude Opus 4.8 max, and Kimi k2.7-code against the exact PR head. Two conclusive validators are sufficient only when the third fails operationally.

- [ ] **Step 3: Iterate on findings**

For every accepted finding, write a failing regression test first, implement the minimal correction, rerun the relevant and full gates, push a new head, and restart E4 on that head.

- [ ] **Step 4: Merge only after the gate**

Require green CI, no P0/P1/P2, and either consensus or explicit P3/P4 adjudication in the PR body before merge.
