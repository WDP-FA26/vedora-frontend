import {
  BookmarkIcon,
  ChartNoAxesColumnIcon,
  HeartIcon,
  MessageCircleIcon,
  Repeat2Icon,
  UserPlusIcon,
  type LucideIcon,
} from "lucide-react"

/**
 * The period metrics, in the order the page shows them. Saves lead: they say
 * a dish was worth cooking again, which matters more here than reach.
 */
export const SUMMARY_METRICS = [
  "saves",
  "comments",
  "likes",
  "reposts",
  "newFollowers",
  "views",
] as const
export type SummaryMetric = (typeof SUMMARY_METRICS)[number]

export const DEFAULT_METRIC: SummaryMetric = "saves"

type MetricMeta = {
  label: string
  /** One plain-language line on what is counted. */
  description: string
  icon: LucideIcon
}

export const METRIC_META: Record<SummaryMetric, MetricMeta> = {
  saves: {
    label: "Lượt lưu",
    description: "Số lần người khác lưu bài của bạn để xem lại.",
    icon: BookmarkIcon,
  },
  comments: {
    label: "Bình luận",
    description: "Bình luận và trả lời của người khác trên bài của bạn.",
    icon: MessageCircleIcon,
  },
  likes: {
    label: "Thích",
    description: "Lượt Thích của người khác, không tính bạn tự Thích.",
    icon: HeartIcon,
  },
  reposts: {
    label: "Đăng lại",
    description: "Số lần người khác đăng lại bài của bạn.",
    icon: Repeat2Icon,
  },
  newFollowers: {
    label: "Theo dõi mới",
    description: "Người bắt đầu theo dõi bạn và vẫn đang theo dõi.",
    icon: UserPlusIcon,
  },
  views: {
    label: "Lượt xem",
    description: "Số lần bài hiện trên màn hình người xem, gần đúng, mỗi người tối đa một lần trong 30 phút.",
    icon: ChartNoAxesColumnIcon,
  },
}

export const numberFormat = new Intl.NumberFormat("vi-VN")

const compactFormat = new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 })

/** Exact below 10.000, then "93,9 N" / "3,6 Tr" so large counts fit a tab or an axis. */
export function formatCompact(value: number): string {
  if (Math.abs(value) < 10_000) return numberFormat.format(value)
  return compactFormat.format(value)
}
