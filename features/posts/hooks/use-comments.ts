"use client"

import useSWRInfinite from "swr/infinite"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { usePostInteractions } from "@/features/posts/hooks/use-post-interactions"
import {
  createComment,
  createReply,
  deleteComment,
  fetchCommentPage,
  updateComment,
} from "@/features/posts/lib/posts-api"
import { commentsKey } from "@/features/posts/posts-cache"
import type { CommentPage } from "@/features/posts/schemas"

export function useComments(postId: string, parentId?: string, enabled = true) {
  const { accessToken } = useAuth()
  const { countComment, refreshCommentCount } = usePostInteractions()
  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfinite(
    (_index: number, previous: CommentPage | null) => {
      if (!enabled) return null
      if (previous && !previous.nextCursor) return null
      const cursor = previous?.nextCursor
      const url = parentId ? `${commentsKey(postId)}/${parentId}/replies` : commentsKey(postId)
      return [cursor ? `${url}?cursor=${cursor}` : url, accessToken] as const
    },
    fetchCommentPage
  )

  function editPages(change: (pages: CommentPage[]) => CommentPage[]) {
    return mutate((pages) => change(pages ?? []), {
      revalidate: false,
    })
  }

  async function add(body: string, targetId?: string) {
    if (!accessToken) return
    const comment = parentId
      ? await createReply(accessToken, postId, targetId ?? parentId, body)
      : await createComment(accessToken, postId, body)
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
    const removed = comments.find((item) => item.id === commentId)
    await deleteComment(accessToken, postId, commentId)
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
    void countComment(postId, -(1 + (removed?.replyCount ?? 0)))
    void refreshCommentCount(postId).catch(() => undefined)
  }

  const pages = data ?? []
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
    refresh: () => mutate(),
    changeReplyCount: (id: string, delta: number) =>
      editPages((pages) =>
        pages.map((page) => ({
          ...page,
          items: page.items.map((item) =>
            item.id === id ? { ...item, replyCount: Math.max(0, item.replyCount + delta) } : item
          ),
        }))
      ),
    edit,
    remove,
  }
}
