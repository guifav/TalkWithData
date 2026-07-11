import { NextResponse } from "next/server";
import { checkPostgresReadiness } from "@/lib/readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const ready = await checkPostgresReadiness();
  return NextResponse.json(
    ready
      ? { status: "ready", dependencies: { postgresql: "ok" } }
      : {
          status: "not_ready",
          dependencies: { postgresql: "unavailable" },
        },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
