import {
  BadgeCheckIcon,
  BookOpenIcon,
  ChartColumnIcon,
  FileTextIcon,
  LibraryIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  SettingsIcon,
  CreditCardIcon,
  ScrollTextIcon,
  StoreIcon,
  ShieldAlertIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  workBadge?: "total" | "moderation" | "verification" | "workspaces" | "support" | "knowledge";
  workCount?: "POST_REVIEW";
};

export type AdminNavSection = {
  label: string;
  items: AdminNavItem[];
};

export const ADMIN_HOME = "/admin/overview";

export const adminNavItems: AdminNavItem[] = [
  { href: "/admin/overview", label: "Tổng quan", icon: LayoutDashboardIcon, workBadge: "total" },
  { href: "/admin/users", label: "Người dùng", icon: UsersIcon },
  {
    href: "/admin/verification",
    label: "Xác minh chuyên gia",
    icon: BadgeCheckIcon,
    workBadge: "verification",
  },
  { href: "/admin/workspaces", label: "Trang nhà hàng", icon: StoreIcon, workBadge: "workspaces" },
  { href: "/admin/insights", label: "Thống kê", icon: ChartColumnIcon },
];

export const adminNavSections: AdminNavSection[] = [
  {
    label: "Nội dung",
    items: [
      { href: "/admin/content", label: "Bài đăng", icon: FileTextIcon, workCount: "POST_REVIEW" },
      { href: "/admin/reports", label: "Kiểm duyệt", icon: ShieldAlertIcon, workBadge: "moderation" },
      { href: "/admin/support", label: "Hỗ trợ & Kháng cáo", icon: LifeBuoyIcon, workBadge: "support" },
      { href: "/admin/recipes", label: "Công thức", icon: BookOpenIcon },
      {
        href: "/admin/knowledge",
        label: "Tài liệu kiến thức",
        icon: LibraryIcon,
        workBadge: "knowledge",
      },
    ],
  },
  {
    label: "Hệ thống",
    items: [
      { href: "/admin/system-logs", label: "Nhật ký hệ thống", icon: ScrollTextIcon },
      { href: "/admin/ai-costs", label: "Chi phí AI", icon: ChartColumnIcon },
      { href: "/admin/payments", label: "Thanh toán", icon: ChartColumnIcon },
      { href: "/admin/subscription-plans", label: "Gói đăng ký", icon: CreditCardIcon },
      {
        href: "/admin/settings",
        label: "Cài đặt kiểm duyệt",
        icon: SettingsIcon,
      },
    ],
  },
];

export const allAdminNavItems = [
  ...adminNavItems,
  ...adminNavSections.flatMap((section) => section.items),
];

export function isAdminNavActive(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
