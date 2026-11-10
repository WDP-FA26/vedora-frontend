"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { money, ordersSchema, statusLabels, timestamp } from "./schema";
import { useAdminPayments } from "./use-admin-payments";
import { PaymentPagination } from "./pagination";

export function OrderTable({ query }: { query: string }) {
  const [page, setPage] = useState(1);
  const orders = useAdminPayments(
    `/orders?${query}&page=${page}&limit=25`,
    ordersSchema,
  );
  if (orders.error)
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Không tải được danh sách đơn. Vui lòng tải lại hoặc kiểm tra quyền
          Admin.
        </AlertDescription>
      </Alert>
    );
  if (!orders.data)
    return (
      <div role="status" aria-label="Đang tải đơn">
        <Skeleton className="h-48" />
      </div>
    );
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">Đơn / mã thanh toán</th>
              <th className="p-2">Người dùng</th>
              <th className="p-2">Gói đã mua</th>
              <th className="p-2">Số tiền</th>
              <th className="p-2">Trạng thái</th>
              <th className="p-2">Tạo / xác nhận (UTC+7)</th>
            </tr>
          </thead>
          <tbody>
            {orders.data.items.map((order) => (
              <tr className="border-b" key={order.id}>
                <td className="p-2">
                  <Link
                    href={`/admin/payments/${order.id}`}
                    className="text-primary underline underline-offset-4"
                  >
                    {order.invoiceNumber}
                  </Link>
                  <p className="font-mono text-xs">{order.paymentCode}</p>
                </td>
                <td className="p-2">
                  <p>
                    {order.customer?.username ?? "Tài khoản không còn tồn tại"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {order.customer?.email ?? order.userId}
                  </p>
                </td>
                <td className="p-2">
                  {order.purchasedPlanName}
                  <p className="text-xs text-muted-foreground">
                    {order.durationDays} ngày
                  </p>
                </td>
                <td className="p-2 tabular-nums">
                  {money(order.amount, order.currency)}
                </td>
                <td className="p-2">
                  <Badge
                    variant={
                      order.status === "SUCCEEDED" ? "default" : "secondary"
                    }
                  >
                    {statusLabels[order.status]}
                  </Badge>
                </td>
                <td className="p-2">
                  <p>{timestamp(order.createdAt)}</p>
                  <p className="text-xs text-muted-foreground">
                    {timestamp(order.capturedAt)}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.data.items.length === 0 && (
          <p className="py-6 text-sm text-muted-foreground">
            Không có đơn khớp bộ lọc.
          </p>
        )}
      </div>
      <PaymentPagination
        page={page}
        limit={25}
        total={orders.data.total}
        setPage={setPage}
      />
    </div>
  );
}
