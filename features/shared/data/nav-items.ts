import {
  BookmarkIcon,
  BellIcon,
  CalendarDaysIcon,
  CompassIcon,
  NotebookPenIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react"

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  isNew?: boolean
  /** Left nav only; the phone bar has no room for it. */
  desktopOnly?: boolean
}

export const navItems: NavItem[] = [
  { href: "/home", label: "Khám phá", icon: CompassIcon },
  { href: "/home/notifications", label: "Thông báo", icon: BellIcon },
  { href: "/home/meal-planner", label: "Lên thực đơn", icon: CalendarDaysIcon },
  { href: "/home/blogs", label: "Blog", icon: NotebookPenIcon, desktopOnly: true },
  { href: "/home/bookmarks", label: "Đã lưu", icon: BookmarkIcon },
  { href: "/home/profile", label: "Hồ sơ", icon: UserIcon },
]
