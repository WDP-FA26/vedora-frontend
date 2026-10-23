"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSWRConfig } from "swr"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { API_URL } from "@/features/auth/lib/api"
import { ApiError, sendJson } from "@/features/shared/lib/api-client"
import { usePayment } from "./hooks"
import { dateTime, money, paymentSchema, planName } from "./schema"

export function PaymentView({ id }: { id: string }) {
  const { accessToken } = useAuth()
  return <PaymentContent key={`${id}:${accessToken}`} id={id} token={accessToken} />
}

function PaymentContent({ id, token }: { id: string; token?: string }) {
  const payment = usePayment(id), router = useRouter()
  const { mutate } = useSWRConfig()
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  const status = payment.data?.status
  useEffect(() => {
    if (status === "SUCCEEDED" && token) void mutate([`${API_URL}/billing/me`, token]).catch(() => undefined)
  }, [status, token, mutate])
  async function cancel() {
    if (!token || busy || !window.confirm("Chỉ hủy nếu bạn chưa chuyển tiền. Hủy trên Vedora không thu hồi hoặc hoàn lại tiền đã chuyển. Bạn muốn hủy giao dịch này?")) return
    const controller = new AbortController(); request.current = controller; setBusy(true); setError(null)
    try {
      await sendJson(paymentSchema, `${API_URL}/payment-intents/${id}/cancel`, token, { method: "POST", signal: controller.signal })
      if (!controller.signal.aborted) await payment.mutate()
    } catch (cause) {
      if (controller.signal.aborted) return
      if (cause instanceof ApiError && cause.status === 401) router.refresh()
      setError("Chưa hủy được giao dịch. Hãy kiểm tra lại trạng thái trước khi thử lại.")
      void payment.mutate().catch(() => undefined)
    } finally { if (!controller.signal.aborted) setBusy(false) }
  }
  if (payment.error) return <Alert variant="destructive"><AlertDescription><p>{payment.error instanceof ApiError && payment.error.status === 404 ? "Không tìm thấy giao dịch thuộc tài khoản của bạn." : "Không tải được trạng thái thanh toán."}</p><Button variant="outline" onClick={() => { void payment.mutate().catch(() => undefined) }}>Kiểm tra lại</Button><Link href="/billing" className="underline">Về gói của bạn</Link></AlertDescription></Alert>
  if (!payment.data) return <div role="status" aria-label="Đang tải giao dịch"><Skeleton className="h-96" /></div>
  const data = payment.data
  return <div className="space-y-5">
    <div><h1 className="font-heading text-2xl font-semibold">Thanh toán {planName(data.planCode)}</h1><p className="mt-2 break-all text-xs text-muted-foreground">{data.invoiceNumber}</p></div>
    {data.status === "SUCCEEDED" ? <Card><CardHeader><CardTitle>Đã xác nhận thanh toán</CardTitle><CardDescription>{money(data.amount)} · {planName(data.planCode)} · {data.durationDays} ngày</CardDescription></CardHeader><CardContent><div className="space-y-4"><p className="text-sm">{data.capturedAt && `Gói được kích hoạt từ ${dateTime(data.capturedAt)} (UTC+7). `}Pro và Premium hiện chưa có đặc quyền bổ sung.</p><Button render={<Link href="/billing" />}>Xem gói hiện tại</Button></div></CardContent></Card>
    : data.status === "CANCELLED" ? <Alert><AlertDescription><p>Giao dịch đã hủy. Không chuyển tiền theo QR cũ. Nếu đã chuyển, hãy cung cấp mã giao dịch cho quản trị viên để đối soát; hệ thống không tự hoàn tiền.</p><Link href="/billing" className="underline">Về gói của bạn</Link></AlertDescription></Alert>
    : <>
      <Alert><AlertDescription>Gói mới có hiệu lực ngay sau khi webhook được xác nhận, thay thế thời hạn cũ và không cộng dồn. Chỉ chuyển đúng số tiền và nội dung bên dưới.</AlertDescription></Alert>
      <Card><CardHeader><CardTitle>Chờ chuyển khoản</CardTitle><CardDescription>{money(data.amount)} · {data.durationDays} ngày</CardDescription></CardHeader><CardContent>
        {data.qr ? <div className="grid items-start gap-6 sm:grid-cols-[256px_1fr]">
          <div className="space-y-3"><Image unoptimized src={data.qr.imageUrl} alt={`QR chuyển khoản ${money(data.amount)} cho gói ${planName(data.planCode)}`} width={256} height={300} className="h-auto w-full rounded-xl border bg-white" /><a className="block text-center text-sm underline" href={data.qr.downloadUrl} target="_blank" rel="noreferrer">Mở / tải ảnh QR</a></div>
          <dl className="space-y-4 text-sm">{[["Ngân hàng", data.qr.bankGateway], ["Số tài khoản", data.qr.accountNumber], ["Chủ tài khoản", data.qr.accountHolder], ["Số tiền", money(data.amount)], ["Nội dung chuyển khoản", data.qr.transferContent]].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-all font-medium select-all">{value}</dd></div>)}</dl>
        </div> : <p className="text-sm">Thanh toán đang tạm đóng. Không chuyển tiền theo QR đã lưu; hãy quay lại kiểm tra sau.</p>}
      </CardContent></Card>
      <p role="status" className="text-sm text-muted-foreground">Tự kiểm tra mỗi 4 giây khi đang chờ. Nút bên dưới chỉ đọc trạng thái, không tự xác nhận tiền.</p>
      <div className="flex flex-wrap gap-3"><Button disabled={payment.isValidating} onClick={() => { void payment.mutate().catch(() => undefined) }}>{payment.isValidating ? "Đang kiểm tra…" : "Tôi đã thanh toán · Kiểm tra"}</Button><Button variant="outline" disabled={busy || payment.isValidating} onClick={() => { void cancel() }}>{busy ? "Đang hủy…" : "Hủy giao dịch chưa chuyển tiền"}</Button></div>
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <p className="text-xs text-muted-foreground">Nếu đã chuyển nhưng chưa được xác nhận, không chuyển thêm lần nữa. Giữ mã thanh toán {data.paymentCode} và mã giao dịch ngân hàng để đối soát.</p>
  </div>
}
