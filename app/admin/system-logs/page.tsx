import type { Metadata } from "next"
import { SystemLogsView } from "@/features/admin/system-logs/system-logs-view"

export const metadata: Metadata = { title: "Nhật ký hệ thống · Vedora Quản trị" }
export default function AdminSystemLogsPage() {
  return <SystemLogsView />
}
