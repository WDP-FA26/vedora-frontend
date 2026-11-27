import type { MediaKind } from "@/features/blogs/editor/media-node"
import { uploadToCloudinary } from "@/features/posts/lib/cloudinary-upload"
import { requestBlogImageUpload, requestBlogVideoUpload } from "@/features/blogs/lib/blogs-api"
import {
  BLOG_IMAGE_TYPES,
  MAX_BLOG_IMAGE_MB,
  MAX_BLOG_VIDEO_MB,
} from "@/features/blogs/schemas"
import { uploadToStorage } from "@/features/shared/lib/storage-upload"
import { PUBLIC_ENV } from "@/lib/env"

const STORAGE_ORIGIN = new URL(PUBLIC_ENV.storageUrl).origin
const BLOG_VIDEO_PREFIX = `https://res.cloudinary.com/${PUBLIC_ENV.cloudinaryCloudName}/video/upload/`

export function isSystemBlogImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.origin === STORAGE_ORIGIN && !parsed.pathname.split("/").includes("..")
  } catch {
    return false
  }
}

export function isSystemBlogVideoUrl(url: string): boolean {
  if (!url.startsWith(BLOG_VIDEO_PREFIX)) return false
  const rest = url.slice(BLOG_VIDEO_PREFIX.length).split(/[?#]/)[0] ?? ""
  return (
    !rest.split("/").includes("..") &&
    (rest.startsWith("blog-videos/") || rest.includes("/blog-videos/"))
  )
}

export function isAllowedBlogMediaUrl(url: string): boolean {
  return isSystemBlogImageUrl(url) || isSystemBlogVideoUrl(url)
}

export class MediaRejectedError extends Error {}


export function mediaKindOf(file: File): MediaKind | null {
  if ((BLOG_IMAGE_TYPES as readonly string[]).includes(file.type)) return "image"
  if (file.type.startsWith("video/")) return "video"
  return null
}

export async function uploadBlogImage(token: string, file: File, signal?: AbortSignal) {
  if (file.size > MAX_BLOG_IMAGE_MB * 1024 * 1024) {
    throw new MediaRejectedError(`Ảnh tối đa ${MAX_BLOG_IMAGE_MB} MB.`)
  }
  const { upload, url } = await requestBlogImageUpload(token, file)
  await uploadToStorage(upload, file, { signal })
  return url
}

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
