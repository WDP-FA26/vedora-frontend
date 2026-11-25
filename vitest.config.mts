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
    // lib/env.ts validates these at import; tests never reach the services behind them.
    env: {
      NEXT_PUBLIC_API_URL: "http://api.test/api/v1",
      NEXT_PUBLIC_STORAGE_URL: "http://storage.test",
      NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "test",
    },
  },
})
