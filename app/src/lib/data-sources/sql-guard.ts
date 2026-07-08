import { createRequire } from "node:module";

export type GuardSqlResult =
  | { ok: true; statementCount: number }
  | { ok: false; reason: string };

interface GuardSqlOptions {
  allowedViewName: string;
}

interface SqlParser {
  astify(sql: string, options?: Record<string, string>): unknown;
}

type ParserConstructor = new () => SqlParser;

const require = createRequire(import.meta.url);

const BLOCKED_FUNCTIONS = new Set([
  "read_csv",
  "read_csv_auto",
  "read_parquet",
  "read_json",
  "read_json_auto",
  "read_ndjson",
  "read_text",
  "read_blob",
  "read_xlsx",
  // Function scans de catalogo/raw que burlariam a VIEW filtrada e leriam a
  // raw table ou auth_keys (vazamento de owner emails/scope).
  "query_table",
  "query",
  "duckdb_tables",
  "duckdb_columns",
  "duckdb_functions",
  "pragma_table_info",
  "pragma_database_size",
  "sqlite_master",
  "sqlite_schema",
]);

const BLOCKED_FUNCTION_PREFIXES = [
  "read_csv",
  "read_parquet",
  "read_json",
  "read_ndjson",
  "read_text",
  "read_blob",
  "read_xlsx",
  "duckdb_",
  "pragma_",
  "sqlite_",
  "query_",
];

const BLOCKED_STATEMENT_TYPES = new Set([
  "alter",
  "attach",
  "call",
  "copy",
  "create",
  "delete",
  "drop",
  "export",
  "extension",
  "insert",
  "install",
  "load",
  "pragma",
  "set",
  "update",
]);

const CATALOG_SCHEMAS = new Set(["information_schema", "pg_catalog"]);
const SET_OPERATORS = new Set(["union", "intersect", "except"]);

export function guardSql(
  sql: string,
  opts: GuardSqlOptions,
): GuardSqlResult {
  const uncommentedSql = stripSqlComments(sql);
  const statements = splitUsefulStatements(uncommentedSql);

  if (statements.length !== 1) {
    return { ok: false, reason: "multi-statement proibido" };
  }

  const parser = loadParser();
  if (parser) {
    return guardWithAstParser(uncommentedSql, opts, parser);
  }

  if (!isTestRuntime()) {
    return { ok: false, reason: "pacote node-sql-parser não instalado" };
  }

  return guardWithFallbackTokenizer(statements[0] ?? "", opts);
}

function guardWithAstParser(
  sql: string,
  opts: GuardSqlOptions,
  parser: SqlParser,
): GuardSqlResult {
  try {
    const ast = parser.astify(sql, { database: "postgresql" });
    const statements = Array.isArray(ast) ? ast : [ast];

    if (statements.length !== 1) {
      return { ok: false, reason: "multi-statement proibido" };
    }

    const statement = statements[0];
    if (!isRecord(statement)) {
      return { ok: false, reason: "SQL inválido" };
    }

    const statementType = normalizedString(statement.type);
    if (statementType !== "select") {
      return {
        ok: false,
        reason: `statement proibido: ${statementType ?? "desconhecido"}`,
      };
    }

    const setOperator = findAstSetOperator(statement);
    if (setOperator) {
      return { ok: false, reason: `${setOperator.toUpperCase()} proibido` };
    }

    const blockedFunction = findAstBlockedFunction(statement);
    if (blockedFunction) {
      return {
        ok: false,
        reason: `função bloqueada: ${blockedFunction}`,
      };
    }

    const tableReason = validateAstSelect(
      statement,
      new Set(),
      opts.allowedViewName,
    );
    if (tableReason) return { ok: false, reason: tableReason };

    return { ok: true, statementCount: 1 };
  } catch (error) {
    return { ok: false, reason: `SQL inválido: ${errorMessage(error)}` };
  }
}

