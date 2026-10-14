"use client"

import useSWRInfinite from "swr/infinite"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { usePostInteractions } from "@/features/posts/hooks/use-post-interactions"
import {
  createComment,
  deleteComment,
  fetchCommentPage,
  updateComment,
} from "@/features/posts/lib/posts-api"
import { commentsKey } from "@/features/posts/posts-cache"
import type { CommentPage } from "@/features/posts/schemas"

/**
 * The comments on post `postId`, newest first and loaded a page at a time.
 * Works signed out; writes need a token. Writes edit the loaded pages in place
 * instead of refetching them, so the pages already shown keep their cursors.
 */
export function useComments(postId: string) {
  const { accessToken } = useAuth()
  const { countComment } = usePostInteractions()
  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfinite(
    (_index: number, previous: CommentPage | null) => {
      // The last page has no cursor.
      if (previous && !previous.nextCursor) return null
      const cursor = previous?.nextCursor
      const url = commentsKey(postId)
      return [cursor ? `${url}?cursor=${cursor}` : url, accessToken] as const
    },
    fetchCommentPage
  )

  function editPages(change: (pages: CommentPage[]) => CommentPage[]) {
    return mutate((pages) => (pages ? change(pages) : pages), { revalidate: false })
  }

  async function add(body: string) {
    if (!accessToken) return
    const comment = await createComment(accessToken, postId, body)
    await editPages(([first, ...rest]) => [
      { items: [comment, ...(first?.items ?? [])], nextCursor: first?.nextCursor ?? null },
      ...rest,
    ])
    void countComment(postId, 1)
  }

  async function edit(commentId: string, body: string) {
    if (!accessToken) return
    const saved = await updateComment(accessToken, postId, commentId, body)
    await editPages((pages) =>
      pages.map((page) => ({
        ...page,
        items: page.items.map((item) => (item.id === commentId ? saved : item)),
      }))
    )
  }

  async function remove(commentId: string) {
    if (!accessToken) return
    await deleteComment(accessToken, postId, commentId)
    // The next page is fetched after its cursor, which must still exist on the
    // API. A page that loses its only comment has no cursor to hand on: refetch.
    const emptied = (data ?? []).some(
      (page) => page.nextCursor === commentId && page.items.length === 1
    )
    if (emptied) {
      await mutate()
    } else {
      await editPages((pages) =>
        pages.map((page) => {
          const items = page.items.filter((item) => item.id !== commentId)
          const nextCursor =
            page.nextCursor === commentId ? (items.at(-1)?.id ?? null) : page.nextCursor
          return { items, nextCursor }
        })
      )
    }
    void countComment(postId, -1)
  }

  const pages = data ?? []
  // A comment added here can come back in a later page too; show it once.
  const comments = [
    ...new Map(
      pages.flatMap((page) => page.items).map((comment) => [comment.id, comment] as const)
    ).values(),
  ]

  return {
    comments,
    hasMore: Boolean(pages.at(-1)?.nextCursor),
    loadMore: () => setSize(size + 1),
    error,
    isLoading,
    isLoadingMore: isValidating && size > pages.length,
    add,
    edit,
    remove,
  }
}
