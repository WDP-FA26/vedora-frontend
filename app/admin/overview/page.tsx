import type { Metadata } from "next"
import { AdminOverviewView } from "@/features/admin/overview/overview-view"

export const metadata: Metadata = { title: "Tổng quan · Vedora Quản trị" }
export default function AdminOverviewPage() {
  return <AdminOverviewView />
}
