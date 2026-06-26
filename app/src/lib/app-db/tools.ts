/**
 * App Database Tools — structured tool definitions for the AI agent.
 *
 * These tools are injected into the Claude conversation alongside MCP tools.
 * They are LOCAL tools (not routed to MCP endpoints) — the backend handles
 * them directly in the ai/chat route.
 *
 * Security: ownerUid, dashboardId, schema, and tablePrefix are NEVER
 * provided by the model. They are resolved from the authenticated session.
 */

// ─── Tool Definitions ────────────────────────────────────────────────────────

export const APP_DB_TOOLS = [
  {
    name: "ensure_dashboard_database",
    description:
      "Initialize or verify the database scope for the current dashboard. " +
      "Call this before any other database operation. Returns the current status " +
      "and list of existing tables with their columns.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "describe_dashboard_database",
    description:
      "Get the current state of the dashboard's database: list of tables, " +
      "their columns, row counts, and schema version.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "create_dashboard_table",
    description:
      "Create a new table in the dashboard's database. Every table automatically " +
      "includes id (UUID), created_at, and updated_at columns. Only add your " +
      "custom columns. Use clear, singular entity names (e.g. 'cliente', 'pedido').",
    input_schema: {
      type: "object" as const,
      properties: {
        logical_name: {
          type: "string",
          description:
            "Friendly table name (e.g. 'cliente', 'pedido'). " +
            "Must start with a letter, only a-z, 0-9, underscore. Max 32 chars.",
        },
        columns: {
          type: "array",
          description: "List of custom columns to add.",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Column name (a-z, 0-9, underscore)",
              },
              type: {
                type: "string",
                enum: [
                  "text",
                  "integer",
                  "bigint",
                  "decimal",
                  "boolean",
                  "date",
                  "timestamp",
                  "json",
                  "uuid",
                ],
                description: "Column data type",
              },
              nullable: {
                type: "boolean",
                description: "Whether NULL is allowed (default: true)",
              },
            },
            required: ["name", "type"],
          },
        },
      },
      required: ["logical_name", "columns"],
    },
  },
  {
    name: "add_dashboard_columns",
    description:
      "Add new columns to an existing table. Cannot modify or remove existing columns.",
    input_schema: {
      type: "object" as const,
      properties: {
        table_name: {
          type: "string",
          description: "Logical table name (e.g. 'cliente')",
        },
        columns: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              type: {
                type: "string",
                enum: [
                  "text",
                  "integer",
                  "bigint",
                  "decimal",
                  "boolean",
                  "date",
                  "timestamp",
                  "json",
                  "uuid",
                ],
              },
              nullable: { type: "boolean" },
            },
            required: ["name", "type"],
          },
        },
      },
      required: ["table_name", "columns"],
    },
  },
  {
    name: "list_dashboard_tables",
    description:
      "List all tables in the current dashboard's database with row counts.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "read_dashboard_rows",
    description:
      "Read rows from a table with optional ordering and pagination. " +
      "Returns up to 100 rows per call (max 1000).",
    input_schema: {
      type: "object" as const,
      properties: {
        table_name: {
          type: "string",
          description: "Logical table name",
        },
        order_by: {
          type: "string",
          description: "Column to sort by (default: created_at)",
        },
        order_dir: {
          type: "string",
          enum: ["ASC", "DESC"],
          description: "Sort direction (default: DESC)",
        },
        limit: {
          type: "integer",
          description: "Number of rows to return (default: 100, max: 1000)",
        },
        offset: {
          type: "integer",
          description: "Number of rows to skip (default: 0)",
        },
      },
      required: ["table_name"],
    },
  },
  {
    name: "insert_dashboard_rows",
    description:
      "Insert one or more rows into a table. Each row is an object with " +
      "column names as keys. The 'id', 'created_at', and 'updated_at' columns " +
      "are auto-generated — do not include them.",
    input_schema: {
      type: "object" as const,
      properties: {
        table_name: {
          type: "string",
          description: "Logical table name",
        },
        rows: {
          type: "array",
          description: "Array of row objects",
          items: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
      required: ["table_name", "rows"],
    },
  },
  {
    name: "update_dashboard_rows",
    description:
      "Update one or more rows by their id. Each update specifies the row id " +
      "and the fields to change.",
    input_schema: {
      type: "object" as const,
      properties: {
        table_name: {
          type: "string",
          description: "Logical table name",
        },
        updates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: {
                type: "string",
                description: "Row UUID",
              },
              data: {
                type: "object",
                additionalProperties: true,
                description: "Fields to update",
              },
            },
            required: ["id", "data"],
          },
        },
      },
      required: ["table_name", "updates"],
    },
  },
  {
    name: "delete_dashboard_rows",
    description:
      "Delete one or more rows by their id.",
    input_schema: {
      type: "object" as const,
      properties: {
        table_name: {
          type: "string",
          description: "Logical table name",
        },
        ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of row UUIDs to delete",
        },
      },
      required: ["table_name", "ids"],
    },
  },
] as const;

/** Set of all app-db tool names for quick lookup */
export const APP_DB_TOOL_NAMES = new Set<string>(APP_DB_TOOLS.map((t) => t.name));

/** Check if a tool name is an app-db tool */
export function isAppDbTool(name: string): boolean {
  return APP_DB_TOOL_NAMES.has(name);
}
