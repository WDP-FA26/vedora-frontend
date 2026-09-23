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
  { href: "/app", label: "Khám phá", icon: CompassIcon },
  { href: "/app/notifications", label: "Thông báo", icon: BellIcon },
  { href: "/app/meal-planner", label: "Lên thực đơn", icon: CalendarDaysIcon },
  { href: "/app/bookmarks", label: "Đã lưu", icon: BookmarkIcon },
  { href: "/app/profile", label: "Hồ sơ", icon: UserIcon },
  { href: "/app/settings", label: "Cài đặt", icon: SettingsIcon },
]
