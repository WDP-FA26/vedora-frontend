import {
  BadgeCheckIcon,
  BookOpenIcon,
  ChartColumnIcon,
  FileTextIcon,
  LibraryIcon,
  ShieldAlertIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

export type AdminNavItem = {
  href: string
  label: string
  icon: LucideIcon
}

export type AdminNavSection = {
  label: string
  items: AdminNavItem[]
}

/** Where `/admin` lands. */
export const ADMIN_HOME = "/admin/users"

export const adminNavItems: AdminNavItem[] = [
  { href: "/admin/users", label: "Người dùng", icon: UsersIcon },
  { href: "/admin/verification", label: "Xác minh chuyên gia", icon: BadgeCheckIcon },
  { href: "/admin/insights", label: "Thống kê", icon: ChartColumnIcon },
]

export const adminNavSections: AdminNavSection[] = [
  {
    label: "Nội dung",
    items: [
      { href: "/admin/content", label: "Bài đăng", icon: FileTextIcon },
      { href: "/admin/reports", label: "Kiểm duyệt", icon: ShieldAlertIcon },
      { href: "/admin/recipes", label: "Công thức", icon: BookOpenIcon },
      { href: "/admin/knowledge", label: "Tài liệu kiến thức", icon: LibraryIcon },
    ],
  },
]

export const allAdminNavItems = [
  ...adminNavItems,
  ...adminNavSections.flatMap((section) => section.items),
]

export function isAdminNavActive(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}
