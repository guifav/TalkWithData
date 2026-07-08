export enum DataSourceKind {
  CSV = "csv",
}

export interface DataSource {
  id: string;
  kind: DataSourceKind;
  orgId: string;
  configVersion: number;
  ownerColumn?: string;
}
