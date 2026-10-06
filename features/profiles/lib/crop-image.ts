export type CropArea = { x: number; y: number; width: number; height: number }

export async function cropImage(file: File, area: CropArea, maxWidth: number): Promise<File> {
  const scale = Math.min(1, maxWidth / area.width)
  const width = Math.round(area.width * scale)
  const height = Math.round(area.height * scale)
  const bitmap = await createImageBitmap(file, area.x, area.y, area.width, area.height)
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Canvas 2D is unavailable")
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  // Browsers that can't encode WebP fall back to PNG; name the file to match.
  const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.9 })
  const extension = blob.type.replace("image/", "")
  return new File([blob], `${file.name.replace(/\.[^.]*$/, "")}.${extension}`, {
    type: blob.type,
  })
}
