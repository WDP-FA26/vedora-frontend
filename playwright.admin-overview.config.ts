import { defineConfig } from "@playwright/test"
import focused from "./playwright.messaging.config"

export default defineConfig({
  ...focused,
  testDir: "./e2e",
  testMatch: [
    "**/admin/overview.spec.ts",
    "**/admin/comment-reports.spec.ts",
    "**/admin/post-report-evidence.spec.ts",
  ],
})
