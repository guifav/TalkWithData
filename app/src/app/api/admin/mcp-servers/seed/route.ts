import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";

const COLLECTION = "mcp_servers";

const CULKIN_MCPS = [
  {
    name: "Analytics",
    description:
      "82 analytics views covering Sales, CS, Marketing, Presales, Alerts, Forms, Company, Farmer, and Sentinela domains. RevOps dashboards, pipeline, NRR, churn risk, funnel metrics.",
    endpoint: "https://culkin.mygri.com/api/mcp/analytics",
    requiredScope: "mcp:analytics",
  },
  {
    name: "Marketing",
    description:
      "Marketing-specific tools for campaign management, lead scoring, and outbound analytics.",
    endpoint: "https://culkin.mygri.com/api/mcp/marketing",
    requiredScope: "mcp:marketing",
  },
  {
    name: "Customer Success",
    description:
      "Customer success tools for member health, retention metrics, and account management.",
    endpoint: "https://culkin.mygri.com/api/mcp/cx",
    requiredScope: "mcp:cx",
  },
  {
    name: "Matchmaking",
    description:
      "Matchmaking tools for member connections, interest matching, and networking recommendations.",
    endpoint: "https://culkin.mygri.com/api/mcp/matchmaking",
    requiredScope: "mcp:matchmaking",
  },
  {
    name: "Journey Explorer",
    description:
      "Journey explorer tools for member journey mapping and touchpoint analysis.",
    endpoint: "https://culkin.mygri.com/api/mcp/journey-explorer",
    requiredScope: "mcp:journey-explorer",
  },
  {
    name: "Full Access",
    description:
      "Complete superset: all 33 tools across 226 BigQuery tables. Includes analytics, generic query (list_tables, get_table_schema, query_table), smart fields, and all domain-specific tools.",
    endpoint: "https://culkin.mygri.com/api/mcp/full",
    requiredScope: "bq:explore",
  },
  {
    name: "Clusters",
    description:
      "Audience and cluster discovery tools. Discover contacts by taxonomy filters, profile/interest dimensions, and group-by segmentation with contact counts.",
    endpoint: "https://culkin.mygri.com/api/mcp/clusters",
    requiredScope: "bq:read",
  },
  {
    name: "Data Catalog",
    description:
      "Taxonomy-oriented surface across events, sessions, Morpheus signals, and contact interests — all organised by the 10 canonical GRI dimensions. Events by taxonomy, session-level classification, Morpheus signal coverage, contact interest discovery.",
    endpoint: "https://culkin.mygri.com/api/mcp/catalog",
    requiredScope: "mcp:catalog",
  },
];

/**
 * POST /api/admin/mcp-servers/seed
 * Seed the registry with known Culkin MCPs (superadmin).
 * Idempotent: only creates docs that don't exist yet (match by endpoint).
 */
export async function POST(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Get existing endpoints
    const snap = await adminDb.collection(COLLECTION).get();
    const existingEndpoints = new Set(
      snap.docs.map((doc) => doc.data().endpoint)
    );

    const created: string[] = [];
    const skipped: string[] = [];
    const now = new Date().toISOString();

    for (const mcp of CULKIN_MCPS) {
      if (existingEndpoints.has(mcp.endpoint)) {
        skipped.push(mcp.name);
        continue;
      }

      const docRef = adminDb.collection(COLLECTION).doc();
      await docRef.set({
        id: docRef.id,
        name: mcp.name,
        description: mcp.description,
        endpoint: mcp.endpoint,
        requiredScope: mcp.requiredScope,
        tools: [],
        toolCount: 0,
        lastSyncedAt: null,
        lastSyncError: null,
        active: true,
        createdAt: now,
        updatedAt: now,
      });

      created.push(mcp.name);
    }

    return NextResponse.json({
      created,
      skipped,
      message: `Seeded ${created.length} MCP servers (${skipped.length} already existed)`,
    });
  } catch (error) {
    console.error("MCP seed failed:", error);
    return NextResponse.json(
      { error: "Failed to seed MCP servers" },
      { status: 500 }
    );
  }
}
