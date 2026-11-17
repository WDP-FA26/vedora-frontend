import { ADMIN_HOME } from "@/features/admin/data/nav-items"
import {
  BookmarkIcon,
  BellIcon,
  MessageCircleIcon,
  CalendarDaysIcon,
  CompassIcon,
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
  { href: "/home/meal-planner", label: "Lên thực đơn", icon: CalendarDaysIcon },
  { href: "/home/bookmarks", label: "Đã lưu", icon: BookmarkIcon },
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
