"use client";

import { useState, type FormEvent } from "react";
import { DownloadIcon, RefreshCwIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { API_URL } from "@/features/auth/lib/api";
import { ApiError, send } from "@/features/shared/lib/api-client";
import {
  validDashboardRange,
  type DashboardRange,
} from "@/features/admin/dashboard/dashboard-schema";
import {
  money,
  orderStatus,
  paymentOverviewSchema,
  queryString,
  statusLabels,
} from "./schema";
import { useAdminPayments } from "./use-admin-payments";
import { PaymentOverviewCards } from "./payment-overview";
import { OrderTable } from "./order-table";
import { ReceiptWorkspace } from "./receipt-table";
import { SubscriptionWorkspace } from "./subscription-table";

type Filters = DashboardRange & { status: string; plan: string; q: string };
type View = "orders" | "receipts" | "subscriptions";
export function AdminPaymentsView({
  initialRange,
}: {
  initialRange: DashboardRange;
}) {
  const { accessToken } = useAuth();
  const [filters, setFilters] = useState<Filters>({
      ...initialRange,
      status: "",
      plan: "",
      q: "",
    }),
    [draft, setDraft] = useState(filters);
  const [view, setView] = useState<View>("orders"),
    [revision, setRevision] = useState(0),
    [error, setError] = useState<string | null>(null),
    [exporting, setExporting] = useState(false);
  const query = queryString(filters);
  const overview = useAdminPayments(
    `/overview?${query}`,
    paymentOverviewSchema,
  );
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!validDashboardRange(draft)) {
      setError("Chọn khoảng ngày hợp lệ, tối đa 90 ngày theo UTC+7.");
      return;
    }
    setError(null);
    setFilters({ ...draft, q: draft.q.trim() });
  }
  function refresh() {
    void overview.mutate();
    setRevision((value) => value + 1);
  }
  async function download() {
    if (!accessToken || exporting) return;
    setExporting(true);
    setError(null);
    try {
      const response = await send(
        `${API_URL}/admin/payments/export?${query}`,
        accessToken,
        { cache: "no-store" },
      );
      const url = URL.createObjectURL(await response.blob()),
        anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `vedora-payments-${filters.from}-${filters.to}.csv`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 400
          ? "CSV vượt 10.000 đơn hoặc bộ lọc không hợp lệ. Vui lòng thu hẹp bộ lọc."
          : "Không tải được CSV. Vui lòng thử lại.",
      );
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="space-y-2">
        <h2 className="font-heading text-2xl font-semibold">
          Thanh toán và gói thành viên
        </h2>
        <p className="text-sm text-muted-foreground">
          Tra cứu đơn, đối soát kết quả webhook và theo dõi gói còn hạn.
        </p>
      </header>
      <form className="flex flex-wrap items-end gap-3" onSubmit={submit}>
        <label className="space-y-1 text-sm">
          <span>Từ ngày</span>
          <Input
            required
            type="date"
            value={draft.from}
            onChange={(event) =>
              setDraft({ ...draft, from: event.target.value })
            }
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Đến ngày</span>
          <Input
            required
            type="date"
            value={draft.to}
            onChange={(event) => setDraft({ ...draft, to: event.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Trạng thái đơn</span>
          <select
            className="h-9 rounded-md border bg-background px-3"
            value={draft.status}
            onChange={(event) =>
              setDraft({ ...draft, status: event.target.value })
            }
          >
            <option value="">Tất cả</option>
            {orderStatus.options.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Gói đơn hàng</span>
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
          <span>Tìm chính xác mã đơn/mã thanh toán/email/tên đăng nhập/ID</span>
          <Input
            maxLength={200}
            value={draft.q}
            onChange={(event) => setDraft({ ...draft, q: event.target.value })}
            placeholder="Nhập đầy đủ giá trị"
          />
        </label>
        <Button type="submit">Áp dụng</Button>
        <Button
          type="button"
          variant="outline"
          onClick={refresh}
          disabled={overview.isValidating}
        >
          <RefreshCwIcon aria-hidden /> Tải lại
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void download()}
          disabled={exporting}
        >
          <DownloadIcon aria-hidden />
          {exporting ? "Đang xuất…" : "Xuất đơn CSV"}
        </Button>
      </form>
      <Alert>
        <AlertDescription>
          Danh sách và CSV lọc theo ngày tạo đơn. Tiền đã xác nhận lọc theo ngày
          BE xác nhận, nên có thể gồm đơn tạo trước khoảng ngày đã chọn. Các bộ
          lọc đơn cũng áp dụng cho thống kê tiền; chọn trạng thái chờ/hủy sẽ
          không có tiền đã xác nhận.
        </AlertDescription>
      </Alert>
      {(error || overview.error) && (
        <Alert variant="destructive">
          <AlertDescription>
            {error ??
              "Không tải được thống kê. Kiểm tra quyền Admin hoặc thử lại."}
          </AlertDescription>
        </Alert>
      )}
      {!overview.data && !overview.error && (
        <div role="status" aria-label="Đang tải thống kê thanh toán">
          <Skeleton className="h-40" />
        </div>
      )}
      {overview.data && <PaymentOverviewCards data={overview.data} />}
      <Card>
        <CardHeader>
          <CardTitle>Tra cứu</CardTitle>
          <CardDescription>
            Đơn hàng, kết quả webhook và gói đang còn hiệu lực.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="Chọn nội dung tra cứu"
            >
              {(
                [
                  ["orders", "Đơn thanh toán"],
                  ["receipts", "Webhook"],
                  ["subscriptions", "Gói còn hạn"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  variant={view === value ? "default" : "outline"}
                  aria-pressed={view === value}
                  onClick={() => setView(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
            {view === "orders" && (
              <OrderTable key={`${query}:${revision}`} query={query} />
            )}
            {view === "receipts" && (
              <ReceiptWorkspace
                key={`${filters.from}:${filters.to}:${revision}`}
                from={filters.from}
                to={filters.to}
              />
            )}
            {view === "subscriptions" && (
              <SubscriptionWorkspace key={revision} />
            )}
          </div>
        </CardContent>
      </Card>
      {overview.data && overview.data.daily.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Thống kê theo ngày</CardTitle>
            <CardDescription>
              UTC+7 · tạo đơn và xác nhận là hai mốc thời gian riêng.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2">Ngày</th>
                    <th className="p-2">Đơn tạo</th>
                    <th className="p-2">Đơn xác nhận</th>
                    <th className="p-2">Tiền xác nhận</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.data.daily.map((day) => (
                    <tr key={day.date} className="border-b">
                      <td className="p-2">{day.date}</td>
                      <td className="p-2">{day.createdOrders}</td>
                      <td className="p-2">{day.capturedOrders}</td>
                      <td className="p-2 tabular-nums">
                        {money(day.confirmedVnd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
