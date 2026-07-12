# Playwright Primary Journeys Implementation Plan

1. Add failing unit tests for owner/viewer/embed session scope and read-token method enforcement.
2. Correct view and catch-all route token minting, then make read bearer tokens valid only for read methods.
3. Add explicit Firebase client emulator configuration with focused tests.
4. Add Playwright, deterministic configuration, neutral HTML/CSV fixtures, emulator seeding, and the local GCS protocol fixture.
5. Implement login, upload, authenticated view, embed, read-only, and CSV onboarding browser tests.
6. Add bounded CI execution and secret-safe failure artifact validation.
7. Document clean-clone E2E commands and expected results in both README entry points.
8. Run lint, typecheck, unit coverage, build, Firestore rules, migrations, Playwright, and CI-equivalent validation.
9. Open the PR, run E4 with GPT-5.6 Sol max, Claude Opus 4.8 max, and Kimi k2.7-code, then iterate to consensus.
