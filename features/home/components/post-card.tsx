"use client"

import { useId, useState } from "react"
import Link from "next/link"
import {
  BookmarkIcon,
  ChartNoAxesColumnIcon,
  CheckIcon,
  ClapperboardIcon,
  EllipsisIcon,
  FileTextIcon,
  FlagIcon,
  LinkIcon,
  MessageCircleIcon,
  Repeat2Icon,
  ShareIcon,
  SproutIcon,
  TimerIcon,
} from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AuthorAvatar } from "@/features/shared/components/author-avatar"
import { formatCount, formatPostDate, formatPostDateLong } from "@/features/shared/lib/format"
import { MediaPlaceholder } from "@/features/shared/components/media-placeholder"
import type { ArticlePost, PhotoPost, Post, VideoPost } from "@/features/home/types"
import { VerifiedBadge } from "@/features/shared/components/verified-badge"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { PostMedia } from "@/features/posts/components/post-media"
import { ReportDialog } from "@/features/posts/components/report-dialog"
import { usePostInteractions } from "@/features/posts/hooks/use-post-interactions"
import { usePostView } from "@/features/posts/hooks/use-post-view"
import { postPath } from "@/features/posts/posts-cache"

export function PostCard({ post }: { post: Post }) {
  // Fixture authors have no id, and so no profile to open.
  const profileHref = post.author.id ? `/profile/${post.author.id}` : null
  // Likewise, only API posts have a page of their own.
  const postHref = post.author.id ? postPath(post.id) : null
  const viewRef = usePostView<HTMLElement>(post.author.id ? post.id : null)
  const [expanded, setExpanded] = useState(false)
  const bodyId = useId()
  const canExpand = post.body.length > 240 || post.body.split("\n").length > 5

  return (
    <article
      ref={viewRef}
      aria-label={`Bài viết của ${post.author.name}`}
      className="flex min-w-0 gap-3 border-b border-border px-4 pt-4 pb-2 sm:px-5"
    >
      {profileHref ? (
        <Link
          href={profileHref}
          aria-label={`Hồ sơ của ${post.author.name}`}
          className="mt-0.5 self-start rounded-full"
        >
          <AuthorAvatar author={post.author} size="lg" />
        </Link>
      ) : (
        <AuthorAvatar author={post.author} size="lg" className="mt-0.5" />
      )}

      <div className="min-w-0 flex-1">
        <header className="flex min-w-0 items-start gap-2 text-[0.9375rem] leading-5">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1">
              {profileHref ? (
                <Link href={profileHref} className="truncate font-semibold hover:underline">
                  {post.author.name}
                </Link>
              ) : (
                <span className="truncate font-semibold">{post.author.name}</span>
              )}
              {post.author.verified && <VerifiedBadge label={post.author.verified} />}
            </div>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground sm:text-[0.8125rem]">
              <span className="min-w-0 truncate">@{post.author.handle}</span>
              <span aria-hidden>·</span>
              <PostTime post={post} href={postHref} />
            </div>
          </div>
          <PostMenu post={post} />
        </header>

        {(post.body || post.tags.length > 0) && (
          <>
            <p
              id={bodyId}
              className={cn(
                "mt-3 text-[0.9375rem] leading-[1.6] break-words whitespace-pre-line text-foreground/95",
                canExpand && !expanded && "line-clamp-4"
              )}
            >
              {post.body}
              {post.tags.length > 0 && (
                <span className="text-primary">
                  {post.body && " "}
                  {post.tags.map((tag) => `#${tag}`).join(" ")}
                </span>
              )}
            </p>
            {canExpand && (
              <Button
                variant="link"
                size="sm"
                className="mt-1"
                aria-expanded={expanded}
                aria-controls={bodyId}
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? "Thu gọn" : "Xem thêm"}
              </Button>
            )}
          </>
        )}

        {post.kind === "video" && <VideoMedia post={post} />}
        {post.kind === "media" && <PostMedia post={post} />}
        {post.kind === "article" && <ArticleCard post={post} />}
        {post.kind === "photo" && <PhotoMedia post={post} />}

        <PostActions post={post} />
      </div>
    </article>
  )
}

