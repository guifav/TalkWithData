import { readFileSync } from "fs";
import { resolve } from "path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const requireEmulator = process.env.REQUIRE_FIRESTORE_EMULATOR === "1";

if (!emulatorHost && requireEmulator) {
  describe("Firestore rules emulator", () => {
    it("requires FIRESTORE_EMULATOR_HOST", () => {
      expect(emulatorHost, "Start the Firestore Emulator before running this test").toBeTruthy();
    });
  });
}

const describeWithEmulator = emulatorHost ? describe : describe.skip;

describeWithEmulator("Firestore rules for AI config secrets", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "talkwithdata-rules-test",
      firestore: {
        rules: readFileSync(resolve(__dirname, "../../../../firestore.rules"), "utf8"),
      },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it("allows a user to read sanitized own metadata", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", "uid-a"), {
        email: "user@example.com",
        aiConfig: {
          provider: "custom",
          model: "custom-model",
          baseUrl: "https://llm.example.test/v1",
          apiKeyConfigured: true,
        },
      });
    });

    const db = testEnv.authenticatedContext("uid-a", { email: "user@example.com" }).firestore();

    await assertSucceeds(getDoc(doc(db, "users", "uid-a")));
  });

  it("denies a user document that still contains legacy secret material", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", "uid-a"), {
        email: "user@example.com",
        aiConfig: {
          provider: "custom",
          model: "custom-model",
          baseUrl: "https://llm.example.test/v1",
          apiKey: "sk-legacy",
        },
      });
    });

    const db = testEnv.authenticatedContext("uid-a", { email: "user@example.com" }).firestore();

    await assertFails(getDoc(doc(db, "users", "uid-a")));
  });

  it("denies direct client reads of encrypted AI config secrets", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "ai_config_secrets", "uid-a"), {
        apiKeyEnc: "ciphertext",
      });
    });

    const db = testEnv.authenticatedContext("uid-a", { email: "user@example.com" }).firestore();

    await assertFails(getDoc(doc(db, "ai_config_secrets", "uid-a")));
  });
});
