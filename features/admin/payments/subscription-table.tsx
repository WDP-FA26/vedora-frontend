"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  planLabel,
  queryString,
  subscriptionsSchema,
  timestamp,
} from "./schema";
import { useAdminPayments } from "./use-admin-payments";
import { PaymentPagination } from "./pagination";

function Subscribers({ query }: { query: string }) {
  const [page, setPage] = useState(1);
  const subscriptions = useAdminPayments(
    `/subscriptions?${query}&page=${page}&limit=25`,
    subscriptionsSchema,
  );
  if (subscriptions.error)
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Không tải được danh sách gói còn hạn.
        </AlertDescription>
      </Alert>
    );
  if (!subscriptions.data) return <Skeleton className="h-32" />;
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Tại {timestamp(subscriptions.data.asOf)} (UTC+7). Chỉ tài khoản hoạt
        động, email đã xác minh; mỗi người có tối đa một gói hiện tại.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2">Người dùng</th>
              <th className="p-2">Gói hiện tại</th>
              <th className="p-2">Bắt đầu / hết hạn</th>
              <th className="p-2">Đơn kích hoạt</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.data.items.map((order) => (
              <tr key={order.id} className="border-b">
                <td className="p-2">
                  <p>{order.customer?.username}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.customer?.email}
                  </p>
                  <code className="text-xs text-muted-foreground">
                    {order.userId}
                  </code>
                </td>
                <td className="p-2">
                  {planLabel(order.planCode)}
                  <p className="text-xs text-muted-foreground">
                    Đã mua: {order.purchasedPlanName}
                  </p>
                </td>
                <td className="p-2">
                  <p>{timestamp(order.capturedAt)}</p>
                  <p>{timestamp(order.subscriptionExpiresAt)}</p>
                </td>
                <td className="p-2">
                  <Link
                    className="text-primary underline underline-offset-4"
                    href={`/admin/payments/${order.id}`}
                  >
                    {order.invoiceNumber}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {subscriptions.data.total === 0 && (
          <p className="py-6 text-sm text-muted-foreground">
            Không có gói còn hạn khớp bộ lọc.
          </p>
        )}
      </div>
      <PaymentPagination
        page={page}
        limit={25}
        total={subscriptions.data.total}
        setPage={setPage}
      />
    </div>
  );
}
export function SubscriptionWorkspace() {
  const [draft, setDraft] = useState({ plan: "", userId: "" }),
    [filters, setFilters] = useState(draft),
    [error, setError] = useState<string | null>(null);
  const query = queryString(filters);
  function submit(event: FormEvent) {
    event.preventDefault();
    const userId = draft.userId.trim();
    if (userId && !z.uuid().safeParse(userId).success) {
      setError("ID người dùng cần là UUID hợp lệ.");
      return;
    }
    setError(null);
    setFilters({ ...draft, userId });
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Danh sách gói đang còn hạn tại thời điểm hiện tại, độc lập khoảng ngày
        và bộ lọc đơn phía trên.
      </p>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span>Gói</span>
          <select
            className="h-9 rounded-md border bg-background px-3"
            value={draft.plan}
            onChange={(event) =>
              setDraft({ ...draft, plan: event.target.value })
            }
          >
            <option value="">Tất cả</option>
            <option value="PLUS">Plus</option>
            <option value="PRO">Pro</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>ID người dùng</span>
          <Input
            maxLength={36}
            value={draft.userId}
            onChange={(event) =>
              setDraft({ ...draft, userId: event.target.value })
            }
            placeholder="Tất cả người dùng"
          />
        </label>
        <Button type="submit">Lọc gói</Button>
      </form>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Subscribers key={query} query={query} />
    </div>
  );
}
