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
import { deletePost } from "@/features/posts/lib/posts-api"
import { POSTS_KEY, postPath } from "@/features/posts/posts-cache"

/**
 * Asks before deleting one of the author's own posts, then drops it from every
 * cached list. On the post's own page, goes back to the feed.
 */
export function DeletePostDialog({
  postId,
  open,
  onOpenChange,
}: {
  postId: string
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
      await deletePost(accessToken, postId)
      onOpenChange(false)
      toast.add({ title: "Đã xoá bài viết" })
      if (pathname === postPath(postId)) router.push("/home")
      void mutate(
        (key) => Array.isArray(key) && String(key[0]).startsWith(POSTS_KEY)
      )
    } catch {
      toast.add({ title: "Không xoá được bài viết", description: "Thử lại sau nhé." })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xoá bài viết này?</AlertDialogTitle>
          <AlertDialogDescription>
            Bài viết cùng bình luận và lượt thích sẽ bị xoá vĩnh viễn. Không hoàn tác được.
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
