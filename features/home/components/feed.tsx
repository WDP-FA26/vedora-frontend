"use client"

import {
  BookOpenTextIcon,
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
import type { FeedTab, Post } from "@/features/home/types"
import { WeekPlanButton } from "@/features/meal-plan/components/week-plan-button"
import { useFeedPosts, useFollowingPosts, useForYouPosts } from "@/features/posts/hooks/use-feed-posts"
import { toFeedPost } from "@/features/posts/lib/to-feed-post"
import { FOLLOWING_KEY, FOR_YOU_KEY, POSTS_KEY } from "@/features/posts/posts-cache"
import type { ApiPost } from "@/features/posts/schemas"
import { MobileTopBar } from "@/features/shared/components/mobile-nav"
import { RecipeFeed } from "@/features/recipes/components/recipe-feed"
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
    title: "Chưa có bài viết dành cho bạn",
    description: "Thích, lưu hoặc bình luận vài bài để bảng tin hiểu gu của bạn hơn.",
  },
  following: {
    icon: UsersIcon,
    title: "Chưa có bài viết từ người bạn theo dõi",
    description: "Theo dõi thêm người nấu ăn để bài của họ hiện ở đây.",
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
  const latest = useFeedPosts()
  const ranked = useForYouPosts()
  const following = useFollowingPosts()
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()
  // The list endpoint may include the author's processing posts. Only
  // published content belongs in the public Explore timeline.
  const published = (posts: ApiPost[]) =>
    posts.filter((post) => post.status === "PUBLISHED")
  const forYou = published(ranked.posts).map(toFeedPost)
  const followingPosts = published(following.posts).map(toFeedPost)
  const blogs = published(latest.posts)
    .filter((post) => post.type === "BLOG")
    .map(toFeedPost)

  // One entry per tab that loads from the API; the recipes tab renders its own feed.
  const sources: Partial<Record<FeedTab, { posts: Post[]; isLoading: boolean; error: unknown; key: string }>> = {
    "for-you": { posts: forYou, isLoading: ranked.isLoading, error: ranked.error, key: FOR_YOU_KEY },
    following: { posts: followingPosts, isLoading: following.isLoading, error: following.error, key: FOLLOWING_KEY },
    blogs: { posts: blogs, isLoading: latest.isLoading, error: latest.error, key: POSTS_KEY },
  }

  function retry(url: string) {
    if (accessToken) void mutate([url, accessToken])
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

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.value === "recipes" ? (
            <RecipeFeed />
          ) : (
          <Timeline
            tab={tab.value}
            livePosts={sources[tab.value]?.posts ?? []}
            isLoading={sources[tab.value]?.isLoading ?? false}
            hasError={Boolean(sources[tab.value]?.error)}
            onRetry={() => retry(sources[tab.value]?.key ?? POSTS_KEY)}
          />
          )}
        </TabsContent>
      ))}
    </Tabs>
  )
}

function Timeline({
  tab,
  livePosts,
  isLoading,
  hasError,
  onRetry,
}: {
  tab: FeedTab
  livePosts: Post[]
  isLoading: boolean
  hasError: boolean
  onRetry: () => void
}) {
  const hasApiSource = tab === "for-you" || tab === "following" || tab === "blogs"

  if (livePosts.length === 0 && !isLoading && !hasError) {
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
