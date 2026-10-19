import type { MediaKind } from "@/features/blogs/editor/media-node"
import { uploadToCloudinary } from "@/features/posts/lib/cloudinary-upload"
import { requestBlogImageUpload, requestBlogVideoUpload } from "@/features/blogs/lib/blogs-api"
import {
  BLOG_IMAGE_TYPES,
  MAX_BLOG_IMAGE_MB,
  MAX_BLOG_VIDEO_MB,
} from "@/features/blogs/schemas"
import { uploadToStorage } from "@/features/shared/lib/storage-upload"

/** A reason to show the author, not a bug: the file can't go in a blog. */
export class MediaRejectedError extends Error {}


export function mediaKindOf(file: File): MediaKind | null {
  if ((BLOG_IMAGE_TYPES as readonly string[]).includes(file.type)) return "image"
  if (file.type.startsWith("video/")) return "video"
  return null
}

/** Sends an image to RustFS; resolves to its public URL. */
export async function uploadBlogImage(token: string, file: File, signal?: AbortSignal) {
  if (file.size > MAX_BLOG_IMAGE_MB * 1024 * 1024) {
    throw new MediaRejectedError(`Ảnh tối đa ${MAX_BLOG_IMAGE_MB} MB.`)
  }
  const { upload, url } = await requestBlogImageUpload(token, file)
  await uploadToStorage(upload, file, { signal })
  return url
}

/** Sends a video straight to Cloudinary (chunked when large); resolves to its public MP4 URL. */
export async function uploadBlogVideo(
  token: string,
  file: File,
  onProgress: (percent: number) => void
) {
  if (file.size > MAX_BLOG_VIDEO_MB * 1024 * 1024) {
    throw new MediaRejectedError(`Video tối đa ${MAX_BLOG_VIDEO_MB} MB.`)
  }
  const { upload, url } = await requestBlogVideoUpload(token)
  await uploadToCloudinary(upload, file, onProgress).done
  return url
}
