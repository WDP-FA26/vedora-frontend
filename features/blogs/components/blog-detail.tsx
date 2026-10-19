"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon, ChefHatIcon, LockIcon, PencilIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { editBlogPath } from "@/features/blogs/blogs-cache"
import { BlogMarkdown } from "@/features/blogs/components/blog-markdown"
import { BlogStatusBadge } from "@/features/blogs/components/blog-status-badge"
import { useBlog } from "@/features/blogs/hooks/use-blogs"
import type { ApiBlog, BlogRecipe } from "@/features/blogs/schemas"
import { PostActions, PostMenu } from "@/features/home/components/post-card"
import { PostComments } from "@/features/posts/components/post-comments"
import { usePostView } from "@/features/posts/hooks/use-post-view"
import { toFeedPost } from "@/features/posts/lib/to-feed-post"
import { profilePath } from "@/features/profiles/profiles-cache"
import { CatalogRecipeDialog } from "@/features/recipes/components/catalog-recipe-dialog"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { ApiError } from "@/features/shared/lib/api-client"
import { formatPostDateLong } from "@/features/shared/lib/format"

/** A blog on its own page, with the full article. */
export function BlogDetail({ id }: { id: string }) {
  const router = useRouter()
  const { blog, error, isLoading, retry } = useBlog(id)
  const expired = error instanceof ApiError && error.status === 401

  // A token sent with a public read must still be valid: re-render the layout
  // so the session is rotated, or dropped and the blog read as a guest.
  useEffect(() => {
    if (expired) router.refresh()
  }, [expired, router])

  return (
    <section aria-labelledby="blog-detail-heading">
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
        <p id="blog-detail-heading" className="font-sans text-lg font-bold">
          Blog
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center p-6">
          <Spinner aria-label="Đang tải bài viết" />
        </div>
      ) : blog ? (
        <BlogArticle blog={blog} />
      ) : (
        <div role="alert" className="flex flex-col items-start gap-3 p-4 text-sm sm:px-5">
          <p className="text-destructive">
            {error instanceof ApiError && (error.status === 404 || error.status === 400)
              ? "Bài viết này không tồn tại hoặc đã bị xoá."
              : expired
                ? "Phiên đăng nhập đã hết hạn. Đang làm mới phiên…"
                : "Không tải được bài viết. Kiểm tra kết nối rồi thử lại."}
          </p>
          {!(error instanceof ApiError && error.status < 500) && (
            <Button variant="outline" size="sm" onClick={() => void retry()}>
              Thử lại
            </Button>
          )}
        </div>
      )}
    </section>
  )
}

function BlogArticle({ blog }: { blog: ApiBlog }) {
  const { user } = useAuth()
  const post = toFeedPost(blog)
  const published = blog.status === "PUBLISHED"
  const mine = user?.id === blog.author.id
  const profileHref = profilePath(blog.author.id)
  const viewRef = usePostView<HTMLElement>(published ? blog.id : null)
  const [coverFailed, setCoverFailed] = useState(false)
  const [openRecipe, setOpenRecipe] = useState<string | null>(null)

  return (
    <>
      <article ref={viewRef} aria-labelledby="blog-title" className="pb-2">
        {blog.blog.coverImageUrl && !coverFailed && (
          // Hot-linked from another site, so the Next image optimizer is not used.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={blog.blog.coverImageUrl}
            alt=""
            onError={() => setCoverFailed(true)}
            className="aspect-[1.91/1] w-full border-b border-border object-cover"
          />
        )}

        <div className="px-4 pt-5 sm:px-5">
          {mine && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <BlogStatusBadge status={blog.status} />
              <Button
                variant="outline"
                size="sm"
                shape="pill"
                nativeButton={false}
                render={<Link href={editBlogPath(blog.id)} />}
              >
                <PencilIcon aria-hidden /> Sửa bài
              </Button>
            </div>
          )}

          <h1 id="blog-title" className="font-heading text-2xl leading-tight font-bold text-balance sm:text-[1.75rem]">
            {blog.blog.title}
          </h1>

          <header className="mt-4 flex items-center gap-3">
            <Link href={profileHref} aria-label={`Hồ sơ của ${post.author.name}`} className="rounded-full">
              <AuthorAvatar author={post.author} size="lg" />
            </Link>
            <div className="min-w-0 flex-1 text-[0.9375rem] leading-5">
              <Link href={profileHref} className="block truncate font-bold hover:underline">
                {post.author.name}
              </Link>
              <p className="truncate text-sm text-muted-foreground">
                {/* A blog returned to draft keeps its first `publishedAt`. */}
                {published && blog.publishedAt ? (
                  <time dateTime={blog.publishedAt}>{formatPostDateLong(blog.publishedAt)}</time>
                ) : (
                  "Chưa xuất bản"
                )}
              </p>
            </div>
            {published && <PostMenu post={post} />}
          </header>

          {!published && (
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-sm">
              <LockIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
              Bản nháp chỉ mình bạn thấy. Xuất bản để mọi người đọc, thả mầm và bình luận.
            </p>
          )}

          {blog.content.trim() ? (
            <BlogMarkdown content={blog.content} className="mt-5" />
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">Bài viết chưa có nội dung.</p>
          )}

          {blog.blog.recipes.length > 0 && (
            <RelatedRecipes recipes={blog.blog.recipes} onOpen={setOpenRecipe} />
          )}

          {published && (
            <div className="mt-6 border-t border-border pb-1">
              <PostActions post={post} />
            </div>
          )}
        </div>
      </article>

      {/* The API takes comments on published posts only. */}
      {published && (
        <PostComments postId={blog.id} postAuthorId={blog.author.id} count={blog.commentCount} />
      )}

      <CatalogRecipeDialog
        recipeId={openRecipe}
        onOpenChange={(open) => {
          if (!open) setOpenRecipe(null)
        }}
      />
    </>
  )
}

function RelatedRecipes({
  recipes,
  onOpen,
}: {
  recipes: BlogRecipe[]
  onOpen: (id: string) => void
}) {
  return (
    <section aria-labelledby="related-recipes-title" className="mt-8">
      <h2 id="related-recipes-title" className="text-base font-bold">
        Món trong bài
      </h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {recipes.map((recipe) => (
          <li key={recipe.id}>
            <button
              type="button"
              onClick={() => onOpen(recipe.id)}
              className="flex w-full items-center gap-3 rounded-2xl border border-border p-2 text-left transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <RecipeThumb imageUrl={recipe.imageUrl} />
              <span className="min-w-0 flex-1 text-sm font-semibold leading-snug">{recipe.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function RecipeThumb({ imageUrl }: { imageUrl: string | null }) {
  const [failed, setFailed] = useState(false)
  if (!imageUrl || failed) {
    return (
      <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
        <ChefHatIcon aria-hidden className="size-6" />
      </span>
    )
  }
  return (
    // Hot-linked from another site, so the Next image optimizer is not used.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt=""
      onError={() => setFailed(true)}
      className="size-14 shrink-0 rounded-xl object-cover"
    />
  )
}
