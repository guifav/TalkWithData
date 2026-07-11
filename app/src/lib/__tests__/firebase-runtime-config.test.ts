import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FIREBASE_PUBLIC_ENV_KEYS,
  getFirebasePublicConfig,
  parseFirebasePublicConfig,
} from "@/lib/firebase/runtime-config";
import {
  readFirebasePublicConfig,
  serializeFirebaseRuntimeConfig,
} from "@/lib/firebase/runtime-config.server";

const completeConfig = {
  allowedAuthDomain: "example.com",
  apiKey: "public-api-key",
  authDomain: "project.firebaseapp.com",
  projectId: "project-one",
  storageBucket: "project-one.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef",
};

describe("Firebase runtime configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns only the allowlisted public Firebase fields", () => {
    expect(
      parseFirebasePublicConfig({
        ...completeConfig,
        DASHBOARD_SESSION_SECRET: "must-not-cross-the-boundary",
      }),
    ).toEqual(completeConfig);
    expect(Object.keys(FIREBASE_PUBLIC_ENV_KEYS)).toEqual(Object.keys(completeConfig));
  });

  it("maps only allowlisted environment variables to the public contract", () => {
    const env = Object.fromEntries(
      Object.entries(FIREBASE_PUBLIC_ENV_KEYS).map(([field, envName]) => [
        envName,
        completeConfig[field as keyof typeof completeConfig],
      ]),
    );

    expect(
      readFirebasePublicConfig({
        ...env,
        DASHBOARD_SESSION_SECRET: "must-not-cross-the-boundary",
      }),
    ).toEqual(completeConfig);
  });

  it("escapes characters that could break out of the bootstrap script", () => {
    const serialized = serializeFirebaseRuntimeConfig({
      ...completeConfig,
      apiKey: "</script><script>&\u2028\u2029",
    });

    expect(serialized).not.toMatch(/[<>&\u2028\u2029]/u);
    expect(JSON.parse(serialized)).toEqual({
      ...completeConfig,
      apiKey: "</script><script>&\u2028\u2029",
    });
  });

  it("uses inert public placeholders only while Next.js collects build pages", () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    for (const envName of Object.values(FIREBASE_PUBLIC_ENV_KEYS)) {
      vi.stubEnv(envName, "");
    }

    expect(getFirebasePublicConfig()).toEqual({
      allowedAuthDomain: "build-placeholder.invalid",
      apiKey: "build-placeholder",
      authDomain: "build-placeholder.invalid",
      projectId: "build-placeholder",
      storageBucket: "build-placeholder.invalid",
      messagingSenderId: "0",
      appId: "build-placeholder",
    });
  });

  it.each([
    ["missing", { ...completeConfig, projectId: undefined }],
    ["non-string", { ...completeConfig, apiKey: 42 }],
    ["empty", { ...completeConfig, storageBucket: "  " }],
  ])("rejects a %s public Firebase field without exposing values", (_, input) => {
    expect(() => parseFirebasePublicConfig(input)).toThrow(
      /Invalid public Firebase configuration: missing or invalid/,
    );
    try {
      parseFirebasePublicConfig(input);
    } catch (error) {
      expect(String(error)).not.toContain("must-not-cross-the-boundary");
      expect(String(error)).not.toContain("project-one.appspot.com");
    }
  });
});
