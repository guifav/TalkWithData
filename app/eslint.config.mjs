import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    settings: {
      react: {
        // Evita o autodetect do eslint-plugin-react, que usa API removida no ESLint 10.
        version: "19.2.7",
      },
    },
    rules: {
      // React Compiler rules are too strict for the imported legacy codebase.
      // Keep ESLint active, but downgrade the compiler migration to follow-up work.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      "react-hooks/exhaustive-deps": "warn",
      "react/no-unescaped-entities": "off",
    },
  },
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts"]),
]);
