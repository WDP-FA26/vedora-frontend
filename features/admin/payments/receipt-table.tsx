"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  outcomeLabels,
  receiptsSchema,
  queryString,
  timestamp,
} from "./schema";
import { useAdminPayments } from "./use-admin-payments";
import { PaymentPagination } from "./pagination";

export function ReceiptTable({ basePath }: { basePath: string }) {
  const [page, setPage] = useState(1);
  const separator = basePath.includes("?") ? "&" : "?";
  const receipts = useAdminPayments(
    `${basePath}${separator}page=${page}&limit=25`,
    receiptsSchema,
  );
  if (receipts.error)
    return (
      <Alert variant="destructive">
        <AlertDescription>Không tải được lịch sử webhook.</AlertDescription>
      </Alert>
    );
  if (!receipts.data) return <Skeleton className="h-32" />;
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">Nhận lúc (UTC+7)</th>
              <th className="p-2">Giao dịch / đơn</th>
              <th className="p-2">Kết quả</th>
              <th className="p-2">Giải thích</th>
            </tr>
          </thead>
          <tbody>
            {receipts.data.items.map((receipt) => (
              <tr className="border-b" key={receipt.id}>
                <td className="p-2">{timestamp(receipt.createdAt)}</td>
                <td className="p-2">
                  <p className="font-mono text-xs">
                    {receipt.providerTransactionId}
                  </p>
                  {receipt.intentId ? (
                    <Link
                      className="text-xs text-primary underline underline-offset-4"
                      href={`/admin/payments/${receipt.intentId}`}
                    >
                      Xem đơn
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Chưa gắn với đơn
                    </span>
                  )}
                </td>
                <td className="p-2">
                  <Badge
                    variant={
                      receipt.outcome === "CAPTURED" ? "default" : "secondary"
                    }
                  >
                    {receipt.outcome}
                  </Badge>
                </td>
                <td className="p-2">
                  {outcomeLabels[receipt.outcome] ??
                    "Kết quả xử lý từ hệ thống."}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {receipts.data.total === 0 && (
          <p className="py-6 text-sm text-muted-foreground">
            Chưa có webhook khớp bộ lọc. Điều này chưa xác nhận người dùng đã
            thanh toán.
          </p>
        )}
      </div>
      <PaymentPagination
        page={page}
        limit={25}
        total={receipts.data.total}
        setPage={setPage}
      />
    </div>
  );
}

export function ReceiptWorkspace({ from, to }: { from: string; to: string }) {
  const [draft, setDraft] = useState({
      outcome: "",
      transactionId: "",
      unmatched: "",
    }),
    [filters, setFilters] = useState(draft);
  const path = `/receipts?${queryString({ from, to, ...filters })}`;
  function submit(event: FormEvent) {
    event.preventDefault();
    setFilters({ ...draft, transactionId: draft.transactionId.trim() });
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Webhook dùng cùng khoảng ngày phía trên. Bộ lọc trạng thái/gói/tìm đơn
        không áp dụng ở đây. Chi tiết chỉ gồm dữ liệu đã lưu, không có nội dung
        chuyển khoản hay số tiền nhận sai để phục dựng.
      </p>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span>Kết quả</span>
          <select
            className="h-9 rounded-md border bg-background px-3"
            value={draft.outcome}
            onChange={(event) =>
              setDraft({ ...draft, outcome: event.target.value })
            }
          >
            <option value="">Tất cả</option>
            {Object.keys(outcomeLabels).map((outcome) => (
              <option key={outcome} value={outcome}>
                {outcome}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Mã giao dịch chính xác</span>
          <Input
            maxLength={200}
            placeholder="BANK-…"
            value={draft.transactionId}
            onChange={(event) =>
              setDraft({ ...draft, transactionId: event.target.value })
            }
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Liên kết đơn</span>
          <select
            className="h-9 rounded-md border bg-background px-3"
            value={draft.unmatched}
            onChange={(event) =>
              setDraft({ ...draft, unmatched: event.target.value })
            }
          >
            <option value="">Tất cả</option>
            <option value="true">Chưa gắn với đơn</option>
            <option value="false">Đã gắn với đơn</option>
          </select>
        </label>
        <Button type="submit">Lọc webhook</Button>
      </form>
      <ReceiptTable key={path} basePath={path} />
    </div>
  );
}
