import AwsS3 from "@uppy/aws-s3"
import Uppy from "@uppy/core"
import { z } from "zod"

export const presignedUploadSchema = z.object({
  url: z.string(),
  method: z.literal("PUT"),
  headers: z.record(z.string(), z.string()),
  expiresAt: z.string(),
})

export type PresignedUpload = z.infer<typeof presignedUploadSchema>

export async function uploadToStorage(
  upload: PresignedUpload,
  file: File,
  options: { signal?: AbortSignal; onProgress?: (percent: number) => void } = {}
) {
  const uppy = new Uppy().use(AwsS3, {
    shouldUseMultipart: false,
    signRequest: async () => ({ url: upload.url, headers: upload.headers }),
  })
  const cancel = () => uppy.cancelAll()
  try {
    options.signal?.throwIfAborted()
    options.signal?.addEventListener("abort", cancel, { once: true })
    uppy.on("upload-progress", (_, { bytesUploaded, bytesTotal }) => {
      if (bytesTotal) options.onProgress?.((Number(bytesUploaded) / bytesTotal) * 100)
    })
    uppy.addFile({ name: file.name, type: file.type, data: file })
    const result = await uppy.upload()
    options.signal?.throwIfAborted()
    const failed = result?.failed?.[0]
    if (failed) throw new Error(String(failed.error ?? "Upload failed"))
  } finally {
    options.signal?.removeEventListener("abort", cancel)
    uppy.destroy()
  }
}
