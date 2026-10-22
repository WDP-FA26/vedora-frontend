"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { ArrowUpRightIcon, ChartColumnIcon, CircleAlertIcon, RefreshCwIcon, type LucideIcon, UsersIcon, UserXIcon, FileTextIcon, ShieldAlertIcon } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiError } from "@/features/shared/lib/api-client"
import { displayDashboardDate, validDashboardRange, type Dashboard, type DashboardRange } from "./dashboard-schema"
import { useDashboard } from "./use-dashboard"

const number = new Intl.NumberFormat("vi-VN")
const chartConfig = {
  newMembers: { label: "Thành viên mới", color: "var(--chart-1)" },
  publishedPosts: { label: "Bài đăng", color: "var(--chart-2)" },
  publishedBlogs: { label: "Blog", color: "var(--chart-3)" },
} satisfies ChartConfig

const unavailableCopy = {
  MODERATION_CASE_SEVERITY: ["Báo cáo theo mức độ", "Chưa có dữ liệu phân loại mức độ của case kiểm duyệt."],
  CONTENT_APPROVALS: ["Gửi duyệt và phê duyệt nội dung", "Chưa có thống kê từ luồng phê duyệt nội dung."],
  PAYMENT_DEMO: ["Thanh toán mô phỏng", "Chưa có dữ liệu về lượt thanh toán thành công và tổng tiền mô phỏng."],
} as const

function Metric({ title, value, note, icon: Icon, href }: { title: string; value: number; note: string; icon: LucideIcon; href: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription><span className="flex items-center gap-2"><Icon aria-hidden className="size-4" />{title}</span></CardDescription>
        <p className="font-heading text-3xl font-medium tabular-nums">{number.format(value)}</p>
      </CardHeader>
      <CardContent><div className="flex items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground">{note}</p>
        <Link href={href} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label={`Xem ${title.toLowerCase()}`}><ArrowUpRightIcon className="size-4" /></Link>
      </div></CardContent>
    </Card>
  )
}

