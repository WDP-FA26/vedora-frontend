import {
  BookmarkIcon,
  BellIcon,
  CalendarDaysIcon,
  CompassIcon,
  SettingsIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  isNew?: boolean
}

export const navItems: NavItem[] = [
  { href: "/home", label: "Khám phá", icon: CompassIcon },
  { href: "/home/notifications", label: "Thông báo", icon: BellIcon },
  { href: "/home/meal-planner", label: "Lên thực đơn", icon: CalendarDaysIcon },
  { href: "/home/bookmarks", label: "Đã lưu", icon: BookmarkIcon },
  { href: "/home/profile", label: "Hồ sơ", icon: UserIcon },
  { href: "/home/settings", label: "Cài đặt", icon: SettingsIcon },
]
