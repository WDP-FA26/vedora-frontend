import { defineConfig } from "@playwright/test"
import { join } from "node:path"
import base from "./playwright.config"

const root = process.cwd()
const servers = Array.isArray(base.webServer) ? base.webServer : []

export default defineConfig({
  ...base,
  testDir: "./e2e/messages",
  globalSetup: undefined,
  workers: 1,
  reporter: [["list"]],
  webServer: servers.map((server) => ({
    ...server,
    cwd: root,
    reuseExistingServer: false,
    command:
      server.name === "next"
        ? `"${process.execPath}" "${join(root, "node_modules/next/dist/bin/next")}" dev`
        : `"${process.execPath}" "${join(root, "e2e/mock-api/server.mjs")}"`,
  })),
})
