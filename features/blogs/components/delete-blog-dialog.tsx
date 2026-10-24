"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSWRConfig } from "swr"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "@/components/ui/toast"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { BLOGS_KEY } from "@/features/blogs/blogs-cache"
import { deleteBlog } from "@/features/blogs/lib/blogs-api"
import { POSTS_KEY, postPath } from "@/features/posts/posts-cache"

/**
 * Asks before deleting one of the author's own blogs, then drops it from every
 * cached feed and list. On the blog's own page, goes back to the feed.
 */
export function DeleteBlogDialog({
  blogId,
  title,
  open,
  onOpenChange,
}: {
  blogId: string
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()
  const router = useRouter()
  const pathname = usePathname()
  const [deleting, setDeleting] = useState(false)

  async function remove() {
    if (!accessToken) return
    setDeleting(true)
    try {
      await deleteBlog(accessToken, blogId)
      onOpenChange(false)
      toast.add({ title: "Đã xoá blog", description: title })
      if (pathname === postPath(blogId)) router.push("/home")
      void mutate(
        (key) =>
          Array.isArray(key) &&
          (String(key[0]).startsWith(POSTS_KEY) || String(key[0]).startsWith(BLOGS_KEY))
      )
    } catch {
      toast.add({ title: "Không xoá được blog", description: "Thử lại sau nhé." })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xoá blog này?</AlertDialogTitle>
          <AlertDialogDescription>
            “{title}” cùng bình luận, lượt thả mầm và công thức gắn kèm sẽ bị xoá vĩnh viễn.
            Không hoàn tác được.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Giữ lại</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={deleting} onClick={() => void remove()}>
            Xoá
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
