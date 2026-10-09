"use client"

import {
  BookOpenTextIcon,
  ClapperboardIcon,
  RotateCcwIcon,
  SproutIcon,
  UtensilsCrossedIcon,
  UsersIcon,
} from "lucide-react"
import { useSWRConfig } from "swr"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { getFeed } from "@/features/home/data/posts"
import type { FeedTab, Post } from "@/features/home/types"
import { WeekPlanButton } from "@/features/meal-plan/components/week-plan-button"
import { useFeedPosts } from "@/features/posts/hooks/use-feed-posts"
import { toFeedPost } from "@/features/posts/lib/to-feed-post"
import { POSTS_KEY } from "@/features/posts/posts-cache"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { ComposeDialog } from "@/features/shared/components/compose-dialog"
import { MobileTopBar } from "@/features/shared/components/mobile-nav"
import { PostCard } from "./post-card"

const tabs: { value: FeedTab; label: string }[] = [
  { value: "for-you", label: "Dành cho bạn" },
  { value: "following", label: "Đang theo dõi" },
  { value: "blogs", label: "Blog" },
  { value: "recipes", label: "Công thức" },
]

const emptyCopy = {
  "for-you": {
    icon: SproutIcon,
    title: "Chưa thấy bài viết công khai",
    description: "Trong các bài mới tải chưa có chia sẻ công khai. Hãy quay lại sau.",
  },
  following: {
    icon: UsersIcon,
    title: "Bảng tin Đang theo dõi chưa khả dụng",
    description: "Trang Khám phá hiện chưa có dữ liệu bài viết từ những người bạn theo dõi.",
  },
  blogs: {
    icon: BookOpenTextIcon,
    title: "Chưa thấy blog công khai",
    description: "Trong các bài mới tải chưa có blog công khai.",
  },
  recipes: {
    icon: UtensilsCrossedIcon,
    title: "Bảng tin công thức chưa khả dụng",
    description: "Trang Khám phá hiện chưa có nguồn công thức công khai để hiển thị.",
  },
} as const

export function Feed() {
  const { posts, error, isLoading } = useFeedPosts()
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()
  // The list endpoint may include the author's processing posts. Only
  // published content belongs in the public Explore timeline.
  const published = posts.filter((post) => post.status === "PUBLISHED")
  const forYou = published.map(toFeedPost)
  const blogs = published.filter((post) => post.type === "BLOG").map(toFeedPost)

  function retry() {
    if (accessToken) void mutate([POSTS_KEY, accessToken])
  }

  return (
    <Tabs defaultValue="for-you">
      <div className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur-md">
        <MobileTopBar />
        <div className="flex min-w-0 items-center">
          <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList variant="timeline" aria-label="Dòng thời gian" className="min-w-max">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <div className="hidden shrink-0 px-2 sm:block">
            <WeekPlanButton />
          </div>
        </div>
      </div>

      <FeedComposer />

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          <Timeline
            tab={tab.value}
            livePosts={tab.value === "for-you" ? forYou : tab.value === "blogs" ? blogs : []}
            mockPosts={getFeed(tab.value)}
            isLoading={isLoading}
            hasError={Boolean(error)}
            onRetry={retry}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}

function FeedComposer() {
  const { author } = useAuth()

  return (
    <section aria-label="Tạo bài viết" className="border-b border-border">
      <div className="flex items-center gap-2 px-4 py-3 sm:gap-3 sm:px-5">
        {author ? (
          <AuthorAvatar author={author} size="lg" />
        ) : (
          <span aria-hidden className="size-11 rounded-full bg-secondary" />
        )}
        <ComposeDialog
          trigger={
            <Button
              type="button"
              variant="outline"
              shape="pill"
              size="lg"
              aria-label="Tạo bài viết mới"
              className="h-11 min-w-0 flex-1 justify-start overflow-hidden text-left"
            >
              <span className="min-w-0 truncate font-normal text-muted-foreground">
                Bạn muốn chia sẻ món chay nào hôm nay?
              </span>
            </Button>
          }
          mediaTrigger={
            <Button
              type="button"
              variant="tool"
              size="lg"
              aria-label="Tạo bài viết và thêm video"
              className="shrink-0"
            >
              <ClapperboardIcon aria-hidden className="size-[1.125rem]" />
              <span className="hidden sm:inline">Thêm video</span>
            </Button>
          }
        />
      </div>
    </section>
  )
}

function Timeline({
  tab,
  livePosts,
  mockPosts,
  isLoading,
  hasError,
  onRetry,
}: {
  tab: FeedTab
  livePosts: Post[]
  mockPosts: Post[]
  isLoading: boolean
  hasError: boolean
  onRetry: () => void
}) {
  const hasApiSource = tab === "for-you" || tab === "blogs"

  if (livePosts.length === 0 && mockPosts.length === 0 && !isLoading && !hasError) {
    const { icon: Icon, title, description } = emptyCopy[tab]
    return (
      <div className="px-3 py-6">
        <div className="rounded-2xl border border-dashed border-border bg-card">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Icon aria-hidden />
              </EmptyMedia>
              <EmptyTitle>{title}</EmptyTitle>
              <EmptyDescription>{description}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </div>
    )
  }

  return (
    <>
      {hasApiSource && isLoading && livePosts.length === 0 && <FeedSkeleton />}
      <div className="pb-4">
        {hasApiSource && hasError && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 text-sm sm:px-5">
            <span>Không tải được bài viết mới. Kiểm tra kết nối rồi thử lại.</span>
            <Button type="button" variant="outline" size="sm" shape="pill" onClick={onRetry}>
              <RotateCcwIcon aria-hidden />
              Thử lại
            </Button>
          </div>
        )}
        {livePosts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
        {mockPosts.map((post) => (
          <PostCard key={`static-${post.id}`} post={post} />
        ))}
        <div aria-hidden className="h-24 sm:h-0" />
      </div>
    </>
  )
}

function FeedSkeleton() {
  return (
    <div role="status" aria-label="Đang tải bảng tin">
      {Array.from({ length: 2 }, (_, index) => (
        <div key={index} className="border-b border-border px-4 py-4 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="size-11 overflow-hidden rounded-full">
              <Skeleton className="size-full" />
            </div>
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="mt-5 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-4/5" />
          <div className="mt-4 aspect-video overflow-hidden rounded-2xl">
            <Skeleton className="size-full" />
          </div>
          <Skeleton className="mt-4 h-8 w-full" />
        </div>
      ))}
      <span className="sr-only">Đang tải bảng tin</span>
    </div>
  )
}
