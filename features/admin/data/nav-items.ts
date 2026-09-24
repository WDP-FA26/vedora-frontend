import {
  BadgeCheckIcon,
  BellIcon,
  ChartColumnIcon,
  CircleHelpIcon,
  FileTextIcon,
  HouseIcon,
  MenuIcon,
  SettingsIcon,
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

export const adminNavSections: AdminNavSection[] = [
  {
    label: "Chung",
    items: [
      { href: "/admin", label: "Tổng quan", icon: HouseIcon },
      { href: "/admin/notifications", label: "Thông báo", icon: BellIcon },
      { href: "/admin/insights", label: "Thống kê", icon: ChartColumnIcon },
      { href: "/admin/tools", label: "Tất cả công cụ", icon: MenuIcon },
    ],
  },
  {
    label: "Cộng đồng",
    items: [
      { href: "/admin/users", label: "Người dùng", icon: UsersIcon },
      { href: "/admin/verification", label: "Xác minh đầu bếp", icon: BadgeCheckIcon },
    ],
  },
  {
    label: "Nội dung",
    items: [
      { href: "/admin/content", label: "Bài đăng", icon: FileTextIcon },
      { href: "/admin/reports", label: "Kiểm duyệt", icon: ShieldAlertIcon },
    ],
  },
]

export const adminFooterItems: AdminNavItem[] = [
  { href: "/admin/settings", label: "Cài đặt", icon: SettingsIcon },
  { href: "/admin/help", label: "Trợ giúp", icon: CircleHelpIcon },
]
