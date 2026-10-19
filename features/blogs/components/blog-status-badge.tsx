import { Badge } from "@/components/ui/badge"
import type { ApiPost } from "@/features/posts/schemas"

/** Only the author sees a status: everyone else is only ever shown published blogs. */
export function BlogStatusBadge({ status }: { status: ApiPost["status"] }) {
  return status === "PUBLISHED" ? (
    <Badge variant="secondary">Đã xuất bản</Badge>
  ) : (
    <Badge variant="outline">Nháp</Badge>
  )
}
