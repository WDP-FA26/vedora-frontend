import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const root = fileURLToPath(new URL("../..", import.meta.url))

export default defineConfig({
  root,
  resolve: {
    alias: { "@": root },
  },
  test: {
    include: ["scripts/voice-sim/**/*.sim.ts"],
    environment: "node",
    testTimeout: 600_000,
    env: {
      NEXT_PUBLIC_API_URL: process.env.VOICE_SIM_API_URL ?? "http://localhost:4000/api/v1",
      NEXT_PUBLIC_STORAGE_URL: "http://storage.test",
      NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "test",
    },
  },
})
