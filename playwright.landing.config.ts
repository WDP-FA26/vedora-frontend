import { defineConfig } from "@playwright/test"
import focused from "./playwright.messaging.config"

export default defineConfig({
  ...focused,
  testDir: "./e2e/public",
  testMatch: ["landing.spec.ts", "guest-chat.spec.ts"],
})
