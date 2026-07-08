import {
  getDataSource,
  getDataSourceWithCredentials,
  type DataSourceMetadata,
} from "@/lib/data-sources/firestore";
import { canQueryDataSource, resolveViewerScope } from "@/lib/data-sources/access";
import { loadSource } from "@/lib/data-sources/duckdb-engine";
import { createGcsStorage } from "@/lib/data-sources/storage";
import { SecretService } from "@/lib/data-sources/credentials";
import {
  DataSourceNotFoundError,
  DataSourceUnavailableError,
  QueryDatasetAccessDeniedError,
} from "@/lib/data-sources/errors";
import type { DataSource } from "@/lib/data-sources/types";
import { DataSourceKind } from "@/lib/data-sources/types";

export interface QueryDatasetResult {
  columns: string[];
  rows: unknown[][];
  truncated: boolean;
}

/**
 * Converte a metadata persistida em Firestore para o contrato de runtime
 * consumido pelo engine DuckDB (P1.6). Mantem apenas os campos de escopo de
 * linha e grants; nunca inclui credenciais.
 */
export function dataSourceToRuntime(dsMeta: DataSourceMetadata): DataSource {
  const ds: DataSource = {
    id: dsMeta.id,
    kind: DataSourceKind.CSV,
    orgId: dsMeta.orgId,
    configVersion: dsMeta.configVersion,
    accessGrants: dsMeta.accessGrants,
    ownerColumnIdentity: dsMeta.ownerColumnIdentity ?? "email",
  };

  if (dsMeta.ownerColumn) {
    ds.ownerColumn = dsMeta.ownerColumn;
  }

  return ds;
}

export interface ReadCsvResult {
  csvBuffer: Buffer;
  etag: string;
}

export interface QueryDatasetDeps {
  /**
   * Leitura do CSV da fonte. Em producao usa readDataSourceCsv (GCS + credenciais
   * descriptografadas). Em testes, injeta um stub para nao tocar o GCS real.
   */
  readCsv?: (dsMeta: DataSourceMetadata) => Promise<ReadCsvResult>;
}

/**
 * Tool query_dataset: recebe SQL (ja convertido de NL pelo modelo antes) e
 * executa sobre a VIEW filtrada por viewer, respeitando os guards de acesso
 * (P1.4) e o row-scope (P1.6). Nunca retorna a tabela bruta.
 */
export async function queryDataset(
  args: { uid: string; dataSourceId: string; sql: string },
  deps: QueryDatasetDeps = {},
): Promise<QueryDatasetResult> {
  const dsMeta = await getDataSource(args.dataSourceId);
  if (!dsMeta) {
    throw new DataSourceNotFoundError(args.dataSourceId);
  }

  const ds = dataSourceToRuntime(dsMeta);

  const auth = await canQueryDataSource(args.uid, ds);
  if (!auth.canQuery) {
    throw new QueryDatasetAccessDeniedError(args.dataSourceId);
  }

  const viewerScope = await resolveViewerScope(args.uid, ds);
  const { csvBuffer, etag } = await (deps.readCsv ?? readDataSourceCsv)(dsMeta);

  const engine = await loadSource({
    source: ds,
    csvBuffer,
    viewerScope,
    etag,
    configVersion: dsMeta.configVersion,
  });

  // Substitui a referencia de tabela `view` (convencao do prompt) pelo
  // viewName interno determinístico ANTES de rodar. So troca em contexto de
  // tabela (apos FROM/JOIN) para nao afetar literais, quoted strings ou
  // colunas legítimas chamadas "view". O guardSql ainda valida a viewName real.
  const guardedSql = args.sql.replace(
    /\b(?:from|join)\s+view\b/gi,
    (match) => match.replace(/\bview\b/i, engine.viewName),
  );
  const result = await engine.run(guardedSql);
  return {
    columns: result.columns,
    rows: result.rows,
    truncated: result.truncated,
  };
}

/**
 * Leitura real do CSV da fonte: resolve a credencial GCS (AES-GCM) e le o
 * primeiro objeto .csv do prefixo da fonte. O md5Hash vira o etag de cache
 * do engine (P1.6).
 */
export async function readDataSourceCsv(
  dsMeta: DataSourceMetadata,
): Promise<ReadCsvResult> {
  const doc = await getDataSourceWithCredentials(dsMeta.id);
  if (!doc) {
    throw new DataSourceUnavailableError(`Fonte indisponivel: ${dsMeta.id}`);
  }

  // O blob criptografado (credentialEnc, AES-GCM em base64) ja veio no
  // documento server-only; conectamos um loader in-memory que resolve o
  // ref ao blob, em vez do loader default (que lanca "not implemented").
  // Assim o fluxo de producao descriptografa a credencial GCS de ponta a
  // ponta. O secretManager ainda nao esta implementado (SecretService.resolve
  // lanca), entao bloqueamos cedo se o ref for desse kind.
  if (doc.credentialRef.kind === "secretManager") {
    throw new DataSourceUnavailableError(
      `credentialRef secretManager ainda nao suportado para ${dsMeta.id}`,
    );
  }
  if (!doc.credentialEnc) {
    throw new DataSourceUnavailableError(
      `Fonte ${dsMeta.id} sem credentialEnc configurado`,
    );
  }

  const secretService = new SecretService({
    loadEncryptedBlob: async (ref: string) => {
      if (ref !== doc.credentialRef.ref) {
        throw new Error(`credentialRef ${ref} nao corresponde a fonte`);
      }
      return Buffer.from(doc.credentialEnc as string, "base64");
    },
  });
  const credentials = await secretService.resolve(doc.credentialRef);
  const storage = createGcsStorage({
    bucketName: doc.bucket,
    credentials,
  });

  const listed = await storage.list(doc.prefix);
  const csvObject = listed.objects.find((o) =>
    String(o.name).toLowerCase().endsWith(".csv"),
  );
  if (!csvObject) {
    throw new DataSourceUnavailableError(
      `Nenhum objeto CSV encontrado em ${doc.prefix}`,
    );
  }

  const { content, md5Hash } = await storage.readByKey(csvObject.name);
  return {
    csvBuffer: content,
    etag: md5Hash || csvObject.md5Hash || "",
  };
}