function DashboardContent({ data }: { data: Dashboard }) {
  const { snapshot, period, range } = data
  const hasActivity = data.daily.some((day) => day.newMembers + day.publishedPosts + day.publishedBlogs > 0)
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p>{displayDashboardDate(range.from)} – {displayDashboardDate(range.to)} · {range.dayCount} ngày · Giờ Bangkok (UTC+7)</p>
        <p>Cập nhật {new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(data.generatedAt))}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Thành viên hoạt động" value={snapshot.members.active} note="Hiện tại · không gồm quản trị viên" icon={UsersIcon} href="/admin/users" />
        <Metric title="Thành viên bị khóa" value={snapshot.members.suspended} note="Hiện tại · không phụ thuộc khoảng ngày" icon={UserXIcon} href="/admin/users" />
        <Metric title="Nội dung xuất bản" value={period.publishedContent.total} note="Trong kỳ · hiện vẫn đang công khai" icon={FileTextIcon} href="/admin/content" />
        <Metric title="Báo cáo chờ xử lý" value={snapshot.pendingReports} note="Hiện tại · gồm báo cáo ngoài khoảng ngày" icon={ShieldAlertIcon} href="/admin/reports" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hoạt động theo ngày</CardTitle>
          <CardDescription>Thành viên mới và nội dung xuất bản trong kỳ. Bài đăng bao gồm bài có video; không tính bản nháp.</CardDescription>
        </CardHeader>
        <CardContent>
          {hasActivity ? (
            <ChartContainer config={chartConfig} className="h-72 w-full" aria-label="Biểu đồ thành viên mới, bài đăng và blog theo ngày">
              <BarChart accessibilityLayer data={data.daily} margin={{ left: -16, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={28} tickFormatter={(date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(date) => displayDashboardDate(String(date))} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="newMembers" fill="var(--color-newMembers)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="publishedPosts" fill="var(--color-publishedPosts)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="publishedBlogs" fill="var(--color-publishedBlogs)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 text-center">
              <ChartColumnIcon aria-hidden className="size-8 text-muted-foreground" />
              <p className="font-medium">Chưa có hoạt động trong khoảng này</p>
              <p className="text-sm text-muted-foreground">Thử chọn một khoảng ngày khác.</p>
            </div>
          )}
          <details className="mt-4 rounded-xl border p-3 text-sm">
            <summary className="cursor-pointer font-medium">Xem bảng số liệu theo ngày</summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Hoạt động từng ngày theo giờ Bangkok</caption>
                <thead><tr className="border-b"><th scope="col" className="py-2">Ngày</th><th scope="col" className="px-2">Thành viên mới</th><th scope="col" className="px-2">Bài đăng</th><th scope="col" className="px-2">Blog</th><th scope="col" className="px-2">Báo cáo mới</th><th scope="col" className="px-2">Quyết định xử lý</th></tr></thead>
                <tbody>{data.daily.map((day) => <tr key={day.date} className="border-b last:border-0"><th scope="row" className="py-2 font-normal">{displayDashboardDate(day.date)}</th><td className="px-2 tabular-nums">{number.format(day.newMembers)}</td><td className="px-2 tabular-nums">{number.format(day.publishedPosts)}</td><td className="px-2 tabular-nums">{number.format(day.publishedBlogs)}</td><td className="px-2 tabular-nums">{number.format(day.reportsCreated)}</td><td className="px-2 tabular-nums">{number.format(day.resolvedReports + day.dismissedReports)}</td></tr>)}</tbody>
              </table>
            </div>
          </details>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Tổng hợp trong kỳ</CardTitle><CardDescription>Số liệu từ những bản ghi hiện còn trong hệ thống.</CardDescription></CardHeader>
          <CardContent><dl className="divide-y text-sm">{[
            ["Thành viên mới", period.newMembers], ["Bài đăng xuất bản", period.publishedContent.posts], ["Blog xuất bản", period.publishedContent.blogs],
            ["Công thức được tạo", period.recipesCreated], ["Báo cáo mới", period.reportsCreated], ["Báo cáo đã xử lý", period.reportDecisions.resolved], ["Báo cáo bị bác bỏ", period.reportDecisions.dismissed],
          ].map(([label, value]) => <div className="flex items-center justify-between gap-4 py-2.5" key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-medium tabular-nums">{number.format(Number(value))}</dd></div>)}</dl></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Chưa có dữ liệu</CardTitle><CardDescription>Các chỉ số dưới đây chưa có số liệu để tổng hợp.</CardDescription></CardHeader>
          <CardContent><div className="space-y-5">{data.unavailableMetrics.map((key) => {
            const [title, description] = unavailableCopy[key]
            return <div key={key} className="space-y-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{title}</p><Badge variant="secondary">Chưa có dữ liệu</Badge></div><p className="text-sm text-muted-foreground">{description}</p></div>
          })}</div></CardContent>
        </Card>
      </div>
    </>
  )
}

export function DashboardView({ initialRange }: { initialRange: DashboardRange }) {
  const [range, setRange] = useState(initialRange)
  const [draft, setDraft] = useState(initialRange)
  const [rangeError, setRangeError] = useState<string | null>(null)
  const { data, error, isLoading, isValidating, mutate } = useDashboard(range)

  function applyRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validDashboardRange(draft)) {
      setRangeError("Chọn ngày hợp lệ, ngày kết thúc không trước ngày bắt đầu và tối đa 90 ngày tính cả hai đầu.")
      return
    }
    setRangeError(null)
    setRange({ ...draft })
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="font-heading text-2xl font-semibold tracking-tight">Tổng quan Vedora</h2><p className="mt-1 text-sm text-muted-foreground">Theo dõi thành viên, nội dung và báo cáo của cộng đồng.</p></div>
        <Button variant="outline" disabled={isValidating} onClick={() => { void mutate().catch(() => undefined) }}><RefreshCwIcon aria-hidden className={isValidating ? "animate-spin" : ""} />{isValidating ? "Đang làm mới…" : "Làm mới"}</Button>
      </div>

      <form onSubmit={applyRange} className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4" aria-label="Lọc thống kê theo ngày">
        <div className="space-y-1.5"><label htmlFor="dashboard-from" className="text-sm font-medium">Từ ngày</label><Input id="dashboard-from" type="date" required value={draft.from} onChange={(event) => { setDraft({ ...draft, from: event.target.value }); setRangeError(null) }} aria-describedby="dashboard-range-note" /></div>
        <div className="space-y-1.5"><label htmlFor="dashboard-to" className="text-sm font-medium">Đến ngày</label><Input id="dashboard-to" type="date" required value={draft.to} onChange={(event) => { setDraft({ ...draft, to: event.target.value }); setRangeError(null) }} aria-describedby="dashboard-range-note" /></div>
        <Button type="submit" disabled={isValidating}>Áp dụng</Button>
        <p id="dashboard-range-note" className="w-full text-xs text-muted-foreground">Tối đa 90 ngày · Asia/Bangkok (UTC+7). Các số ghi “Hiện tại” không thay đổi theo bộ lọc ngày.</p>
        {rangeError && <p role="alert" className="w-full text-sm text-destructive">{rangeError}</p>}
      </form>

      {error ? (
        <Alert variant="destructive"><CircleAlertIcon aria-hidden /><AlertDescription>{error instanceof ApiError && error.status === 403 ? "Chỉ quản trị viên mới được xem thống kê." : "Không tải được thống kê. Vui lòng thử làm mới."}</AlertDescription></Alert>
      ) : isLoading || !data ? (
        <div role="status" aria-label="Đang tải thống kê" className="space-y-4"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-36" />)}</div><Skeleton className="h-80" /></div>
      ) : <DashboardContent data={data} />}
    </div>
  )
}
