import { readFileSync } from "fs";
import { resolve } from "path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where,
} from "firebase/firestore";

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

  it("allows first login to check its own missing user document", async () => {
    const db = testEnv.authenticatedContext("uid-new", { email: "new@example.com" }).firestore();

    const snapshot = await assertSucceeds(getDoc(doc(db, "users", "uid-new")));

    expect(snapshot.exists()).toBe(false);
  });

  it("allows rule-provable home queries and direct reads for email access", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", "uid-a"), {
        email: "user@example.com",
      });
      await setDoc(doc(context.firestore(), "dashboards", "dash-owner-team"), {
        createdBy: "uid-a",
        visibility: "team",
        allowedEmails: [],
        allowedDepartments: [],
        archivedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      await setDoc(doc(context.firestore(), "dashboards", "dash-email"), {
        createdBy: "uid-b",
        visibility: "specific",
        allowedEmails: ["user@example.com"],
        allowedDepartments: [],
        archivedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
    });
    const db = testEnv.authenticatedContext("uid-a", { email: "user@example.com" }).firestore();
    const homeQueries = [
      query(
        collection(db, "dashboards"),
        where("archivedAt", "==", null),
        where("createdBy", "==", "uid-a"),
        orderBy("createdAt", "desc"),
      ),
      query(
        collection(db, "dashboards"),
        where("archivedAt", "==", null),
        where("visibility", "==", "team"),
        orderBy("createdAt", "desc"),
      ),
    ];

    const results = [
      await assertSucceeds(getDocs(homeQueries[0])),
      await assertSucceeds(getDocs(homeQueries[1])),
    ];

    expect(results.flatMap((result) => result.docs.map((item) => item.id))).toEqual([
      "dash-owner-team",
      "dash-owner-team",
    ]);
    await assertSucceeds(getDoc(doc(db, "dashboards", "dash-email")));
  });

  it("rejects an email-filtered list query that rules cannot prove", async () => {
    const db = testEnv.authenticatedContext("uid-a", { email: "user@example.com" }).firestore();
    const emailQuery = query(
      collection(db, "dashboards"),
      where("archivedAt", "==", null),
      where("allowedEmails", "array-contains", "user@example.com"),
      orderBy("createdAt", "desc"),
    );

    await assertFails(getDocs(emailQuery));
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

  it("denies client create and update writes containing AI config", async () => {
    const db = testEnv.authenticatedContext("uid-a", { email: "user@example.com" }).firestore();

    await assertFails(setDoc(doc(db, "users", "uid-a"), {
      email: "user@example.com",
      aiConfig: {
        provider: "custom",
        model: "custom-model",
        apiKey: "sk-client",
      },
    }));

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", "uid-a"), {
        email: "user@example.com",
        displayName: "User A",
      });
    });

    await assertFails(setDoc(doc(db, "users", "uid-a"), {
      aiConfig: {
        provider: "custom",
        model: "custom-model",
        baseUrl: "https://llm.example.test/v1",
        apiKeyConfigured: true,
      },
    }, { merge: true }));
  });

  it("denies cross-user reads even when metadata is sanitized", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users", "uid-b"), {
        email: "other@example.com",
        aiConfig: {
          provider: "custom",
          model: "custom-model",
          baseUrl: "https://llm.example.test/v1",
          apiKeyConfigured: true,
        },
      });
    });

    const db = testEnv.authenticatedContext("uid-a", { email: "user@example.com" }).firestore();

    await assertFails(getDoc(doc(db, "users", "uid-b")));
  });
});
