import { defineConfig } from "@playwright/test"
import base from "./playwright.messaging.config"

export default defineConfig({
  ...base,
  testDir: "./e2e",
  testMatch: ["drafts/**/*.spec.ts", "home/feed.spec.ts", "home/navigation.spec.ts"],
})