function validateAstSelect(
  node: unknown,
  outerCtes: Set<string>,
  allowedViewName: string,
): string | null {
  if (!isRecord(node)) return null;

  const statementType = normalizedString(node.type);
  if (statementType && statementType !== "select") {
    if (BLOCKED_STATEMENT_TYPES.has(statementType)) {
      return `statement proibido: ${statementType}`;
    }
    return null;
  }

  const ctes = new Set(outerCtes);
  const withEntries = arrayValue(node.with);
  for (const entry of withEntries) {
    const cteName = extractCteName(entry);
    if (cteName) ctes.add(cteName);
  }

  for (const entry of withEntries) {
    const cteStatement = extractCteStatement(entry);
    const reason = validateAstAny(cteStatement, ctes, allowedViewName);
    if (reason) return reason;
  }

  const fromReason = validateAstFromItems(node.from, ctes, allowedViewName);
  if (fromReason) return fromReason;

  for (const [key, value] of Object.entries(node)) {
    if (key === "with" || key === "from") continue;

    const reason = validateAstAny(value, ctes, allowedViewName);
    if (reason) return reason;
  }

  return null;
}

function validateAstAny(
  node: unknown,
  ctes: Set<string>,
  allowedViewName: string,
): string | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const reason = validateAstAny(item, ctes, allowedViewName);
      if (reason) return reason;
    }
    return null;
  }

  if (!isRecord(node)) return null;

  const statementType = normalizedString(node.type);
  if (statementType === "select") {
    return validateAstSelect(node, ctes, allowedViewName);
  }

  if (statementType && BLOCKED_STATEMENT_TYPES.has(statementType)) {
    return `statement proibido: ${statementType}`;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === "from" || key === "join") {
      const reason = validateAstFromItems(value, ctes, allowedViewName);
      if (reason) return reason;
      continue;
    }

    const reason = validateAstAny(value, ctes, allowedViewName);
    if (reason) return reason;
  }

  return null;
}

function validateAstFromItems(
  node: unknown,
  ctes: Set<string>,
  allowedViewName: string,
): string | null {
  if (!node) return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const reason = validateAstFromItems(item, ctes, allowedViewName);
      if (reason) return reason;
    }
    return null;
  }

  if (!isRecord(node)) return null;

  const subquery = firstSelectCandidate(node.expr, node.ast, node.stmt);
  if (subquery) {
    const reason = validateAstSelect(subquery, ctes, allowedViewName);
    if (reason) return reason;
  }

  // Function scans em FROM (ex.: query_table('auth_keys'), duckdb_tables(),
  // pragma_table_info(...)) burlariam a VIEW filtrada e leriam a raw table ou
  // auth_keys, vazando owner emails/scope. Bloqueamos por padrao: so relacoes
  // nomeadas ou subqueries sao autorizadas.
  const tableNode = node.table ?? node.expr;
  if (isRecord(tableNode)) {
    const tableType = normalizedString(tableNode.type);
    if (tableType === "function" || tableType === "call") {
      const fnName = astFunctionName(tableNode) ?? "desconhecida";
      return `function scan proibido: ${fnName}`;
    }
  }

  const relationName = identifierFromAst(node.table);
  const schemaName =
    identifierFromAst(node.db) ?? identifierFromAst(node.schema);

  if (relationName) {
    const blockedFunction = blockedFunctionName(relationName);
    if (blockedFunction) {
      return `função bloqueada: ${blockedFunction}`;
    }

    const catalogReason = catalogReasonFor(schemaName, relationName);
    if (catalogReason) return catalogReason;

    const cteAllowed = !schemaName && ctes.has(relationName);
    if (
      !cteAllowed &&
      !isAllowedRelation(schemaName, relationName, allowedViewName)
    ) {
      return `tabela não autorizada: ${formatRelationName(
        schemaName,
        relationName,
      )}`;
    }
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === "expr" || key === "ast" || key === "stmt") continue;
    if (key === "table" || key === "db" || key === "schema") continue;

    const reason = validateAstAny(value, ctes, allowedViewName);
    if (reason) return reason;
  }

  return null;
}

function findAstBlockedFunction(node: unknown): string | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const blocked = findAstBlockedFunction(item);
      if (blocked) return blocked;
    }
    return null;
  }

  if (!isRecord(node)) return null;

  const functionName = astFunctionName(node);
  if (functionName) {
    const blocked = blockedFunctionName(functionName);
    if (blocked) return blocked;
  }

  for (const value of Object.values(node)) {
    const blocked = findAstBlockedFunction(value);
    if (blocked) return blocked;
  }

  return null;
}

function astFunctionName(node: Record<string, unknown>): string | null {
  const type = normalizedString(node.type);
  if (
    type !== "function" &&
    type !== "aggr_func" &&
    type !== "window_func" &&
    type !== "call"
  ) {
    return null;
  }

  return identifierFromAst(node.name ?? node.function ?? node.func);
}

