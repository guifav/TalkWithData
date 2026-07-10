import { describe, expect, it } from "vitest";
import {
  DataSourceKind,
  DataSourceRegistry,
  type DataSource,
} from "@/lib/data-sources";

const csvSource = (overrides: Partial<DataSource> = {}): DataSource => ({
  id: "source-a",
  kind: DataSourceKind.CSV,
  orgId: "org-a",
  configVersion: 1,
  ...overrides,
});

describe("DataSourceKind", () => {
  it("defines CSV as csv", () => {
    expect(DataSourceKind.CSV).toBe("csv");
  });
});

describe("DataSourceRegistry", () => {
  it("registers and gets a data source", () => {
    const registry = new DataSourceRegistry();
    const source = csvSource({ ownerColumn: "owner_email" });

    registry.register(source);

    expect(registry.get(source.id)).toBe(source);
    expect(registry.get(source.id).ownerColumn).toBe("owner_email");
  });

  it("throws when registering a duplicate id", () => {
    const registry = new DataSourceRegistry();
    const source = csvSource();

    registry.register(source);

    expect(() => registry.register(csvSource({ orgId: "org-b" }))).toThrowError(
      /Fonte de dados já registrada: source-a/,
    );
  });

  it("throws when getting an unknown id", () => {
    const registry = new DataSourceRegistry();

    expect(() => registry.get("missing-source")).toThrowError(
      /Fonte de dados não encontrada: missing-source/,
    );
  });

  it("lists only data sources for the requested org", () => {
    const registry = new DataSourceRegistry();
    const orgAFirst = csvSource({ id: "source-b", orgId: "org-a" });
    const orgASecond = csvSource({ id: "source-a", orgId: "org-a" });
    const orgB = csvSource({ id: "source-c", orgId: "org-b" });

    registry.register(orgAFirst);
    registry.register(orgB);
    registry.register(orgASecond);

    expect(registry.list("org-a")).toEqual([orgASecond, orgAFirst]);
  });

  it("returns empty array when the org has no sources", () => {
    const registry = new DataSourceRegistry();
    registry.register(csvSource({ id: "source-x", orgId: "org-b" }));

    expect(registry.list("org-a")).toEqual([]);
  });
});
