import { NextRequest } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { queryDataset } from "@/lib/data-sources/query";
import {
  publicErrorMessage,
  publicErrorStatus,
} from "@/lib/data-sources/errors";

/**
 * Superficie HTTP do tool query_dataset (P1.7).
 *
 * Recebe { dataSourceId, query } e executa sobre a VIEW filtrada por viewer,
 * respeitando os guards de acesso (P1.4) e o row-scope (P1.6). O `query` ja
 * deve ser SQL SELECT-only (o modelo converte NL antes de chamar).
 */
export async function POST(request: NextRequest) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { dataSourceId?: unknown; query?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const dataSourceId =
    typeof body.dataSourceId === "string" ? body.dataSourceId : "";
  const sql = typeof body.query === "string" ? body.query : "";

  if (!dataSourceId || !sql) {
    return new Response(
      JSON.stringify({ error: "dataSourceId e query sao obrigatorios" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Limite de tamanho do SQL para evitar DoS via parser AST (P2 E4/Kimi).
  if (sql.length > 50_000) {
    return new Response(
      JSON.stringify({ error: "Invalid query input." }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const result = await queryDataset({
      uid: auth.uid,
      dataSourceId,
      sql,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const status = publicErrorStatus(err);
    console.error(`[query-dataset] failed (${status}):`, err);

    return new Response(
      JSON.stringify({ error: publicErrorMessage(err) }),
      {
        status,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
