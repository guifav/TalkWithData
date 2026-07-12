import { configDefaults, defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    exclude: [...configDefaults.exclude, "e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/__tests__/**",
        "src/**/*.d.ts",
        "src/generated/**",
        "src/lib/types.ts",
        "src/components/ui/**",
      ],
      thresholds: {
        "src/app/api/admin/ai-config/route.ts": {
          statements: 95,
          branches: 95,
          functions: 95,
          lines: 95,
        },
        "src/app/api/auth/init/route.ts": {
          statements: 70,
          branches: 50,
          functions: 60,
          lines: 70,
        },
        "src/app/api/dashboards/**/data/**": {
          statements: 85,
          branches: 75,
          functions: 95,
          lines: 85,
        },
        "src/app/api/dashboards/**/view{,/**}/route.ts": {
          statements: 55,
          branches: 45,
          functions: 20,
          lines: 55,
        },
        "src/app/api/admin/data-sources/**": {
          statements: 65,
          branches: 60,
          functions: 85,
          lines: 65,
        },
        "src/lib/{api-auth,data-api-auth,dash-session}.ts": {
          statements: 85,
          branches: 85,
          functions: 95,
          lines: 85,
        },
        "src/lib/ai-config-secrets.ts": {
          statements: 75,
          branches: 70,
          functions: 80,
          lines: 80,
        },
        "src/lib/data-sources/{credentials,firestore,inspection-token,storage}.ts": {
          statements: 72,
          branches: 60,
          functions: 75,
          lines: 72,
        },
        "src/lib/{storage-provider,data-sources/storage}.ts": {
          statements: 55,
          branches: 40,
          functions: 50,
          lines: 55,
        },
        "src/lib/readiness.ts": {
          statements: 90,
          branches: 85,
          functions: 75,
          lines: 90,
        },
        "src/lib/observability.ts": {
          statements: 90,
          branches: 90,
          functions: 95,
          lines: 90,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