function PostTime({ post, href }: { post: Post; href: string | null }) {
  const time = (
    <time
      dateTime={post.publishedAt}
      title={formatPostDateLong(post.publishedAt)}
      className="tabular-nums"
    >
      {formatPostDate(post.publishedAt)}
    </time>
  )
  return href ? (
    <Link
      href={href}
      aria-label={`Mở bài viết, ${formatPostDateLong(post.publishedAt)}`}
      className="shrink-0 text-muted-foreground hover:underline"
    >
      {time}
    </Link>
  ) : (
    <span className="shrink-0 text-muted-foreground">{time}</span>
  )
}

function VideoMedia({ post }: { post: VideoPost }) {
  const { video } = post
  return (
    <MediaPlaceholder
      tone={video.tone}
      label={`${video.caption} của ${post.author.name}`}
      icon={ClapperboardIcon}
      className="mt-4 aspect-video max-h-[30rem] rounded-2xl border border-border"
    >
      <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-card/90 px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm">
        <ClapperboardIcon aria-hidden className="size-3.5 text-primary" />
        {video.caption}
      </span>
      <span className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-lg bg-foreground/80 px-2 py-1 text-xs font-semibold text-background tabular-nums">
        <TimerIcon aria-hidden className="size-3.5" />
        {video.duration}
      </span>
    </MediaPlaceholder>
  )
}

/** Static legacy content has no destination URL, so this is not a link. */
function ArticleCard({ post }: { post: ArticlePost }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-border">
      <MediaPlaceholder
        tone={post.attachment.tone}
        label="Ảnh bìa bài nghiên cứu"
        icon={FileTextIcon}
        className="aspect-[1.91/1]"
      />
      <span className="block border-t border-border px-3 py-2.5">
        <span className="block text-[0.9375rem] leading-snug font-semibold">
          {post.attachment.title}
        </span>
        <span className="mt-0.5 block text-sm text-muted-foreground">
          {post.attachment.source}
        </span>
      </span>
    </div>
  )
}

function PhotoMedia({ post }: { post: PhotoPost }) {
  const single = post.photos.length === 1
  return (
    <div
      className={cn(
        "mt-4 grid gap-0.5 overflow-hidden rounded-2xl border border-border",
        single ? "grid-cols-1" : "grid-cols-2"
      )}
    >
      {post.photos.map((photo) => (
        <MediaPlaceholder
          key={photo.alt}
          tone={photo.tone}
          label={photo.alt}
          className={single ? "aspect-[16/10]" : "aspect-[4/5]"}
        >
          <span className="absolute right-2 bottom-2 left-2 rounded-lg bg-card/90 px-2.5 py-1.5 text-xs font-medium text-foreground sm:right-3 sm:bottom-3 sm:left-3">
            {photo.alt}
          </span>
        </MediaPlaceholder>
      ))}
    </div>
  )
}

export function PostMenu({ post }: { post: Post }) {
  const { user } = useAuth()
  const [reporting, setReporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const reportable = Boolean(user && post.author.id !== user.id)

  // Illustrative cards have no permalink or server-side menu actions.
  if (!post.author.id) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="action"
              size="icon-sm"
              shape="pill"
              className="-my-1 -mr-2"
            />
          }
          aria-label="Tùy chọn khác"
        >
          <EllipsisIcon aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onClick={() => {
              void copyPostLink(post.id).then(setCopied)
            }}
          >
            {copied ? <CheckIcon aria-hidden /> : <LinkIcon aria-hidden />}
            {copied ? "Đã sao chép liên kết" : "Sao chép liên kết"}
          </DropdownMenuItem>
          {reportable && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setReporting(true)}>
                <FlagIcon aria-hidden />
                Báo cáo bài viết
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {reportable && (
        <ReportDialog
          postId={post.id}
          authorName={post.author.name}
          open={reporting}
          onOpenChange={setReporting}
        />
      )}
    </>
  )
}

