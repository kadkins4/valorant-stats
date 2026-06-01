import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // `any` is intentional at the untyped-data boundary: raw HenrikDev API
  // payloads and the snapshot mirrors of them. The transformed outputs
  // (MatchRow, MatchSummary, RankPoint, …) are fully typed — only the inbound
  // shapes are `any`.
  {
    files: [
      "lib/henrik.ts",
      "lib/transform.ts",
      "lib/snapshot.ts",
      "lib/db/queries.ts",
      "scripts/**/*.ts",
      "lib/maps/calibration.ts",
    ],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
