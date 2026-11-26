import { copyFileSync, existsSync, mkdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const assetsRoot = join(root, "node_modules/@workadventure/noise-suppression/dist/assets")
const targetDir = join(root, "public/deepfilternet")

const FILES = [
  ["deepfilternet-worklet-processor.js", "deepfilternet-worklet-processor.js"],
  ["deepfilternet/df_bg.wasm", "df_bg.wasm"],
  ["deepfilternet/DeepFilterNet3_onnx.tar.gz", "DeepFilterNet3_onnx.tar.gz"],
]

if (!existsSync(assetsRoot)) {
  console.warn("[sync-deepfilternet-assets] @workadventure/noise-suppression assets not found; skipping.")
  process.exit(0)
}

mkdirSync(targetDir, { recursive: true })
for (const [srcRel, dstName] of FILES) {
  const src = join(assetsRoot, srcRel)
  const dst = join(targetDir, dstName)
  if (!existsSync(src)) {
    throw new Error(`Missing DeepFilterNet3 asset: ${src}`)
  }
  copyFileSync(src, dst)
}
