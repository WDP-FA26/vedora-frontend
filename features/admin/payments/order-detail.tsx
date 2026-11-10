"use client";

import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/features/shared/lib/api-client";
import {
  money,
  outcomeLabels,
  paymentDetailSchema,
  planLabel,
  statusLabels,
  timestamp,
} from "./schema";
import { useAdminPayments } from "./use-admin-payments";
import { ReceiptTable } from "./receipt-table";

export function AdminOrderDetail({ id }: { id: string }) {
  const detail = useAdminPayments(`/orders/${id}`, paymentDetailSchema);
  if (detail.error)
    return (
      <div className="space-y-4 p-6">
        <Link href="/admin/payments" className="text-primary underline">
          Quay lại thanh toán
        </Link>
        <Alert variant="destructive">
          <AlertDescription>
            {detail.error instanceof ApiError && detail.error.status === 404
              ? "Không tìm thấy đơn thanh toán."
              : "Không tải được chi tiết đơn. Kiểm tra quyền Admin hoặc thử lại."}
          </AlertDescription>
        </Alert>
      </div>
    );
  if (!detail.data)
    return (
      <div role="status" aria-label="Đang tải chi tiết đơn" className="p-6">
        <Skeleton className="h-64" />
      </div>
    );
  const { order, merchant, currentMembership, webhookSummary } = detail.data;
  const rows = [
    ["Mã đơn", order.id],
    ["Mã thanh toán", order.paymentCode],
    [
      "Người dùng",
      order.customer
        ? `${order.customer.username} · ${order.customer.email}`
        : "Tài khoản không còn tồn tại",
    ],
    ["ID người dùng", order.userId],
    ["Trạng thái tài khoản", order.customer?.status ?? "—"],
    ["Gói lúc mua", `${order.purchasedPlanName} · ${order.durationDays} ngày`],
    [
      "Quyền lợi chu kỳ mua",
      `${order.textLimit} lượt văn bản / ${order.imageLimit} ảnh`,
    ],
    ["Số tiền", money(order.amount, order.currency)],
    ["Tạo lúc", timestamp(order.createdAt)],
    ["Ngân hàng báo trả lúc", timestamp(order.paidAt)],
    ["BE xác nhận lúc", timestamp(order.capturedAt)],
    ["Chu kỳ đơn này hết hạn", timestamp(order.subscriptionExpiresAt)],
    ["Hủy lúc", timestamp(order.cancelledAt)],
    ["Giao dịch provider", order.providerTransactionId ?? "—"],
    ["Mã tham chiếu provider", order.providerReference ?? "—"],
    [
      "Tài khoản nhận",
      `${merchant.bankGateway} · ****${merchant.accountLast4}`,
    ],
  ];
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Link
            href="/admin/payments"
            className="text-sm text-primary underline underline-offset-4"
          >
            ← Thanh toán
          </Link>
          <h2 className="font-heading text-2xl font-semibold">
            {order.invoiceNumber}
          </h2>
          <Badge
            variant={order.status === "SUCCEEDED" ? "default" : "secondary"}
          >
            {statusLabels[order.status]}
          </Badge>
        </div>
        <Button
          variant="outline"
          disabled={detail.isValidating}
          onClick={() => void detail.mutate()}
        >
          Tải lại chi tiết
        </Button>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Đơn và thông tin xác nhận</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y">
            {rows.map(([label, value]) => (
              <div
                key={label}
                className="grid gap-1 py-3 text-sm sm:grid-cols-[12rem_1fr]"
              >
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="break-all">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Gói hiện tại của tài khoản</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>
              {planLabel(currentMembership.planCode)} · hết hạn{" "}
              {timestamp(currentMembership.expiresAt)}
            </p>
            <p className="text-muted-foreground">
              {currentMembership.isCurrentPurchase
                ? "Đơn này đang xác định chu kỳ hiện tại."
                : "Đơn này không xác định gói hiện tại: có thể đã hết hạn, đã được thay thế hoặc chưa thanh toán."}
            </p>
            <p className="text-muted-foreground">
              Gói được tính từ lần mua thành công mới nhất; tài khoản bị khóa
              hoặc xóa vẫn có thể có lịch sử thanh toán.
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Kết quả webhook · {webhookSummary.total} lần</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            {webhookSummary.outcomes.map((item) => (
              <p key={item.outcome}>
                <strong>
                  {item.outcome} ({item.count}):
                </strong>{" "}
                {outcomeLabels[item.outcome] ?? "Kết quả xử lý từ hệ thống."}
              </p>
            ))}
            <p className="text-muted-foreground">
              Lịch sử dưới đây không giới hạn theo ngày tạo đơn. Chỉ có metadata
              đã lưu; không có nội dung chuyển khoản, số tiền nhận sai hoặc
              payload gốc để phục dựng.
            </p>
            <ReceiptTable
              key={String(detail.data.webhookSummary.total)}
              basePath={`/orders/${id}/receipts`}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
