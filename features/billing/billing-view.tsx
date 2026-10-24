"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { API_URL } from "@/features/auth/lib/api"
import { ApiError, sendJson } from "@/features/shared/lib/api-client"
import { useBilling, useCatalog } from "./hooks"
import { dateTime, money, paymentSchema, paymentStatus, planName, type PlanCode } from "./schema"

export function BillingView({ userId }: { userId: string }) {
  const { accessToken } = useAuth()
  return <BillingContent key={`${userId}:${accessToken}`} userId={userId} token={accessToken} />
}

function BillingContent({ userId, token }: { userId: string; token?: string }) {
  const router = useRouter()
  const catalog = useCatalog(), billing = useBilling()
  const [busy, setBusy] = useState<PlanCode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  const keys = useRef<Partial<Record<PlanCode, string>>>({})
  useEffect(() => () => request.current?.abort(), [])

  async function buy(planCode: PlanCode) {
    if (!token || busy) return
    const controller = new AbortController(); request.current = controller
    setBusy(planCode); setError(null)
    const storageKey = `vedora:purchase:${userId}:${planCode}`
    let key = keys.current[planCode]
    try { key ??= sessionStorage.getItem(storageKey) ?? undefined } catch { /* Active intent also protects against duplicate retries. */ }
    key ??= crypto.randomUUID(); keys.current[planCode] = key
    try { sessionStorage.setItem(storageKey, key) } catch { /* Storage may be unavailable. */ }
    try {
      const payment = await sendJson(paymentSchema, `${API_URL}/billing/payment-intents`, token, { method: "POST", headers: { "Idempotency-Key": key }, body: JSON.stringify({ planCode }), signal: controller.signal })
      if (controller.signal.aborted) return
      try { sessionStorage.removeItem(storageKey) } catch { /* Optional retry persistence only. */ }
      delete keys.current[planCode]
      router.push(`/payment/${payment.id}`)
    } catch (cause) {
      if (controller.signal.aborted) return
      if (cause instanceof ApiError && cause.status === 401) router.refresh()
      if (cause instanceof ApiError && cause.status === 409) void billing.mutate().catch(() => undefined)
      setError(cause instanceof ApiError && cause.code === "PENDING_PAYMENT_CONFLICT" ? "Bạn có giao dịch đang chờ. Hãy tiếp tục hoặc hủy giao dịch đó trước khi mua gói khác." : "Chưa tạo được thanh toán. Bạn có thể thử lại; yêu cầu này sẽ giữ mã chống trùng.")
    } finally { if (!controller.signal.aborted) setBusy(null) }
  }

  if (catalog.error || billing.error) return <Alert variant="destructive"><AlertDescription><p>Không tải được thông tin gói.</p><Button variant="outline" onClick={() => { void Promise.all([catalog.mutate(), billing.mutate()]).catch(() => undefined) }}>Thử lại</Button></AlertDescription></Alert>
  if (!catalog.data || !billing.data) return <div role="status" aria-label="Đang tải gói thanh toán" className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-64" /></div>
  const { membership, pendingPayment, recentPayments } = billing.data
  const { paymentsEnabled, plans } = catalog.data
  return (
    <div className="space-y-6">
      <div><h1 className="font-heading text-2xl font-semibold">Gói của bạn</h1><p className="mt-2 text-sm text-muted-foreground">Xem gói đang dùng và thanh toán chuyển khoản qua SePay.</p></div>
      <Card>
        <CardHeader><CardDescription>Gói hiện tại</CardDescription><CardTitle>{planName(membership.planCode)}</CardTitle></CardHeader>
        <CardContent><div className="space-y-2 text-sm">
          {membership.expiresAt ? <p>Có hiệu lực đến {dateTime(membership.expiresAt)} (UTC+7).</p> : <p>Bạn chưa có gói trả phí còn hạn.</p>}
          <p className="text-muted-foreground">Pro và Premium hiện chỉ ghi nhận gói đã mua, chưa có đặc quyền bổ sung. Hết hạn sẽ trở về gói Miễn phí; không tự gia hạn hoặc tự trừ tiền.</p>
        </div></CardContent>
      </Card>
      <Alert><AlertDescription>Mỗi lần mua mới bắt đầu ngay khi hệ thống xác nhận thanh toán và thay thế thời hạn gói cũ. Thời gian còn lại không được cộng dồn hoặc quy đổi tiền. Mỗi ngày có thời lượng 24 giờ.</AlertDescription></Alert>
      {!paymentsEnabled && <Alert><AlertDescription>Thanh toán đang tạm đóng. Bạn vẫn xem được gói và lịch sử giao dịch.</AlertDescription></Alert>}
      {pendingPayment && <Card><CardHeader><CardTitle>Giao dịch đang chờ</CardTitle><CardDescription>{planName(pendingPayment.planCode)} · {money(pendingPayment.amount)}</CardDescription></CardHeader><CardContent><Button render={<Link href={`/payment/${pendingPayment.id}`} />}>Tiếp tục thanh toán</Button></CardContent></Card>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">{plans.map(plan => <Card key={plan.code}>
        <CardHeader><CardTitle>{plan.name}</CardTitle><CardDescription>{plan.durationDays} ngày · chưa có đặc quyền</CardDescription></CardHeader>
        <CardContent><div className="space-y-5"><p className="text-3xl font-semibold tabular-nums">{money(plan.priceVnd)}</p><Button disabled={!token || !paymentsEnabled || busy !== null || pendingPayment !== null} onClick={() => { void buy(plan.code) }}>{busy === plan.code ? "Đang tạo giao dịch…" : `Mua ${plan.name}`}</Button></div></CardContent>
      </Card>)}</div>
      <Card><CardHeader><CardTitle>Giao dịch gần đây</CardTitle><CardDescription>Tối đa 20 lần thanh toán mới nhất.</CardDescription></CardHeader><CardContent>
        {recentPayments.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có giao dịch.</p> : <ul className="divide-y">{recentPayments.map(payment => <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><Link className="font-medium underline-offset-4 hover:underline" href={`/payment/${payment.id}`}>{planName(payment.planCode)} · {money(payment.amount)}</Link><p className="mt-1 text-xs text-muted-foreground">{dateTime(payment.createdAt)}</p></div><Badge variant="secondary">{paymentStatus[payment.status]}</Badge></li>)}</ul>}
      </CardContent></Card>
    </div>
  )
}
