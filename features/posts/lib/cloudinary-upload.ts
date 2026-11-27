import type { VideoUploadTarget } from "@/features/posts/schemas"

export class CloudinaryUploadError extends Error {}

export type UploadTask = {
  done: Promise<void>
  abort: () => void
}

export function uploadToCloudinary(
  { url, fields, chunkSize }: VideoUploadTarget["upload"],
  file: File,
  onProgress: (percent: number) => void
): UploadTask {
  const uploadId = crypto.randomUUID()
  let current: XMLHttpRequest | null = null
  let aborted = false

  function sendChunk(start: number): Promise<void> {
    const end = Math.min(start + chunkSize, file.size)
    const body = new FormData()
    for (const [key, value] of Object.entries(fields)) body.set(key, value)
    body.set("file", file.slice(start, end), file.name)

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      current = xhr
      xhr.open("POST", url)
      if (file.size > chunkSize) {
        xhr.setRequestHeader("X-Unique-Upload-Id", uploadId)
        xhr.setRequestHeader("Content-Range", `bytes ${start}-${end - 1}/${file.size}`)
      }
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(((start + (event.loaded / event.total) * (end - start)) / file.size) * 100)
        }
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
          return
        }
        let message = `Upload answered ${xhr.status}`
        try {
          message = (JSON.parse(xhr.responseText) as { error?: { message?: string } }).error?.message ?? message
        } catch {
        }
        reject(new CloudinaryUploadError(message))
      }
      xhr.onerror = () => reject(new Error("Network error while uploading"))
      xhr.onabort = () => reject(new DOMException("Upload aborted", "AbortError"))
      xhr.send(body)
    })
  }

  async function run() {
    for (let start = 0; start < file.size; start += chunkSize) {
      if (aborted) throw new DOMException("Upload aborted", "AbortError")
      await sendChunk(start)
    }
    onProgress(100)
  }

  return {
    done: run(),
    abort: () => {
      aborted = true
      current?.abort()
    },
  }
}
