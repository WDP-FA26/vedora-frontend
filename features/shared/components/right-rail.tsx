"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowRightIcon, CheckIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useBilling, useCatalog } from "@/features/billing/hooks"
import { dateTime, money } from "@/features/billing/schema"
import { PostSearchForm } from "@/features/posts/components/post-search-form"
import { ProfileAvatar } from "@/features/profiles/components/profile-avatar"
import { useSuggestions } from "@/features/profiles/hooks/use-suggestions"
import { profilePath } from "@/features/profiles/profiles-cache"
import type { FollowSuggestion } from "@/features/profiles/schemas"
import { PROFESSIONAL_LABEL } from "@/features/verification/schemas"
import { VerifiedBadge } from "@/features/shared/components/verified-badge"
import { MEAL_PLANNER_PATH } from "@/features/meal-plan/meal-plan"

function useStickyTop() {
  const ref = useRef<HTMLElement>(null)
  const [top, setTop] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => setTop(Math.min(0, window.innerHeight - element.offsetHeight))
    const observer = new ResizeObserver(update)
    observer.observe(element)
    window.addEventListener("resize", update)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", update)
    }
  }, [])

  return { ref, top }
}

export function RightRail() {
  const { ref, top } = useStickyTop()
  const pathname = usePathname()

  return (
    <aside
      ref={ref}
      aria-label="Khám phá thêm"
      style={{ top }}
      className="sticky hidden w-[21.875rem] shrink-0 flex-col gap-4 self-start py-3 pl-6 *:shrink-0 lg:flex xl:pl-8"
    >
      {pathname !== "/home/search" && <PostSearchForm />}

      <AiPanel />

      <UpgradePanel />

      <WhoToFollow />

      <p className="px-4 pb-4 text-xs text-muted-foreground">© 2026 Vedora</p>
    </aside>
  )
}

function AiPanel() {
  return (
    <Link
      href={MEAL_PLANNER_PATH}
      className="group relative block overflow-hidden rounded-2xl bg-brand-forest p-4 text-white outline-none transition hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="relative z-10 block max-w-[68%]">
        <span className="block text-base leading-snug font-bold">
          Thực đơn bữa ăn theo tuần
        </span>
        <span className="mt-1 block text-xs leading-5 text-white/75">
          Sắp xếp bữa sáng, trưa và tối trong tuần, đổi món cùng Trợ lý Vedora khi cần.
        </span>
        <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-brand-lemon">
          Xem thực đơn tuần
          <ArrowRightIcon aria-hidden className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </span>
      <span aria-hidden className="absolute right-1 bottom-1 size-24 rotate-3">
        <Image src="/carrot-sticker.png" alt="" width={96} height={96} loading="eager" className="h-full w-full object-contain drop-shadow-md" />
      </span>
    </Link>
  )
}

function UpgradePanel() {
  const { data: catalog } = useCatalog()
  const { data: billing } = useBilling()
  const membership = billing?.membership
  const current =
    membership && membership.planCode !== "FREE" ? membership.planCode : null
  const plan = catalog?.plans.find((item) => item.code === (current ?? "PLUS"))
  if (!plan) return null

  const perks = [
    `${plan.textLimit} lượt AI văn bản/chu kỳ`,
    `${plan.imageLimit} lượt tạo hoặc chỉnh ảnh/chu kỳ`,
    "AI dinh dưỡng, thực đơn và viết blog",
  ]

  return (
    <section
      aria-labelledby="upgrade-title"
      className="rounded-2xl border border-border bg-card px-4 py-4"
    >
      <h2
        id="upgrade-title"
        className="text-[1.0625rem] font-bold tracking-[-0.02em]"
      >
        Vedora {plan.name}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {current && membership?.expiresAt
          ? `Gói của bạn · hiệu lực đến ${dateTime(membership.expiresAt)}`
          : `${money(plan.priceVnd)} / ${plan.durationDays} ngày`}
      </p>
      <ul className="mt-3 space-y-1.5 text-sm">
        {perks.map((perk) => (
          <li key={perk} className="flex items-start gap-2">
            <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            {perk}
          </li>
        ))}
      </ul>
      <Button
        size="pill-sm"
        shape="pill"
        className="mt-4"
        render={<Link href="/billing" />}
        nativeButton={false}
      >
        {current ? "Xem gói của bạn" : "Nâng cấp"}
      </Button>
    </section>
  )
}

function Panel({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <h2 className="px-4 pt-4 pb-2 text-[1.0625rem] font-bold tracking-[-0.02em]">
        {title}
      </h2>
      {children}
    </section>
  )
}

const reasonLabel: Record<FollowSuggestion["reason"], (count: number) => string> = {
  FOLLOWS_YOU: () => "Đã theo dõi bạn",
  MUTUAL: (count) => `Được ${count} người bạn theo dõi`,
  ACTIVE: () => "Mới đăng bài gần đây",
}

function WhoToFollow() {
  const { suggestions, follow, dismiss } = useSuggestions(3)
  if (suggestions.length === 0) return null

  return (
    <Panel title="Nên theo dõi">
      <ul>
        {suggestions.map((profile) => (
          <SuggestionRow
            key={profile.id}
            profile={profile}
            onFollow={() => follow(profile.id)}
            onDismiss={() => dismiss(profile.id)}
          />
        ))}
      </ul>
    </Panel>
  )
}

function SuggestionRow({
  profile,
  onFollow,
  onDismiss,
}: {
  profile: FollowSuggestion
  onFollow: () => void
  onDismiss: () => void
}) {
  return (
    <li className="flex items-center gap-2 px-4 py-3">
      <Link href={profilePath(profile.id)} className="flex min-w-0 flex-1 items-center gap-2.5">
        <ProfileAvatar profile={profile} size="lg" />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="flex items-center gap-1">
            <span className="truncate text-sm font-bold">{profile.fullName}</span>
            {profile.isProfessional && <VerifiedBadge label={PROFESSIONAL_LABEL} />}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            @{profile.username}
          </span>
          <span className="line-clamp-2 text-xs text-muted-foreground">
            {reasonLabel[profile.reason](profile.mutualCount)}
          </span>
        </span>
      </Link>
      <Button size="pill-sm" shape="pill" onClick={onFollow}>
        Theo dõi
        <span className="sr-only"> {profile.fullName}</span>
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        shape="pill"
        aria-label={`Ẩn gợi ý ${profile.fullName}`}
        onClick={onDismiss}
      >
        <XIcon aria-hidden />
      </Button>
    </li>
  )
}
