import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth } from "@/features/auth/server/session";
import { defaultDashboardRange } from "@/features/admin/dashboard/dashboard-schema";
import { AdminPaymentsView } from "@/features/admin/payments/admin-payments-view";

export const metadata: Metadata = { title: "Thanh toán · Vedora Quản trị" };
export default async function AdminPaymentsPage() {
  const user = await requireAuth("/admin/payments");
  if (user.role !== "ADMIN") redirect("/home");
  return <AdminPaymentsView initialRange={defaultDashboardRange()} />;
}
