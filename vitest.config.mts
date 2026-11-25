import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Unit tests for logic without a browser; the app itself is tested end to end with Playwright (e2e/).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", "e2e/**", ".next/**"],
  },
})
