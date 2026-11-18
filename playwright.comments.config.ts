import { defineConfig } from "@playwright/test"
import focused from "./playwright.messaging.config"

export default defineConfig({
  ...focused,
  testDir: "./e2e",
  testMatch: [
    "**/public/post-detail.spec.ts",
    "**/public/comment-replies.spec.ts",
    "**/home/notifications.spec.ts",
  ],
})
