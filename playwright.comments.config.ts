import { defineConfig } from "@playwright/test"
import focused from "./playwright.messaging.config"

export default defineConfig({
  ...focused,
  testDir: "./e2e",
  testMatch: [
    "**/public/post-detail.spec.ts",
    "**/public/comment-replies.spec.ts",
    "**/public/comment-reports.spec.ts",
    "**/admin/comment-reports.spec.ts",
    "**/home/notifications.spec.ts",
  ],
})
