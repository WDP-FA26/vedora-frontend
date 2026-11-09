"use client";

import { useState, type FormEvent } from "react";
import { DownloadIcon, RefreshCwIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr";
import { API_URL } from "@/features/auth/lib/api";
import { ApiError, send, sendJson } from "@/features/shared/lib/api-client";
import {
  validDashboardRange,
  type DashboardRange,
} from "@/features/admin/dashboard/dashboard-schema";
import {
  costCallSchema,
  costCallsSchema,
  costReportSchema,
  dollars,
  featureLabels,
  type CostReport,
} from "./schema";

const number = new Intl.NumberFormat("vi-VN");
type Filters = DashboardRange & { feature: string; model: string };
const parameters = (filters: Filters) =>
  new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value !== ""),
  ).toString();
const reportFetcher = ([url, token]: readonly [string, string]) =>
  sendJson(costReportSchema, url, token, { cache: "no-store" });
const callsFetcher = ([url, token]: readonly [string, string]) =>
  sendJson(costCallsSchema, url, token, { cache: "no-store" });
const errorCopy = (error: unknown) =>
  error instanceof ApiError && error.status === 403
    ? "Bạn không có quyền quản trị để xem dữ liệu này."
    : "Không tải được dữ liệu. Vui lòng thử lại.";

