import { notFound } from "next/navigation"

import { VideoManagementPreview } from "@/features/posts/preview/video-management-preview"

export default function VideoPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <VideoManagementPreview />
}
