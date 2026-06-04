import { defineConfig } from "@playwright/test";

const PORT = process.env.TEST_PORT ?? "3000";

export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.ts",
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: { baseURL: `http://localhost:${PORT}` },
});
