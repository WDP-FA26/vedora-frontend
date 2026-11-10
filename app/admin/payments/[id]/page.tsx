import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireAuth } from "@/features/auth/server/session";
import { AdminOrderDetail } from "@/features/admin/payments/order-detail";

export const metadata: Metadata = {
  title: "Chi tiết thanh toán · Vedora Quản trị",
};
export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireAuth(`/admin/payments/${id}`);
  if (user.role !== "ADMIN") redirect("/home");
  return <AdminOrderDetail id={id} />;
}
