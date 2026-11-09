import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth } from "@/features/auth/server/session";
import { AiCostsView } from "@/features/admin/ai-costs/ai-costs-view";
import { defaultDashboardRange } from "@/features/admin/dashboard/dashboard-schema";

export const metadata: Metadata = { title: "Chi phí AI · Vedora Quản trị" };
export default async function AdminAiCostsPage() {
  const user = await requireAuth("/admin/ai-costs");
  if (user.role !== "ADMIN") redirect("/home");
  return <AiCostsView initialRange={defaultDashboardRange()} />;
}
