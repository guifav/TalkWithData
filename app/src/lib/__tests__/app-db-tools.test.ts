import { describe, it, expect } from "vitest";
import { APP_DB_TOOLS, APP_DB_TOOL_NAMES, isAppDbTool } from "@/lib/app-db/tools";
process.env.ALLOWED_AUTH_DOMAIN = "example.com";
process.env.STORAGE_BUCKET_NAME = "test-bucket";

describe("APP_DB_TOOLS", () => {
  it("has exactly 9 tools", () => {
    expect(APP_DB_TOOLS.length).toBe(9);
  });

  it("all tools have name, description, and input_schema", () => {
    for (const tool of APP_DB_TOOLS) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.input_schema).toBeTruthy();
      expect(tool.input_schema.type).toBe("object");
    }
  });

  it("has the expected tool names", () => {
    const names = APP_DB_TOOLS.map((t) => t.name);
    expect(names).toContain("ensure_dashboard_database");
    expect(names).toContain("describe_dashboard_database");
    expect(names).toContain("create_dashboard_table");
    expect(names).toContain("add_dashboard_columns");
    expect(names).toContain("list_dashboard_tables");
    expect(names).toContain("read_dashboard_rows");
    expect(names).toContain("insert_dashboard_rows");
    expect(names).toContain("update_dashboard_rows");
    expect(names).toContain("delete_dashboard_rows");
  });

  it("no tool names collide with common MCP tool names", () => {
    const mcpLikeNames = [
      "contact_search",
      "get_profile",
      "run_query",
      "save_dashboard_html",
    ];
    for (const name of mcpLikeNames) {
      expect(APP_DB_TOOL_NAMES.has(name)).toBe(false);
    }
  });
});

describe("isAppDbTool", () => {
  it("returns true for app-db tools", () => {
    expect(isAppDbTool("ensure_dashboard_database")).toBe(true);
    expect(isAppDbTool("insert_dashboard_rows")).toBe(true);
  });

  it("returns false for non app-db tools", () => {
    expect(isAppDbTool("save_dashboard_html")).toBe(false);
    expect(isAppDbTool("contact_search")).toBe(false);
    expect(isAppDbTool("random_tool")).toBe(false);
  });
});
