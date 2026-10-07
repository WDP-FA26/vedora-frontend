"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { PostActions, PostMenu } from "@/features/home/components/post-card"
import { PostMedia } from "@/features/posts/components/post-media"
import { usePost } from "@/features/posts/hooks/use-feed-posts"
import { usePostView } from "@/features/posts/hooks/use-post-view"
import { toFeedPost } from "@/features/posts/lib/to-feed-post"
import type { ApiPost } from "@/features/posts/schemas"
import { profilePath } from "@/features/profiles/profiles-cache"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { ApiError } from "@/features/shared/lib/api-client"
import { formatPostDateLong } from "@/features/shared/lib/format"

/** A post on its own page, in full: the page a shared link opens. */
export function PostDetail({ id }: { id: string }) {
  const router = useRouter()
  const { post, error, isLoading } = usePost(id)

  return (
    <section aria-labelledby="post-detail-title">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-card/85 px-2 py-2 backdrop-blur-md">
        <Button
          variant="ghost"
          size="icon"
          shape="pill"
          aria-label="Quay lại"
          // A shared link opens with no history to go back to.
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/home"))}
        >
          <ArrowLeftIcon aria-hidden />
        </Button>
        <h1 id="post-detail-title" className="font-sans text-lg font-bold">
          Bài viết
        </h1>
      </header>

      {isLoading ? (
        <div className="flex justify-center p-6">
          <Spinner aria-label="Đang tải bài viết" />
        </div>
      ) : post ? (
        <PostArticle post={post} />
      ) : (
        <p role="alert" className="p-4 text-sm text-destructive sm:px-5">
          {error instanceof ApiError && (error.status === 404 || error.status === 400)
            ? "Bài viết này không tồn tại hoặc đã bị xoá."
            : "Không tải được bài viết. Thử tải lại trang nhé."}
        </p>
      )}
    </section>
  )
}

function PostArticle({ post: apiPost }: { post: ApiPost }) {
  const post = toFeedPost(apiPost)
  const { author } = post
  const profileHref = profilePath(apiPost.author.id)
  const viewRef = usePostView<HTMLElement>(apiPost.status === "PUBLISHED" ? post.id : null)

  return (
    <article
      ref={viewRef}
      aria-label={`Bài viết của ${author.name}`}
      className="px-4 pt-4 pb-2"
    >
      <header className="flex items-center gap-3">
        <Link href={profileHref} aria-label={`Hồ sơ của ${author.name}`} className="rounded-full">
          <AuthorAvatar author={author} size="lg" />
        </Link>
        <div className="min-w-0 flex-1 text-[0.9375rem] leading-5">
          <Link href={profileHref} className="block truncate font-bold hover:underline">
            {author.name}
          </Link>
          <p className="truncate text-muted-foreground">@{author.handle}</p>
        </div>
        <PostMenu post={post} />
      </header>

      {post.body && (
        <p className="mt-4 text-[1.0625rem] leading-[1.5] break-words text-pretty whitespace-pre-line">
          {post.body}
        </p>
      )}

      {post.kind === "media" && <PostMedia post={post} />}

      <p className="mt-4 text-[0.9375rem] text-muted-foreground">
        <time dateTime={post.publishedAt}>{formatPostDateLong(post.publishedAt)}</time>
      </p>

      <div className="mt-4 border-t border-border pb-1">
        <PostActions post={post} />
      </div>
    </article>
  )
}
