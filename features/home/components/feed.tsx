"use client"

import { SproutIcon } from "lucide-react"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MobileTopBar } from "@/features/shared/components/mobile-nav"
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
      return [...live.filter((post) => post.kind === "video"), ...getFeed(tab)]
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

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          <Timeline posts={withLivePosts(tab.value, live)} />
        </TabsContent>
      ))}
    </Tabs>
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
    <>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      <div aria-hidden className="h-24 sm:h-0" />
    </>
  )
}