function findAstSetOperator(node: unknown): string | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const operator = findAstSetOperator(item);
      if (operator) return operator;
    }
    return null;
  }

  if (!isRecord(node)) return null;

  const type = normalizedString(node.type);
  if (type && SET_OPERATORS.has(type)) return type;

  for (const [key, value] of Object.entries(node)) {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey === "set_op" ||
      normalizedKey === "operator" ||
      normalizedKey === "union" ||
      normalizedKey === "intersect" ||
      normalizedKey === "except"
    ) {
      const normalizedValue = normalizedString(value);
      if (normalizedValue && SET_OPERATORS.has(normalizedValue)) {
        return normalizedValue;
      }
      if (normalizedKey !== "operator" && value) return normalizedKey;
    }

    const operator = findAstSetOperator(value);
    if (operator) return operator;
  }

  return null;
}

function guardWithFallbackTokenizer(
  statement: string,
  opts: GuardSqlOptions,
): GuardSqlResult {
  const tokens = tokenizeSql(statement);
  const firstWord = tokens.find((token) => token.kind !== "symbol");

  if (!firstWord) {
    return { ok: false, reason: "SQL inválido" };
  }

  const initial = tokenLower(firstWord);
  if (initial !== "select" && initial !== "with") {
    return { ok: false, reason: `statement proibido: ${initial}` };
  }

  for (const token of tokens) {
    const word = tokenLower(token);
    if (word && BLOCKED_STATEMENT_TYPES.has(word)) {
      return { ok: false, reason: `statement proibido: ${word}` };
    }
    if (word && SET_OPERATORS.has(word)) {
      return { ok: false, reason: `${word.toUpperCase()} proibido` };
    }
  }

  const ctes = collectFallbackCteNames(tokens);
  const blockedFunction = findFallbackBlockedFunction(tokens);
  if (blockedFunction) {
    return { ok: false, reason: `função bloqueada: ${blockedFunction}` };
  }

  const tableReason = validateFallbackTableRefs(
    tokens,
    ctes,
    opts.allowedViewName,
  );
  if (tableReason) return { ok: false, reason: tableReason };

  return { ok: true, statementCount: 1 };
}

function validateFallbackTableRefs(
  tokens: SqlToken[],
  ctes: Set<string>,
  allowedViewName: string,
): string | null {
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const word = tokenLower(token);
    if (word !== "from" && word !== "join") continue;

    const relationStart = nextRelationTokenIndex(tokens, index + 1);
    if (relationStart === null) continue;

    const first = tokens[relationStart];
    if (!first || first.value === "(") continue;

    const parsed = readFallbackRelation(tokens, relationStart);
    if (!parsed) continue;

    const blockedFunction = parsed.isFunctionScan
      ? blockedFunctionName(parsed.relationName)
      : null;
    if (blockedFunction) {
      return `função bloqueada: ${blockedFunction}`;
    }

    const catalogReason = catalogReasonFor(parsed.schemaName, parsed.relationName);
    if (catalogReason) return catalogReason;

    const cteAllowed = !parsed.schemaName && ctes.has(parsed.relationName);
    if (
      !cteAllowed &&
      !isAllowedRelation(
        parsed.schemaName,
        parsed.relationName,
        allowedViewName,
      )
    ) {
      return `tabela não autorizada: ${formatRelationName(
        parsed.schemaName,
        parsed.relationName,
      )}`;
    }
  }

  return null;
}

function nextRelationTokenIndex(
  tokens: SqlToken[],
  startIndex: number,
): number | null {
  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) return null;
    const word = tokenLower(token);
    if (word === "lateral" || word === "only") continue;
    if (token.kind !== "symbol" || token.value === "(") return index;
  }
  return null;
}

interface FallbackRelation {
  schemaName?: string;
  relationName: string;
  isFunctionScan: boolean;
}

function readFallbackRelation(
  tokens: SqlToken[],
  startIndex: number,
): FallbackRelation | null {
  const first = tokens[startIndex];
  if (!first || first.kind === "symbol") return null;

  const second = tokens[startIndex + 1];
  const third = tokens[startIndex + 2];
  if (second?.value === "." && third && third.kind !== "symbol") {
    return {
      schemaName: first.value,
      relationName: third.value,
      isFunctionScan: tokens[startIndex + 3]?.value === "(",
    };
  }

  return {
    relationName: first.value,
    isFunctionScan: second?.value === "(",
  };
}

