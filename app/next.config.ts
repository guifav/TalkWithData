import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["firebase-admin", "@duckdb/node-api", "@duckdb/node-bindings"],
};

export default nextConfig;
