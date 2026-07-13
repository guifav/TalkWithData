import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd(),
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: [
    "firebase-admin",
    "@duckdb/node-api",
    "@duckdb/node-bindings",
    "exceljs",
    "unzipper",
  ],
};

export default nextConfig;