function Report({ data }: { data: CostReport }) {
  const s = data.summary;
  return (
    <>
      <Alert>
        <AlertDescription>
          Chỉ ghi nhận các lần gọi sau khi tính năng được triển khai. Chi phí
          USD do OpenRouter trả về, chưa gồm phí nạp credit, tỷ giá, thuế và hạ
          tầng. Khi lọc ngày/model, chi phí lượt là tổng các lần gọi nằm trong
          bộ lọc, có thể chỉ là một phần của lượt.
        </AlertDescription>
      </Alert>
      {s.unknownCalls > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            Có {number.format(s.unknownCalls)} lần gọi chưa biết chi phí, trong
            đó {number.format(s.pendingCalls)} lần đang chờ kết thúc hoặc cần
            kiểm tra. Tổng đã biết chưa phải toàn bộ chi phí. Mean/P95 chỉ tính{" "}
            {number.format(s.fullyPricedTurns)} lượt đủ chi phí trong bộ lọc.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [
            "Chi phí đã biết",
            dollars(s.knownSpendUsd),
            `${s.knownCalls}/${s.calls} lần gọi có chi phí; ${s.duplicateCalls} lần trùng charge đã loại`,
          ],
          [
            "Trung bình / lượt đủ chi phí",
            dollars(s.meanKnownTurnUsd),
            `${s.fullyPricedTurns}/${s.turns} lượt trong bộ lọc`,
          ],
          [
            "P95 / lượt đủ chi phí",
            dollars(s.p95KnownTurnUsd),
            "Phân vị nearest-rank; không cộng reasoning hai lần",
          ],
          [
            "Token input / output",
            `${number.format(s.inputTokens)} / ${number.format(s.outputTokens)}`,
            `${number.format(s.unknownTokenCalls)} lần gọi thiếu input/output; ${number.format(s.failedCalls)} lần lỗi/ngắt`,
          ],
        ].map(([title, value, note]) => (
          <Card key={title}>
            <CardHeader>
              <CardDescription>{title}</CardDescription>
              <CardTitle>{value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{note}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Chi phí đã biết theo ngày</CardTitle>
          <CardDescription>
            Ngày theo UTC+7 · các ngày chưa ghi nhận không có cột.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.daily.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Chưa có lần gọi nào trong khoảng này.
            </p>
          ) : (
            <ChartContainer
              config={{
                usd: { label: "USD đã biết", color: "var(--chart-1)" },
              }}
              className="h-56 w-full"
            >
              <BarChart
                accessibilityLayer
                data={data.daily.map((day) => ({
                  date: day.date,
                  usd: Number(day.knownSpendUsd),
                }))}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => String(v).slice(5)}
                />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="usd" fill="var(--color-usd)" radius={4} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Theo model và tính năng</CardTitle>
          <CardDescription>
            Tối đa {data.groupsLimit} nhóm có chi phí đã biết cao nhất.
            Cache/reasoning là chi tiết token, không cộng thêm vào tổng output.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Model / thao tác</th>
                  <th className="p-2">Tính năng</th>
                  <th className="p-2">Lần gọi</th>
                  <th className="p-2">Chưa biết phí</th>
                  <th className="p-2">USD đã biết</th>
                </tr>
              </thead>
              <tbody>
                {data.groups.map((group) => (
                  <tr
                    className="border-b"
                    key={`${group.model}:${group.feature}:${group.operation}`}
                  >
                    <td className="p-2">
                      <p>{group.model}</p>
                      <span className="text-xs text-muted-foreground">
                        {group.operation}
                      </span>
                    </td>
                    <td className="p-2">
                      {featureLabels[group.feature] ?? group.feature}
                    </td>
                    <td className="p-2">{group.calls}</td>
                    <td className="p-2">{group.unknownCalls}</td>
                    <td className="p-2 tabular-nums">
                      {dollars(group.knownSpendUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>20 lượt có chi phí đã biết cao nhất</CardTitle>
          <CardDescription>
            Lượt thiếu chi phí chỉ hiển thị phần đã biết. ID giúp đối soát,
            không lưu nội dung hội thoại.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Lượt / người dùng</th>
                  <th className="p-2">Tính năng</th>
                  <th className="p-2">Lần gọi</th>
                  <th className="p-2">USD đã biết</th>
                </tr>
              </thead>
              <tbody>
                {data.expensiveTurns.map((turn) => (
                  <tr className="border-b" key={turn.turnId}>
                    <td className="p-2">
                      <code title={turn.turnId}>
                        {turn.turnId.slice(0, 12)}…
                      </code>
                      <p className="text-xs text-muted-foreground">
                        {turn.userId ?? "Khách / hệ thống"}
                      </p>
                    </td>
                    <td className="p-2">
                      {featureLabels[turn.feature] ?? turn.feature}
                    </td>
                    <td className="p-2">
                      {turn.calls}{" "}
                      {turn.unknown > 0 && (
                        <Badge variant="secondary">
                          {turn.unknown} chưa biết phí
                        </Badge>
                      )}
                    </td>
                    <td className="p-2 tabular-nums">
                      {dollars(turn.knownSpendUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function Calls({
  query,
  refreshReport,
}: {
  query: string;
  refreshReport: () => Promise<unknown>;
}) {
  const { accessToken } = useAuth();
  const [page, setPage] = useState(1),
    [busy, setBusy] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null);
  const calls = useAuthedSWR(
    `${API_URL}/admin/ai-costs/calls?${query}&page=${page}&limit=25`,
    callsFetcher,
    { keepPreviousData: false, shouldRetryOnError: false },
  );
  async function reconcile(id: string) {
    if (!accessToken || busy) return;
    setBusy(id);
    setError(null);
    try {
      await sendJson(
        costCallSchema,
        `${API_URL}/admin/ai-costs/calls/${id}/reconcile`,
        accessToken,
        { method: "POST" },
      );
      await Promise.all([calls.mutate(), refreshReport()]);
    } catch {
      setError(
        "Chưa đối soát được chi phí. Provider có thể chưa có kết quả; thử lại sau hoặc kiểm tra OpenRouter Activity.",
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Chi tiết lần gọi</CardTitle>
        <CardDescription>
          Đối soát lấy chi phí bằng generation ID đã lưu, không chạy lại AI. Lần
          gọi đang chạy cần chờ kết thúc.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {(error || calls.error) && (
            <Alert variant="destructive">
              <AlertDescription>
                {error ?? errorCopy(calls.error)}
              </AlertDescription>
            </Alert>
          )}
          {!calls.data && !calls.error && <Skeleton className="h-32" />}
          {calls.data && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2">Thời điểm / generation</th>
                      <th className="p-2">Model / thao tác</th>
                      <th className="p-2">Trạng thái</th>
                      <th className="p-2">USD</th>
                      <th className="p-2">Đối soát</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calls.data.items.map((call) => (
                      <tr className="border-b" key={call.id}>
                        <td className="p-2">
                          <p>
                            {new Date(call.startedAt).toLocaleString("vi-VN", {
                              timeZone: "Asia/Bangkok",
                            })}
                          </p>
                          <code className="text-xs">
                            {call.generationId ?? "Thiếu generation ID"}
                          </code>
                        </td>
                        <td className="p-2">
                          <p>{call.resolvedModel ?? call.requestedModel}</p>
                          <span className="text-xs text-muted-foreground">
                            {call.operation} ·{" "}
                            {call.provider ?? "Chưa rõ provider"}
                          </span>
                        </td>
                        <td className="p-2">
                          <Badge variant="secondary">{call.status}</Badge>
                        </td>
                        <td className="p-2 tabular-nums">
                          {call.duplicateCharge
                            ? "Đã loại phí trùng"
                            : dollars(call.costUsd)}
                        </td>
                        <td className="p-2">
                          {call.costUsd === null &&
                            !call.duplicateCharge &&
                            call.generationId && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy !== null}
                                onClick={() => void reconcile(call.id)}
                              >
                                {busy === call.id ? "Đang lấy…" : "Lấy chi phí"}
                              </Button>
                            )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {calls.data.total} lần gọi · trang {page}/
                  {Math.max(1, Math.ceil(calls.data.total / 25))}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Trước
                  </Button>
                  <Button
                    variant="outline"
                    disabled={page * 25 >= calls.data.total}
                    onClick={() => setPage(page + 1)}
                  >
                    Sau
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AiCostsView({
  initialRange,
}: {
  initialRange: DashboardRange;
}) {
  const { accessToken } = useAuth();
  const [filters, setFilters] = useState<Filters>({
    ...initialRange,
    feature: "",
    model: "",
  });
  const [draft, setDraft] = useState(filters),
    [error, setError] = useState<string | null>(null),
    [exporting, setExporting] = useState(false);
  const query = parameters(filters);
  const report = useAuthedSWR(
    `${API_URL}/admin/ai-costs?${query}`,
    reportFetcher,
    { keepPreviousData: false, shouldRetryOnError: false },
  );
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!validDashboardRange(draft)) {
      setError("Chọn khoảng ngày hợp lệ, tối đa 90 ngày theo UTC+7.");
      return;
    }
    setError(null);
    setFilters({ ...draft, model: draft.model.trim() });
  }
  async function download() {
    if (!accessToken || exporting) return;
    setExporting(true);
    setError(null);
    try {
      const response = await send(
        `${API_URL}/admin/ai-costs/export?${query}`,
        accessToken,
        { cache: "no-store" },
      );
      const url = URL.createObjectURL(await response.blob()),
        anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `vedora-ai-costs-${filters.from}-${filters.to}.csv`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 400
          ? "CSV vượt giới hạn hoặc bộ lọc không hợp lệ. Thu hẹp khoảng ngày/model/tính năng."
          : "Không xuất được CSV. Vui lòng thử lại.",
      );
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="space-y-2">
        <h2 className="font-heading text-2xl font-semibold">
          Chi phí AI thực tế
        </h2>
        <p className="text-sm text-muted-foreground">
          Theo dõi chi phí provider đã báo, độ đầy đủ dữ liệu và các lượt cần
          đối soát.
        </p>
      </header>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span>Từ ngày</span>
          <Input
            type="date"
            required
            value={draft.from}
            onChange={(event) =>
              setDraft({ ...draft, from: event.target.value })
            }
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Đến ngày</span>
          <Input
            type="date"
            required
            value={draft.to}
            onChange={(event) => setDraft({ ...draft, to: event.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Tính năng</span>
          <select
            className="h-9 rounded-md border bg-background px-3"
            value={draft.feature}
            onChange={(event) =>
              setDraft({ ...draft, feature: event.target.value })
            }
          >
            <option value="">Tất cả</option>
            {Object.entries(featureLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Model chính xác</span>
          <Input
            maxLength={200}
            placeholder="Tất cả model"
            value={draft.model}
            onChange={(event) =>
              setDraft({ ...draft, model: event.target.value })
            }
          />
        </label>
        <Button type="submit">Áp dụng</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void report.mutate()}
          disabled={report.isValidating}
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
          {exporting ? "Đang xuất…" : "Xuất CSV"}
        </Button>
      </form>
      {(error || report.error) && (
        <Alert variant="destructive">
          <AlertDescription>
            {error ?? errorCopy(report.error)}
          </AlertDescription>
        </Alert>
      )}
      {!report.data && !report.error && (
        <div role="status" aria-label="Đang tải chi phí AI">
          <Skeleton className="h-48" />
        </div>
      )}
      {report.data && <Report data={report.data} />}
      <Calls key={query} query={query} refreshReport={() => report.mutate()} />
    </div>
  );
}
