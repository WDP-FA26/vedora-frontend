import { defineConfig } from "@playwright/test"
import focused from "./playwright.messaging.config"

export default defineConfig({
  ...focused,
  testDir: "./e2e",
  testMatch: ["**/admin/vietnam-timezone.spec.ts"],
})