function collectFallbackCteNames(tokens: SqlToken[]): Set<string> {
  const ctes = new Set<string>();
  const firstWord = tokens.findIndex((token) => tokenLower(token) === "with");
  if (firstWord === -1) return ctes;

  for (let index = firstWord + 1; index < tokens.length; index += 1) {
    const nameToken = tokens[index];
    if (!nameToken || nameToken.kind === "symbol") break;

    ctes.add(nameToken.value);
    index += 1;

    if (tokens[index]?.value === "(") {
      index = skipBalancedSymbols(tokens, index);
    }

    if (tokenLower(tokens[index]) !== "as") break;
    index += 1;

    if (tokens[index]?.value === "(") {
      index = skipBalancedSymbols(tokens, index);
    }

    if (tokens[index + 1]?.value !== ",") break;
    index += 1;
  }

  return ctes;
}

function findFallbackBlockedFunction(tokens: SqlToken[]): string | null {
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const functionName = tokenLower(token);
    if (!functionName || !BLOCKED_FUNCTIONS.has(functionName)) continue;

    if (tokens[index + 1]?.value === "(") {
      return functionName;
    }
  }

  return null;
}

function splitUsefulStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let index = 0;

  while (index < sql.length) {
    const char = sql[index] ?? "";

    if (char === "'") {
      const [literal, nextIndex] = readSingleQuoted(sql, index);
      current += literal;
      index = nextIndex;
      continue;
    }

    if (char === '"') {
      const [identifier, nextIndex] = readDoubleQuoted(sql, index);
      current += identifier;
      index = nextIndex;
      continue;
    }

    const dollarQuote = dollarQuoteTagAt(sql, index);
    if (dollarQuote) {
      const [literal, nextIndex] = readDollarQuoted(sql, index, dollarQuote);
      current += literal;
      index = nextIndex;
      continue;
    }

    if (char === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
      index += 1;
      continue;
    }

    current += char;
    index += 1;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

function stripSqlComments(sql: string): string {
  let output = "";
  let index = 0;

  while (index < sql.length) {
    const char = sql[index] ?? "";
    const next = sql[index + 1] ?? "";

    if (char === "'") {
      const [literal, nextIndex] = readSingleQuoted(sql, index);
      output += literal;
      index = nextIndex;
      continue;
    }

    if (char === '"') {
      const [identifier, nextIndex] = readDoubleQuoted(sql, index);
      output += identifier;
      index = nextIndex;
      continue;
    }

    const dollarQuote = dollarQuoteTagAt(sql, index);
    if (dollarQuote) {
      const [literal, nextIndex] = readDollarQuoted(sql, index, dollarQuote);
      output += literal;
      index = nextIndex;
      continue;
    }

    if (char === "-" && next === "-") {
      output += " ";
      index += 2;
      while (index < sql.length && sql[index] !== "\n") index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      output += " ";
      index += 2;
      while (index < sql.length) {
        if (sql[index] === "*" && sql[index + 1] === "/") {
          index += 2;
          break;
        }
        output += sql[index] === "\n" ? "\n" : " ";
        index += 1;
      }
      continue;
    }

    output += char;
    index += 1;
  }

  return output;
}

interface SqlToken {
  kind: "word" | "identifier" | "symbol";
  value: string;
}

function tokenizeSql(sql: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  let index = 0;

  while (index < sql.length) {
    const char = sql[index] ?? "";

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === "'") {
      const [, nextIndex] = readSingleQuoted(sql, index);
      index = nextIndex;
      continue;
    }

    if (char === '"') {
      const [identifier, nextIndex] = readDoubleQuoted(sql, index);
      tokens.push({
        kind: "identifier",
        value: identifier.slice(1, -1).replaceAll('""', '"'),
      });
      index = nextIndex;
      continue;
    }

    const dollarQuote = dollarQuoteTagAt(sql, index);
    if (dollarQuote) {
      const [, nextIndex] = readDollarQuoted(sql, index, dollarQuote);
      index = nextIndex;
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const start = index;
      index += 1;
      while (index < sql.length && /[A-Za-z0-9_$]/.test(sql[index] ?? "")) {
        index += 1;
      }
      tokens.push({ kind: "word", value: sql.slice(start, index) });
      continue;
    }

    tokens.push({ kind: "symbol", value: char });
    index += 1;
  }

  return tokens;
}

