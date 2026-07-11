import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/api-auth";
import {
  DEFAULT_CONFIG,
  SUPPORTED_MODELS,
  type AiModelConfig,
} from "@/lib/ai-model";
import {
  AiConfigSecretError,
  updateUserAiConfig,
} from "@/lib/ai-config-secrets";

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

    if (aiConfig === undefined) {
      return NextResponse.json({ error: "aiConfig is required" }, { status: 400 });
    }

    const storedConfig = await updateUserAiConfig(uid, aiConfig, { keepExistingApiKey });
    return NextResponse.json({
      success: true,
      uid,
      aiConfig: storedConfig,
    });
  } catch (error) {
    if (error instanceof AiConfigSecretError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("AI config update failed:", error);
    return NextResponse.json(
      { error: "Failed to update AI config" },
      { status: 500 }
    );
  }
}
