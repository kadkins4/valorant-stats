import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Resolve the "@/..." path alias (mirrors tsconfig paths) so tests can
  // import application modules the same way the app does.
  resolve: { alias: { "@": import.meta.dirname } },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
});
