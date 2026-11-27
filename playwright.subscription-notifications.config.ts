import { defineConfig } from "@playwright/test"
import focused from "./playwright.messaging.config"

export default defineConfig({
  ...focused,
  testDir: "./e2e",
  testMatch: ["**/home/subscription-notifications.spec.ts", "**/home/notifications.spec.ts", "**/home/comment-notifications.spec.ts"],
})
