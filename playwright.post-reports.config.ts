import { defineConfig } from "@playwright/test"
import focused from "./playwright.messaging.config"

export default defineConfig({
  ...focused,
  testDir: "./e2e",
  testMatch: [
    "**/public/post-report-evidence.spec.ts",
    "**/admin/post-report-evidence.spec.ts",
    "**/public/comment-reports.spec.ts",
    "**/admin/comment-reports.spec.ts",
  ],
})
