import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import {
  DEFAULT_CONFIG,
  SUPPORTED_MODELS,
  isValidConfig,
  sanitizeAiConfig,
  type AiModelConfig,
} from "@/lib/ai-model";

export async function GET(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    defaultConfig: DEFAULT_CONFIG,
    supportedModels: SUPPORTED_MODELS,
  });
}

export async function PUT(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { uid, aiConfig, keepExistingApiKey } = body as {
      uid?: string;
      aiConfig?: AiModelConfig | null;
      keepExistingApiKey?: boolean;
    };

    if (!uid?.trim()) {
      return NextResponse.json({ error: "uid is required" }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (aiConfig === null) {
      await userRef.update({ aiConfig: null });
      return NextResponse.json({ success: true, uid, aiConfig: null });
    }

    if (!aiConfig) {
      return NextResponse.json({ error: "aiConfig is required" }, { status: 400 });
    }

    const existingConfig = userDoc.data()?.aiConfig as AiModelConfig | undefined;
    const configToSave: AiModelConfig = {
      provider: aiConfig.provider,
      model: aiConfig.model,
      baseUrl: aiConfig.baseUrl?.trim() || undefined,
      apiKey: aiConfig.apiKey?.trim() || undefined,
    };

    if (
      configToSave.provider === "custom" &&
      keepExistingApiKey &&
      !configToSave.apiKey &&
      existingConfig?.provider === "custom" &&
      existingConfig.apiKey
    ) {
      configToSave.apiKey = existingConfig.apiKey;
    }

    if (!isValidConfig(configToSave)) {
      return NextResponse.json(
        { error: "Invalid AI config. Select a supported provider/model. Custom requires baseUrl and model." },
        { status: 400 }
      );
    }

    if (configToSave.provider === "custom" && !configToSave.apiKey) {
      return NextResponse.json(
        { error: "Custom AI provider requires an apiKey." },
        { status: 400 }
      );
    }

    await userRef.update({ aiConfig: configToSave });
    return NextResponse.json({
      success: true,
      uid,
      aiConfig: sanitizeAiConfig(configToSave),
    });
  } catch (error) {
    console.error("AI config update failed:", error);
    return NextResponse.json(
      { error: "Failed to update AI config" },
      { status: 500 }
    );
  }
}