export function PostActions({ post }: { post: Post }) {
  const live = Boolean(post.author.id)
  const {
    setLiked,
    setReposted: saveReposted,
    setBookmarked: saveBookmarked,
  } = usePostInteractions()
  const [copied, setCopied] = useState(false)

  const sprouted = post.sprouted ?? false
  const reposted = post.reposted ?? false
  const bookmarked = post.bookmarked ?? false

  function toggleSprout() {
    void setLiked(post.id, !sprouted)
  }

  function toggleRepost() {
    void saveReposted(post.id, !reposted)
  }

  function toggleBookmark() {
    void saveBookmarked(post.id, !bookmarked)
  }

  async function share() {
    setCopied(await copyPostLink(post.id))
  }

  return (
    <div
      role="group"
      aria-label="Hành động với bài viết"
      className="mt-2 -ml-2 flex flex-wrap items-center justify-between gap-x-1 gap-y-1"
    >
      <ActionStat label="Bình luận" count={post.stats.replies} icon={MessageCircleIcon} />
      {live ? (
        <>
          <ActionButton
            label={reposted ? "Hủy đăng lại" : "Đăng lại"}
            count={post.stats.reposts}
            icon={Repeat2Icon}
            active={reposted}
            toggle
            onClick={toggleRepost}
          />
          <ActionButton
            label={sprouted ? "Bỏ thả mầm" : "Thả mầm"}
            count={post.stats.sprouts}
            icon={SproutIcon}
            active={sprouted}
            toggle
            onClick={toggleSprout}
            activeIconClassName="animate-sprout-pop fill-primary/25"
          />
        </>
      ) : (
        <>
          <ActionStat label="Đăng lại" count={post.stats.reposts} icon={Repeat2Icon} />
          <ActionStat label="Thả mầm" count={post.stats.sprouts} icon={SproutIcon} />
        </>
      )}
      <ActionStat label="Lượt xem" count={post.stats.views} icon={ChartNoAxesColumnIcon} className="hidden sm:inline-flex" />
      {live && (
        <span className="flex items-center">
          <ActionButton
            label={bookmarked ? "Bỏ lưu" : "Lưu"}
            icon={BookmarkIcon}
            active={bookmarked}
            toggle
            onClick={toggleBookmark}
            activeIconClassName="fill-primary"
          />
          <ActionButton
            label={copied ? "Đã sao chép liên kết" : "Chia sẻ"}
            icon={copied ? CheckIcon : ShareIcon}
            active={copied}
            onClick={() => void share()}
          />
        </span>
      )}
    </div>
  )
}

async function copyPostLink(id: string) {
  const url = `${window.location.origin}${postPath(id)}`
  try {
    await navigator.clipboard.writeText(url)
    return true
  } catch {
    // Clipboard access may be unavailable in some browsers. Let the user
    // copy the real URL manually instead of reporting a false success.
    window.prompt("Sao chép liên kết bài viết:", url)
    return false
  }
}

function ActionStat({
  label,
  count,
  icon: Icon,
  className,
}: {
  label: string
  count: number
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  className?: string
}) {
  return (
    <span
      aria-label={`${label}, ${formatCount(count)}`}
      className={cn("inline-flex h-9 items-center gap-1 px-2 text-xs text-muted-foreground tabular-nums", className)}
    >
      <Icon aria-hidden className="size-4" strokeWidth={1.75} />
      <span>{formatCount(count)}</span>
    </span>
  )
}

function ActionButton({
  label,
  count,
  icon: Icon,
  active,
  toggle,
  onClick,
  activeIconClassName,
}: {
  label: string
  count?: number
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  active?: boolean
  /** Exposes `active` as a pressed state to assistive tech. */
  toggle?: boolean
  onClick?: () => void
  activeIconClassName?: string
}) {
  return (
    <Button
      variant="action"
      size="count"
      shape="pill"
      aria-label={count === undefined ? label : `${label}, ${formatCount(count)}`}
      aria-pressed={toggle ? Boolean(active) : undefined}
      data-active={active ? "" : undefined}
      onClick={onClick}
    >
      <Icon
        aria-hidden
        strokeWidth={1.75}
        className={cn(active && activeIconClassName)}
      />
      {count !== undefined && <span>{formatCount(count)}</span>}
    </Button>
  )
}