function readSingleQuoted(sql: string, startIndex: number): [string, number] {
  let index = startIndex + 1;

  while (index < sql.length) {
    if (sql[index] === "'" && sql[index + 1] === "'") {
      index += 2;
      continue;
    }
    if (sql[index] === "'") return [sql.slice(startIndex, index + 1), index + 1];
    index += 1;
  }

  return [sql.slice(startIndex), sql.length];
}

function readDoubleQuoted(sql: string, startIndex: number): [string, number] {
  let index = startIndex + 1;

  while (index < sql.length) {
    if (sql[index] === '"' && sql[index + 1] === '"') {
      index += 2;
      continue;
    }
    if (sql[index] === '"') return [sql.slice(startIndex, index + 1), index + 1];
    index += 1;
  }

  return [sql.slice(startIndex), sql.length];
}

function dollarQuoteTagAt(sql: string, index: number): string | null {
  if (sql[index] !== "$") return null;
  const match = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(index));
  return match?.[0] ?? null;
}

function readDollarQuoted(
  sql: string,
  startIndex: number,
  tag: string,
): [string, number] {
  const endIndex = sql.indexOf(tag, startIndex + tag.length);
  if (endIndex === -1) return [sql.slice(startIndex), sql.length];
  const nextIndex = endIndex + tag.length;
  return [sql.slice(startIndex, nextIndex), nextIndex];
}

function skipBalancedSymbols(tokens: SqlToken[], startIndex: number): number {
  let depth = 0;
  for (let index = startIndex; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token?.value === "(") depth += 1;
    if (token?.value === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return tokens.length - 1;
}

function loadParser(): SqlParser | null {
  try {
    const parserModule = require("node-sql-parser") as {
      Parser?: ParserConstructor;
      default?: { Parser?: ParserConstructor };
    };
    const Parser = parserModule.Parser ?? parserModule.default?.Parser;
    return Parser ? new Parser() : null;
  } catch {
    return null;
  }
}

function extractCteName(node: unknown): string | null {
  if (!isRecord(node)) return null;
  return identifierFromAst(node.name ?? node.table ?? node.alias);
}

function extractCteStatement(node: unknown): unknown {
  if (!isRecord(node)) return null;
  return node.stmt ?? node.statement ?? node.ast ?? node.expr;
}

function firstSelectCandidate(...values: unknown[]): Record<string, unknown> | null {
  for (const value of values) {
    if (isRecord(value) && normalizedString(value.type) === "select") {
      return value;
    }
    if (isRecord(value) && isRecord(value.ast)) {
      const nested = firstSelectCandidate(value.ast);
      if (nested) return nested;
    }
  }
  return null;
}

function identifierFromAst(value: unknown): string | null {
  if (typeof value === "string") return unquoteIdentifier(value);
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => identifierFromAst(item))
      .filter((item): item is string => Boolean(item));
    return parts.length > 0 ? parts.join(".") : null;
  }
  if (!isRecord(value)) return null;

  return identifierFromAst(
    value.value ??
      value.name ??
      value.table ??
      value.column ??
      value.expr ??
      value.id,
  );
}

function unquoteIdentifier(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replaceAll('""', '"');
  }
  return trimmed;
}

function normalizedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.toLowerCase();
}

function tokenLower(token: SqlToken | undefined): string | null {
  if (!token || token.kind === "symbol") return null;
  return token.value.toLowerCase();
}

function blockedFunctionName(functionName: string): string | null {
  const normalized = functionName.split(".").at(-1)?.toLowerCase() ?? "";
  if (BLOCKED_FUNCTIONS.has(normalized)) return normalized;
  if (BLOCKED_FUNCTION_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return normalized;
  }
  return null;
}

function catalogReasonFor(
  schemaName: string | undefined | null,
  relationName: string,
): string | null {
  const schema = schemaName?.toLowerCase();
  const relation = relationName.toLowerCase();
  if (
    (schema && CATALOG_SCHEMAS.has(schema)) ||
    CATALOG_SCHEMAS.has(relation)
  ) {
    return "catálogo proibido";
  }
  return null;
}

function isAllowedRelation(
  schemaName: string | undefined | null,
  relationName: string,
  allowedViewName: string,
): boolean {
  const schemaAllowed = !schemaName || schemaName === "main";
  return schemaAllowed && relationName === allowedViewName;
}

function formatRelationName(
  schemaName: string | undefined | null,
  relationName: string,
): string {
  return schemaName ? `${schemaName}.${relationName}` : relationName;
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}
