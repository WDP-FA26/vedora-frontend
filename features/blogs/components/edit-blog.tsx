"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { MY_BLOGS_PATH } from "@/features/blogs/blogs-cache"
import { BlogEditor } from "@/features/blogs/components/blog-editor"
import { useBlog } from "@/features/blogs/hooks/use-blogs"
import { ApiError } from "@/features/shared/lib/api-client"

/** Loads the author's blog `id` into the editor. */
export function EditBlog({ id, justCreated = false }: { id: string; justCreated?: boolean }) {
  const { user } = useAuth()
  const { blog, error, isLoading, retry } = useBlog(id)

  if (isLoading) {
    return (
      <div className="flex justify-center p-6">
        <Spinner aria-label="Đang tải bài viết" />
      </div>
    )
  }

  // The API answers 404 for someone else's draft; a published blog by
  // someone else loads, but is not ours to edit.
  if (!blog || blog.author.id !== user?.id) {
    const missing = !blog
      ? error instanceof ApiError && (error.status === 404 || error.status === 400)
      : true
    return (
      <div role="alert" className="flex flex-col items-start gap-3 p-4 text-sm sm:px-5">
        <p>
          {missing
            ? "Không tìm thấy bài viết này trong blog của bạn."
            : "Không tải được bài viết. Kiểm tra kết nối rồi thử lại."}
        </p>
        <div className="flex gap-2">
          {!missing && (
            <Button variant="outline" size="sm" onClick={() => void retry()}>
              Thử lại
            </Button>
          )}
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={MY_BLOGS_PATH} />}>
            Về blog của tôi
          </Button>
        </div>
      </div>
    )
  }

  return <BlogEditor key={blog.id} blog={blog} justCreated={justCreated} />
}
