import { defineConfig } from "@playwright/test"
import focused from "./playwright.messaging.config"

export default defineConfig({
  ...focused,
  testDir: "./e2e",
  testMatch: ["**/admin/subscription-plans.spec.ts", "**/admin/subscription-grants.spec.ts"],
})
