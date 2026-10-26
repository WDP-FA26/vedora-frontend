"use client"

import { useState } from "react"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { BookmarkIcon } from "lucide-react"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PostCard } from "@/features/home/components/post-card"
import { fetchPostPage } from "@/features/posts/lib/posts-api"
import { toFeedPost } from "@/features/posts/lib/to-feed-post"
import {
  BOOKMARK_TABS,
  BOOKMARKS_KEY,
  isBookmarkTab,
  type BookmarkTab,
} from "@/features/posts/posts-cache"
import { SavedRecipes } from "@/features/recipes/components/saved-recipes"

const TAB_LABELS: Record<BookmarkTab, string> = { posts: "Bài viết", recipes: "Công thức" }

/** "Đã lưu": saved posts and saved recipes, one tab each, kept in `?tab=`. */
export function BookmarksView({ initialTab }: { initialTab: BookmarkTab }) {
  const [tab, setTab] = useState(initialTab)

  function select(next: BookmarkTab) {
    setTab(next)
    // Keeps the tab across reloads without a server round trip.
    window.history.replaceState(null, "", next === "posts" ? "?" : `?tab=${next}`)
  }

  return (
    <Tabs value={tab} onValueChange={(next) => isBookmarkTab(next) && select(next)}>
      <header className="sticky top-0 z-20 border-b border-border bg-card/85 backdrop-blur-md">
        <div className="px-4 pt-2 sm:px-5">
          <h1 className="text-lg font-bold">Đã lưu</h1>
          <p className="text-sm text-muted-foreground">Chỉ mình bạn thấy danh sách này.</p>
        </div>
        <TabsList variant="timeline" aria-label="Loại nội dung đã lưu">
          {BOOKMARK_TABS.map((id) => (
            <TabsTrigger key={id} value={id}>
              {TAB_LABELS[id]}
            </TabsTrigger>
          ))}
        </TabsList>
      </header>
      <TabsContent value="posts">
        <SavedPosts />
      </TabsContent>
      <TabsContent value="recipes">
        <SavedRecipes />
      </TabsContent>
    </Tabs>
  )
}

/**
 * The posts the signed-in user saved. A post unsaved here stays in place, so
 * a slip can be undone, and is gone the next time the page loads.
 */
function SavedPosts() {
  const { data, error, isLoading } = useAuthedSWR(BOOKMARKS_KEY, fetchPostPage)
  const posts = data?.items ?? []

  return (
    <section aria-label="Bài viết đã lưu">
      {isLoading ? (
        <div className="flex justify-center p-6">
          <Spinner aria-label="Đang tải bài viết đã lưu" />
        </div>
      ) : error ? (
        <p role="alert" className="p-4 text-sm text-destructive sm:px-5">
          Không tải được bài viết đã lưu. Thử tải lại trang nhé.
        </p>
      ) : posts.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookmarkIcon aria-hidden />
            </EmptyMedia>
            <EmptyTitle>Chưa lưu bài viết nào</EmptyTitle>
            <EmptyDescription>
              Bấm biểu tượng dấu trang dưới một bài viết để lưu lại, rồi tìm nó ở đây.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {posts.map((post) => (
            <PostCard key={post.id} post={toFeedPost(post)} />
          ))}
          {data?.nextCursor && (
            <p className="p-4 text-center text-sm text-muted-foreground">
              Đang hiển thị 50 bài lưu gần nhất.
            </p>
          )}
        </>
      )}
    </section>
  )
}
