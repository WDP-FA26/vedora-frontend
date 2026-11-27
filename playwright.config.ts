import { defineConfig, devices } from "@playwright/test"

const API_PORT = Number(process.env.E2E_API_PORT ?? 4010)
const API_URL = `http://localhost:${API_PORT}/api/v1`

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4,
  globalSetup: "./e2e/global-setup.ts",
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      name: "mock-api",
      command: "node e2e/mock-api/server.mjs",
      url: `http://localhost:${API_PORT}/health`,
      reuseExistingServer: true,
      env: { E2E_API_PORT: String(API_PORT) },
    },
    {
      name: "next",
      command: "pnpm dev",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 180_000,
      env: {
        NEXT_PUBLIC_API_URL: API_URL,
        NEXT_PUBLIC_STORAGE_URL: "http://localhost:9000",
        NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "e2e-test",
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "",
      },
    },
  ],
})
