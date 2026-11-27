import { RESTAURANTS_PATH, WORKSPACES_PATH } from "@/features/workspaces/workspaces-cache"
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
  MapIcon,
  StoreIcon,
  type LucideIcon,
} from "lucide-react"

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  isNew?: boolean
  desktopOnly?: boolean
  adminOnly?: boolean
  personalOnly?: boolean
}

export const navItems: NavItem[] = [
  { href: "/home", label: "Khám phá", icon: CompassIcon },
  { href: RESTAURANTS_PATH, label: "Nhà hàng", icon: MapIcon, isNew: true, desktopOnly: true },
  { href: "/home/notifications", label: "Thông báo", icon: BellIcon },
  { href: "/home/messages", label: "Tin nhắn", icon: MessageCircleIcon },
  { href: MEAL_PLANNER_PATH, label: "Trợ lý Vedora", icon: BotMessageSquareIcon },
  { href: "/home/bookmarks", label: "Đã lưu", icon: BookmarkIcon },
  { href: "/home/drafts", label: "Bản nháp", icon: FilePenLineIcon, desktopOnly: true },
  { href: ANALYTICS_PATH, label: "Thống kê", icon: ChartColumnIcon, desktopOnly: true },
  { href: "/home/support", label: "Hỗ trợ", icon: LifeBuoyIcon, desktopOnly: true },
  { href: "/home/profile", label: "Hồ sơ", icon: UserIcon },
  { href: WORKSPACES_PATH, label: "Trang nhà hàng", icon: StoreIcon, desktopOnly: true },
  { href: "/billing", label: "Gói của bạn", icon: CreditCardIcon, desktopOnly: true, personalOnly: true },
  {
    href: ADMIN_HOME,
    label: "Quản lý nền tảng",
    icon: ShieldCheckIcon,
    desktopOnly: true,
    adminOnly: true,
  },
]
