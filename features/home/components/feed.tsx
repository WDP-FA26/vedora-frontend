"use client"

import { BookOpenTextIcon, ImageIcon, SproutIcon } from "lucide-react"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WeekPlanButton } from "@/features/meal-plan/components/week-plan-button"
import { MobileTopBar } from "@/features/shared/components/mobile-nav"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { ComposeDialog } from "@/features/shared/components/compose-dialog"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { getFeed } from "@/features/home/data/posts"
import { useFeedPosts } from "@/features/posts/hooks/use-feed-posts"
import { toFeedPost } from "@/features/posts/lib/to-feed-post"
import { PostCard } from "./post-card"
import type { FeedTab, Post } from "@/features/home/types"

const tabs: { value: FeedTab; label: string }[] = [
  { value: "for-you", label: "Dành cho bạn" },
  { value: "following", label: "Đang theo dõi" },
  { value: "blogs", label: "Blog" },
  { value: "recipes", label: "Công thức" },
]

/** Real posts from the API first, then the illustrative fixtures. */
function withLivePosts(tab: FeedTab, live: Post[]): Post[] {
  switch (tab) {
    case "for-you":
      return [...live, ...getFeed(tab)]
    case "recipes":
      return [...live.filter((post) => post.kind === "media"), ...getFeed(tab)]
    default:
      return getFeed(tab)
  }
}

export function Feed() {
  const { posts } = useFeedPosts()
  const live = posts.map(toFeedPost)

  return (
    <Tabs defaultValue="for-you">
      <div className="sticky top-0 z-20 border-b border-border bg-card/85 backdrop-blur-md backdrop-saturate-150">
        <MobileTopBar />
        <div className="flex items-center">
          <div className="min-w-0 flex-1">
            <TabsList
              variant="timeline"
              aria-label="Dòng thời gian"
            >
              {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <div className="hidden px-2 sm:block">
            <WeekPlanButton />
          </div>
        </div>
      </div>

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          <FeedComposer />
          <Timeline posts={withLivePosts(tab.value, live)} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

function FeedComposer() {
  const { author } = useAuth()

  return (
    <section aria-label="Tạo bài viết" className="px-3 pt-4">
      <ComposeDialog
        trigger={
          <button
            type="button"
            aria-label="Tạo bài viết mới"
            className="flex h-auto w-full cursor-pointer flex-col items-stretch rounded-[1.4rem] border border-border/80 bg-card p-4 text-left shadow-[0_2px_10px_rgba(37,93,50,0.045)] transition-[border-color,box-shadow] outline-none hover:border-primary/20 hover:shadow-[0_10px_24px_rgba(37,93,50,0.08)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            <span className="flex w-full items-center gap-3">
              {author && <AuthorAvatar author={author} size="lg" />}
              <span className="flex min-h-11 min-w-0 flex-1 items-center rounded-full bg-background px-4 text-sm font-normal text-muted-foreground">
                Bạn đang nghĩ gì?
              </span>
            </span>
            <span
              aria-hidden
              className="mt-3 flex w-full items-center justify-around gap-2 border-t border-border/70 pt-3 text-xs font-semibold text-muted-foreground sm:text-sm"
            >
              <span className="inline-flex items-center gap-1.5">
                <ImageIcon aria-hidden className="size-4 text-brand-leaf" />
                Ảnh / video
              </span>
              <span aria-hidden className="h-5 w-px bg-border" />
              <span className="inline-flex items-center gap-1.5">
                <BookOpenTextIcon aria-hidden className="size-4 text-brand-orange" />
                Blog
              </span>
            </span>
          </button>
        }
      />
    </section>
  )
}

function Timeline({ posts }: { posts: Post[] }) {
  if (posts.length === 0) {
    return (
      <div className="py-10">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SproutIcon />
            </EmptyMedia>
            <EmptyTitle>Chưa có gì ở đây</EmptyTitle>
            <EmptyDescription>
              Hãy theo dõi vài đầu bếp và người làm vườn, bài viết của họ sẽ xuất hiện ở đây.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    )
  }

  return (
    <div className="space-y-3 px-3 pt-3 pb-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      <div aria-hidden className="h-24 sm:h-0" />
    </div>
  )
}
