import { MEAL_PLANNER_PATH } from "@/features/meal-plan/meal-plan"
import { ADMIN_HOME } from "@/features/admin/data/nav-items"
import { ANALYTICS_PATH } from "@/features/post-analytics/post-analytics-cache"
import {
  BookmarkIcon,
  ChartColumnIcon,
  FilePenLineIcon,
  BellIcon,
  MessageCircleIcon,
  BotMessageSquareIcon,
  CompassIcon,
  LifeBuoyIcon,
  UserIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  type LucideIcon,
} from "lucide-react"

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  isNew?: boolean
  /** Left nav only; the phone bar has no room for it. */
  desktopOnly?: boolean
  /** Shown to admins only. */
  adminOnly?: boolean
}

export const navItems: NavItem[] = [
  { href: "/home", label: "Khám phá", icon: CompassIcon },
  { href: "/home/notifications", label: "Thông báo", icon: BellIcon },
  { href: "/home/messages", label: "Tin nhắn", icon: MessageCircleIcon },
  { href: MEAL_PLANNER_PATH, label: "Trợ lý Vedora", icon: BotMessageSquareIcon },
  { href: "/home/bookmarks", label: "Đã lưu", icon: BookmarkIcon },
  { href: "/home/drafts", label: "Bản nháp", icon: FilePenLineIcon, desktopOnly: true },
  { href: ANALYTICS_PATH, label: "Thống kê", icon: ChartColumnIcon, desktopOnly: true },
  { href: "/home/support", label: "Hỗ trợ", icon: LifeBuoyIcon, desktopOnly: true },
  { href: "/home/profile", label: "Hồ sơ", icon: UserIcon },
  { href: "/billing", label: "Gói của bạn", icon: CreditCardIcon, desktopOnly: true },
  {
    href: ADMIN_HOME,
    label: "Quản lý nền tảng",
    icon: ShieldCheckIcon,
    desktopOnly: true,
    adminOnly: true,
  },
]
