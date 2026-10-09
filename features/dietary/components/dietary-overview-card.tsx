"use client"

import Image from "next/image"
import Link from "next/link"
import useSWR from "swr"
import {
  ArrowRightIcon,
  ShieldCheckIcon,
  ThumbsUpIcon,
  type LucideIcon,
} from "lucide-react"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { DIETARY_PATH, fetchMyDietary, MY_DIETARY_KEY } from "@/features/dietary/dietary"

function compactList(values: string[]) {
  const visible = values.slice(0, 3).join(", ")
  return values.length > 3 ? `${visible} và ${values.length - 3} mục khác` : visible
}

/** The owner's saved dietary profile, summarised on their own profile page. */
export function DietaryOverviewCard() {
  const { accessToken } = useAuth()
  const { data } = useSWR(
    accessToken ? ([MY_DIETARY_KEY, accessToken] as const) : null,
    fetchMyDietary
  )
  const names = (items: { name: string }[] | undefined) => items?.map(({ name }) => name) ?? []
  const avoided = [...names(data?.groups), ...names(data?.ingredients)]

  return (
    <section
      aria-labelledby="dietary-overview-title"
      className="-mx-4 mt-6 border-t border-border px-4 pt-6 pb-1 sm:-mx-5 sm:px-5"
    >
      <div className="flex items-center gap-3">
        <Image
          src="/avocado-sticker.png"
          alt=""
          width={256}
          height={256}
          className="size-12 shrink-0 object-contain drop-shadow-sm"
        />
        <h2 id="dietary-overview-title" className="min-w-0 flex-1 text-base font-bold tracking-tight">
          Hồ sơ ăn uống
        </h2>
        <Link
          href={DIETARY_PATH}
          className="group inline-flex shrink-0 items-center gap-1 rounded-sm text-sm leading-6 font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          Xem chi tiết
          <span className="sr-only"> hồ sơ ăn uống</span>
          <ArrowRightIcon aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 min-[400px]:grid-cols-2">
        <OverviewItem icon={ShieldCheckIcon} label="Không ăn" values={avoided} empty="Chưa khai báo" />
        <OverviewItem icon={ThumbsUpIcon} label="Thích" values={names(data?.liked)} empty="Chưa chọn" />
      </dl>
    </section>
  )
}

function OverviewItem({ icon: Icon, label, values, empty }: {
  icon: LucideIcon
  label: string
  values: string[]
  empty: string
}) {
  return (
    <div className="min-w-0">
      <dt className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Icon aria-hidden className="size-3.5 shrink-0 text-brand-forest dark:text-brand-sprout" />
        {label}
      </dt>
      <dd className={values.length > 0 ? "text-sm leading-5 break-words" : "text-sm leading-5 text-muted-foreground"}>
        {values.length > 0 ? compactList(values) : empty}
      </dd>
    </div>
  )
}
