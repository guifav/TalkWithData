import { describe, expect, it } from "vitest";

import {
  FIREBASE_PUBLIC_ENV_KEYS,
  parseFirebasePublicConfig,
} from "@/lib/firebase/runtime-config";

const completeConfig = {
  apiKey: "public-api-key",
  authDomain: "project.firebaseapp.com",
  projectId: "project-one",
  storageBucket: "project-one.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef",
};

describe("Firebase runtime configuration", () => {
  it("returns only the allowlisted public Firebase fields", () => {
    expect(
      parseFirebasePublicConfig({
        ...completeConfig,
        DASHBOARD_SESSION_SECRET: "must-not-cross-the-boundary",
      }),
    ).toEqual(completeConfig);
    expect(Object.keys(FIREBASE_PUBLIC_ENV_KEYS)).toEqual(Object.keys(completeConfig));
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
