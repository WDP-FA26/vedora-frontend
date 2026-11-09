"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckIcon, SparklesIcon } from "lucide-react"
import type { z } from "zod"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { API_URL } from "@/features/auth/lib/api"
import { ApiError, sendJson } from "@/features/shared/lib/api-client"
import { useBilling, useCatalog } from "./hooks"
import {
  allowanceSchema,
  dateTime,
  money,
  paymentSchema,
  paymentStatus,
  planName,
  type PlanCode,
} from "./schema"

function Allowance({ title, value }: { title: string; value: z.infer<typeof allowanceSchema> }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>{title}</span>
        <span className="font-medium tabular-nums">
          {value.remaining}/{value.limit} lượt còn lại
        </span>
      </div>
      <progress
        aria-label={title}
        value={Math.min(value.used, value.limit)}
        max={Math.max(1, value.limit)}
        className="h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary"
      />
      <p className="text-xs text-muted-foreground">
        {value.limit === 0 ? "Gói hiện tại chưa có lượt tạo ảnh. " : ""}Đặt lại{" "}
        {dateTime(value.resetsAt)} (UTC+7).
      </p>
    </div>
  )
}

export function BillingView({ userId }: { userId: string }) {
  const { accessToken } = useAuth()
  return <BillingContent key={`${userId}:${accessToken}`} userId={userId} token={accessToken} />
}

