import { describe, expect, it } from "vitest";
import { parseFirebaseEmulatorConfig } from "@/lib/firebase/emulator-config";

describe("parseFirebaseEmulatorConfig", () => {
  it("returns explicit auth and Firestore endpoints", () => {
    expect(parseFirebaseEmulatorConfig({
      authHost: "127.0.0.1:9099",
      firestoreHost: "localhost:8080",
    })).toEqual({
      authUrl: "http://127.0.0.1:9099",
      firestore: { host: "localhost", port: 8080 },
    });
  });

  it("keeps production behavior when endpoints are absent", () => {
    expect(parseFirebaseEmulatorConfig({})).toBeNull();
  });

  it.each([
    { authHost: "https://remote.example:9099" },
    { authHost: "127.0.0.1:not-a-port" },
    { firestoreHost: "127.0.0.1:0" },
    { firestoreHost: "remote.example:8080" },
  ])("rejects unsafe or invalid emulator endpoints: %o", (input) => {
    expect(() => parseFirebaseEmulatorConfig(input)).toThrow(/emulator/i);
  });
});
