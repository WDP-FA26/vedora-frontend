"use client"

import type { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRightIcon,
  HeartIcon,
  LeafIcon,
  ShieldCheckIcon,
  ShoppingBasketIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  type LucideIcon,
} from "lucide-react"

import { DIETARY_PATH } from "@/features/dietary/dietary"
import { FOOD_CATALOG, type FoodOption } from "@/features/dietary/dietary-draft"
import { useDietaryDraft } from "@/features/dietary/hooks/use-dietary-draft"

function selectedNames(ids: string[], customOptions: FoodOption[]) {
  const options = new Map([...FOOD_CATALOG, ...customOptions].map((item) => [item.id, item.name]))
  return ids.flatMap((id) => {
    const name = options.get(id)
    return name ? [name] : []
  })
}

function compactList(values: string[]) {
  const visible = values.slice(0, 3).join(", ")
  return values.length > 3 ? `${visible} và ${values.length - 3} mục khác` : visible
}

export function DietaryOverviewCard({ userId }: { userId: string }) {
  const { appliedDraft } = useDietaryDraft(userId)
  const allergens = selectedNames(appliedDraft.allergens, appliedDraft.customAllergens)
  const likes = selectedNames(appliedDraft.likes, appliedDraft.customPreferences)
  const dislikes = selectedNames(appliedDraft.dislikes, appliedDraft.customPreferences)
  const pantry = appliedDraft.pantry.map((item) =>
    item.amount ? `${item.name} (${item.amount} ${item.unit})` : item.name
  )
  const dietLabel = appliedDraft.dietMode === "vegan"
    ? "Thuần chay"
    : appliedDraft.dietMode === "vegetarian"
      ? "Ăn chay"
      : "Chưa thiết lập"
  const allergyLabel = appliedDraft.allergyStatus === "none"
    ? "Không có dị ứng"
    : appliedDraft.allergyStatus === "some" && allergens.length > 0
      ? compactList(allergens)
      : "Chưa khai báo"

  return (
    <section
      aria-label="Tổng quan hồ sơ ăn uống"
      className="mt-5 overflow-hidden rounded-3xl border border-brand-leaf/20 bg-[#f2f7ee] dark:bg-brand-forest/15"
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 sm:px-5">
        <div className="min-w-0">
          <p className="mb-1 flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-[0.15em] text-brand-forest dark:text-brand-sprout">
            <LeafIcon aria-hidden className="size-3.5" />
            Dành riêng cho bạn
          </p>
          <h2 className="text-lg font-bold tracking-tight">Hồ sơ ăn uống</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">Tổng quan lựa chọn ăn uống của bạn</p>
        </div>
        <Image
          src="/avocado-sticker.png"
          alt=""
          width={256}
          height={256}
          className="size-20 shrink-0 object-contain drop-shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 px-4 min-[400px]:grid-cols-2 sm:px-5">
        <OverviewItem icon={LeafIcon} label="Chế độ ăn">
          <p className={appliedDraft.dietMode ? "font-medium" : "text-muted-foreground"}>{dietLabel}</p>
        </OverviewItem>
        <OverviewItem icon={ShieldCheckIcon} label="Dị ứng">
          <p className={appliedDraft.allergyStatus === "unset" ? "text-muted-foreground" : "font-medium"}>{allergyLabel}</p>
        </OverviewItem>
        <OverviewItem icon={HeartIcon} label="Sở thích">
          {likes.length === 0 && dislikes.length === 0 ? (
            <p className="text-muted-foreground">Chưa chọn sở thích</p>
          ) : (
            <div className="space-y-1.5">
              {likes.length > 0 && (
                <p className="flex items-start gap-1.5">
                  <ThumbsUpIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-brand-forest dark:text-brand-sprout" />
                  <span><span className="sr-only">Thích: </span>{compactList(likes)}</span>
                </p>
              )}
              {dislikes.length > 0 && (
                <p className="flex items-start gap-1.5">
                  <ThumbsDownIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-rose-500" />
                  <span><span className="sr-only">Không thích: </span>{compactList(dislikes)}</span>
                </p>
              )}
            </div>
          )}
        </OverviewItem>
        <OverviewItem icon={ShoppingBasketIcon} label="Nguyên liệu sẵn có">
          {pantry.length > 0 ? (
            <p>{compactList(pantry)}</p>
          ) : (
            <p className="text-muted-foreground">Chưa thêm nguyên liệu</p>
          )}
        </OverviewItem>
      </div>

      <Link
        href={DIETARY_PATH}
        className="group m-2 mt-3 flex items-center justify-between gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-primary transition-colors hover:bg-brand-leaf/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:mx-3"
      >
        Xem hồ sơ ăn uống
        <ArrowRightIcon aria-hidden className="size-4 transition-transform group-hover:translate-x-1" />
      </Link>
    </section>
  )
}

function OverviewItem({ icon: Icon, label, children }: { icon: LucideIcon, label: string, children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-brand-leaf/10 bg-card/85 p-3">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Icon aria-hidden className="size-3.5 shrink-0 text-brand-forest dark:text-brand-sprout" />
        {label}
      </h3>
      <div className="text-sm leading-5 break-words">{children}</div>
    </div>
  )
}