function BillingContent({ userId, token }: { userId: string; token?: string }) {
  const router = useRouter(),
    catalog = useCatalog(),
    billing = useBilling()
  const [busy, setBusy] = useState<PlanCode | null>(null)
  const [selected, setSelected] = useState<PlanCode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  const keys = useRef<Partial<Record<PlanCode, string>>>({})
  useEffect(() => () => request.current?.abort(), [])
  const refreshBilling = billing.mutate
  const expiresAt = billing.data?.membership.expiresAt
  useEffect(() => {
    if (!expiresAt) return
    const delay = new Date(expiresAt).getTime() - Date.now() + 250
    if (delay <= 0) {
      void refreshBilling().catch(() => undefined)
      return
    }
    if (delay > 2_147_483_647) return
    const timer = setTimeout(() => void refreshBilling().catch(() => undefined), delay)
    return () => clearTimeout(timer)
  }, [expiresAt, refreshBilling])

  async function buy(planCode: PlanCode) {
    if (!token || busy) return
    const controller = new AbortController()
    request.current = controller
    setBusy(planCode)
    setError(null)
    const storageKey = `vedora:purchase:v2:${userId}:${planCode}`
    let key = keys.current[planCode]
    try {
      key ??= sessionStorage.getItem(storageKey) ?? undefined
    } catch {
      /* Retry persistence is optional. */
    }
    key ??= crypto.randomUUID()
    keys.current[planCode] = key
    try {
      sessionStorage.setItem(storageKey, key)
    } catch {
      /* The server also protects pending intents. */
    }
    try {
      const payment = await sendJson(paymentSchema, `${API_URL}/billing/payment-intents`, token, {
        method: "POST",
        headers: { "Idempotency-Key": key },
        body: JSON.stringify({ planCode, planVersion: 2 }),
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      try {
        sessionStorage.removeItem(storageKey)
      } catch {
        /* No persistence available. */
      }
      delete keys.current[planCode]
      setSelected(null)
      router.push(`/payment/${payment.id}`)
    } catch (cause) {
      if (controller.signal.aborted) return
      if (cause instanceof ApiError && cause.status === 401) router.refresh()
      if (cause instanceof ApiError && cause.status === 409)
        void billing.mutate().catch(() => undefined)
      setError(
        cause instanceof ApiError && cause.code === "PENDING_PAYMENT_CONFLICT"
          ? "Bạn có giao dịch đang chờ. Tiếp tục hoặc hủy giao dịch đó trước khi mua gói khác."
          : "Chưa tạo được thanh toán. Thử lại sẽ giữ mã chống trùng của yêu cầu này."
      )
    } finally {
      if (!controller.signal.aborted) setBusy(null)
    }
  }

  if (catalog.error || billing.error)
    return (
      <Alert variant="destructive">
        <AlertDescription>
          <p>Không tải được thông tin gói.</p>
          <Button
            variant="outline"
            onClick={() =>
              void Promise.all([catalog.mutate(), billing.mutate()]).catch(() => undefined)
            }
          >
            Thử lại
          </Button>
        </AlertDescription>
      </Alert>
    )
  if (!catalog.data || !billing.data)
    return (
      <div role="status" aria-label="Đang tải gói của bạn" className="space-y-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-80" />
      </div>
    )
  const { membership, usage, pendingPayment, recentPayments } = billing.data
  const { paymentsEnabled, plans, freeLimits } = catalog.data
  const selectedPlan = plans.find((plan) => plan.code === selected)
  const free = membership.planCode === "FREE"
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="space-y-2">
        <Badge variant="secondary">Vedora Plus & Pro</Badge>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Thêm cảm hứng cho mỗi bữa ăn
        </h1>
        <p className="text-muted-foreground">
          Chọn lượng hỗ trợ AI phù hợp với bạn. Cộng đồng, kho công thức và thực đơn thủ công luôn
          sẵn có ở mọi gói.
        </p>
      </header>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Gói của bạn · {planName(membership.planCode)}</CardTitle>
            <Badge variant={free ? "secondary" : "default"}>
              {free ? "Miễn phí" : "Đang có hiệu lực"}
            </Badge>
          </div>
          <CardDescription>
            {membership.expiresAt
              ? `Có hiệu lực đến ${dateTime(membership.expiresAt)} (UTC+7).`
              : "Hạn mức văn bản đặt lại hằng ngày lúc 00:00 (UTC+7)."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <Allowance title="AI văn bản dùng chung" value={usage.text} />
            <Allowance title="Tạo và chỉnh ảnh AI" value={usage.images} />
          </div>
        </CardContent>
      </Card>
      {pendingPayment && (
        <Alert>
          <AlertDescription>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                Đang chờ thanh toán {pendingPayment.purchasedPlanName} ·{" "}
                {money(pendingPayment.amount)}.
              </span>
              <Button size="sm" render={<Link href={`/payment/${pendingPayment.id}`} />}>
                Tiếp tục thanh toán
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      {!paymentsEnabled && (
        <Alert>
          <AlertDescription>
            Thanh toán đang tạm đóng. Bạn vẫn sử dụng gói và hạn mức hiện có.
          </AlertDescription>
        </Alert>
      )}
      {error && !selected && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Miễn phí</CardTitle>
            <CardDescription>Khám phá và xây thói quen ăn uống.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="flex h-full flex-col gap-6">
              <p className="text-3xl font-semibold">0đ</p>
              <ul className="space-y-3 text-sm">
                <li>{freeLimits.textLimit} lượt AI văn bản/ngày</li>
                <li>Kho công thức, đánh giá và yêu thích</li>
                <li>Thực đơn thủ công và danh sách đi chợ</li>
                <li>Đăng bài, blog và nhắn tin</li>
              </ul>
              <p className="mt-auto text-sm text-muted-foreground">
                {free ? "Bạn đang dùng gói này." : "Tự chuyển về Miễn phí khi gói trả phí hết hạn."}
              </p>
            </div>
          </CardContent>
        </Card>
        {plans.map((plan) => (
          <Card key={plan.code}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>{plan.name}</CardTitle>
                {plan.code === "PLUS" && (
                  <SparklesIcon aria-hidden className="size-5 text-primary" />
                )}
              </div>
              <CardDescription>
                {plan.code === "PLUS"
                  ? "Trợ lý đồng hành trong bếp mỗi ngày."
                  : "Nhiều không gian hơn cho ý tưởng và nội dung."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="flex h-full flex-col gap-6">
                <p>
                  <span className="text-3xl font-semibold tabular-nums">
                    {money(plan.priceVnd)}
                  </span>
                  <span className="ml-1 text-sm text-muted-foreground">
                    / {plan.durationDays} ngày
                  </span>
                </p>
                <ul className="space-y-3 text-sm">
                  {[
                    `${plan.textLimit} lượt AI văn bản/chu kỳ`,
                    `${plan.imageLimit} lượt tạo hoặc chỉnh ảnh/chu kỳ`,
                    "AI dinh dưỡng, thực đơn và viết blog",
                    "Đầy đủ tính năng của gói Miễn phí",
                  ].map((text) => (
                    <li key={text} className="flex items-start gap-2">
                      <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                      {text}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-auto w-full"
                  variant={plan.code === "PLUS" ? "default" : "outline"}
                  disabled={!token || !paymentsEnabled || busy !== null || pendingPayment !== null}
                  onClick={() => {
                    setError(null)
                    setSelected(plan.code)
                  }}
                >
                  {membership.planCode === plan.code
                    ? `Bắt đầu ${plan.durationDays} ngày ${plan.name} mới`
                    : `Chọn ${plan.name}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          Lượt văn bản dùng chung cho trợ lý dinh dưỡng, thực đơn và viết blog. Một yêu cầu có thể
          gồm nhiều bước xử lý; lượt ảnh được tính riêng. Lỗi hệ thống được hoàn lượt.
        </p>
        <p>
          Thanh toán một lần bằng QR SePay, không tự gia hạn hoặc tự trừ tiền. Mỗi lần thanh toán
          thành công bắt đầu chu kỳ mới và đặt lại hạn mức; thời gian và lượt còn lại không cộng
          dồn.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Lịch sử thanh toán</CardTitle>
          <CardDescription>20 giao dịch gần nhất của bạn.</CardDescription>
        </CardHeader>
        <CardContent>
          {recentPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có giao dịch.</p>
          ) : (
            <ul className="divide-y">
              {recentPayments.map((payment) => (
                <li
                  key={payment.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <Link
                      className="font-medium underline-offset-4 hover:underline"
                      href={`/payment/${payment.id}`}
                    >
                      {payment.purchasedPlanName} · {money(payment.amount)}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {dateTime(payment.createdAt)}
                    </p>
                  </div>
                  <Badge variant="secondary">{paymentStatus[payment.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setSelected(null)
        }}
      >
        <DialogContent showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>Xác nhận chọn {selectedPlan?.name}</DialogTitle>
            <DialogDescription>
              Kiểm tra quyền lợi và thời điểm bắt đầu trước khi tạo mã QR.
            </DialogDescription>
          </DialogHeader>
          {selectedPlan && (
            <div className="space-y-3 text-sm">
              <p>
                Thanh toán đủ <strong>{money(selectedPlan.priceVnd)}</strong> cho{" "}
                <strong>
                  {selectedPlan.durationDays} ngày {selectedPlan.name}
                </strong>
                .
              </p>
              <p>
                Gói mới có hiệu lực ngay khi hệ thống xác nhận nhận đủ tiền. Hạn mức được đặt lại
                thành {selectedPlan.textLimit} lượt văn bản và {selectedPlan.imageLimit} lượt ảnh.
              </p>
              {!free && (
                <Alert>
                  <AlertDescription>
                    Chu kỳ hiện tại kết thúc khi gói mới được kích hoạt. Thời gian và lượt còn lại
                    không được giữ, cộng dồn hoặc quy đổi tiền.
                  </AlertDescription>
                </Alert>
              )}
              <p className="text-muted-foreground">Tạo mã QR chưa làm thay đổi gói đang dùng.</p>
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={busy !== null} onClick={() => setSelected(null)}>
              Quay lại
            </Button>
            <Button
              disabled={busy !== null || !selectedPlan}
              onClick={() => selectedPlan && void buy(selectedPlan.code)}
            >
              {busy ? "Đang tạo thanh toán…" : "Tạo mã QR"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
