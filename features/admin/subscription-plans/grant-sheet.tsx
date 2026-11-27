"use client"

import { useRef, useState, type FormEvent } from "react"
import { useSWRConfig } from "swr"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { useAuthedSWR } from "@/features/auth/hooks/use-authed-swr"
import { API_URL } from "@/features/auth/lib/api"
import { dateTime, planName } from "@/features/billing/schema"
import { ApiError } from "@/features/shared/lib/api-client"
import { ADMIN_PLANS_KEY } from "./api"
import { createGrant, fetchGrantUser, fetchGrantUsers, grantUserKey, grantUsersKey } from "./grant-api"
import { grantInputSchema, type GrantUserDetail, type SubscriptionGrant } from "./grant-schema"
import type { AdminPlans } from "./schema"

const statusName = { ACTIVE: "Đang hoạt động", SUSPENDED: "Đang bị đình chỉ", PENDING_EMAIL: "Chưa xác minh email" }

export function GrantSheet({ catalog, onClose }: { catalog: AdminPlans; onClose: () => void }) {
  const [baseline] = useState(catalog)
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return <Sheet open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
    <SheetContent className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
      <SheetHeader>
        <SheetTitle>Cấp gói cho người dùng</SheetTitle>
        <SheetDescription>Cấp Plus hoặc Pro ngay, bắt đầu một chu kỳ mới và lưu lịch sử quản trị.</SheetDescription>
      </SheetHeader>
      <div className="space-y-5 px-4 pb-6">
        {selected
          ? <GrantTarget key={selected} userId={selected} catalog={baseline} onBack={() => setSelected(null)} onClose={onClose} setBusy={setBusy} />
          : <UserSearch onSelect={setSelected} />}
      </div>
    </SheetContent>
  </Sheet>
}

function UserSearch({ onSelect }: { onSelect: (id: string) => void }) {
  const [draft, setDraft] = useState("")
  const [query, setQuery] = useState({ q: "", page: 1 })
  const { data, error, isLoading, mutate } = useAuthedSWR(grantUsersKey(query.q, query.page), fetchGrantUsers, { shouldRetryOnError: false })
  function search(event: FormEvent) { event.preventDefault(); setQuery({ q: draft.trim(), page: 1 }) }
  return <>
    <form onSubmit={search} className="flex items-end gap-2">
      <label className="min-w-0 flex-1 space-y-2 text-sm font-medium">Tìm người dùng<Input maxLength={100} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Tên, username, email hoặc ID" /></label>
      <Button type="submit" variant="outline">Tìm</Button>
    </form>
    <p className="text-xs text-muted-foreground">Tài khoản cá nhân, bao gồm quản trị viên. Tài khoản đã xóa và trang nhà hàng không nhận gói cá nhân.</p>
    {isLoading && <p role="status">Đang tìm người dùng…</p>}
    {error && <Alert variant="destructive"><AlertDescription>Không tải được người dùng. <Button variant="outline" onClick={() => void mutate().catch(() => undefined)}>Thử lại</Button></AlertDescription></Alert>}
    {data && !error && <>
      <ul className="divide-y rounded-xl border">
        {data.items.map(user => <li key={user.id}><button type="button" className="flex w-full flex-col gap-1 rounded-xl p-3 text-left hover:bg-muted focus-visible:outline-ring" onClick={() => onSelect(user.id)}>
          <span className="font-medium">{user.fullName} <span className="text-sm text-muted-foreground">@{user.username}</span></span>
          <span className="break-all text-sm text-muted-foreground">{user.email}</span>
          <span className="text-xs text-muted-foreground">{statusName[user.status]}{user.role === "ADMIN" ? " · Quản trị viên" : ""}</span>
        </button></li>)}
      </ul>
      {data.items.length === 0 && <p className="text-sm text-muted-foreground">Không tìm thấy người dùng phù hợp.</p>}
      <div className="flex items-center justify-between gap-2 text-sm">
        <Button variant="outline" size="sm" disabled={query.page <= 1} onClick={() => setQuery(q => ({ ...q, page: q.page - 1 }))}>Trước</Button>
        <span>Trang {data.page} · {data.total} người dùng</span>
        <Button variant="outline" size="sm" disabled={data.page * data.limit >= data.total} onClick={() => setQuery(q => ({ ...q, page: q.page + 1 }))}>Sau</Button>
      </div>
    </>}
  </>
}

function GrantTarget({ userId, catalog, onBack, onClose, setBusy }: { userId: string; catalog: AdminPlans; onBack: () => void; onClose: () => void; setBusy: (value: boolean) => void }) {
  const { data, error, isLoading, mutate } = useAuthedSWR(grantUserKey(userId), fetchGrantUser, { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false })
  if (isLoading) return <p role="status">Đang tải gói hiện tại…</p>
  if (!data || error) return <><Alert variant="destructive"><AlertDescription>Không tải được tài khoản hoặc tài khoản không còn nhận gói.</AlertDescription></Alert><Button variant="outline" onClick={() => void mutate().catch(() => undefined)}>Thử lại</Button><Button variant="ghost" onClick={onBack}>Chọn người khác</Button></>
  return <GrantForm detail={data} catalog={catalog} onBack={onBack} onClose={onClose} setBusy={setBusy} />
}

function GrantForm({ detail, catalog, onBack, onClose, setBusy }: { detail: GrantUserDetail; catalog: AdminPlans; onBack: () => void; onClose: () => void; setBusy: (value: boolean) => void }) {
  const [baseline] = useState(detail)
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()
  const [code, setCode] = useState<"PLUS" | "PRO">("PLUS")
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)
  const [locked, setLocked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [result, setResult] = useState<SubscriptionGrant | null>(null)
  const request = useRef<{ key: string; input: ReturnType<typeof grantInputSchema.parse> } | null>(null)
  const plan = catalog.plans.find(plan => plan.code === code)!

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!accessToken || saving || conflict || result) return
    const checked = grantInputSchema.safeParse({ userId: baseline.user.id, planCode: code, catalogVersion: catalog.version, expectedPeriodKey: baseline.membership.key, reason })
    if (!checked.success) { setError(checked.error.issues[0]?.message ?? "Kiểm tra lại thông tin."); return }
    request.current ??= { key: crypto.randomUUID(), input: checked.data }
    setLocked(true); setSaving(true); setBusy(true); setError(null)
    try {
      const granted = await createGrant(accessToken, request.current.input, request.current.key)
      setResult(granted)
      void Promise.all([
        mutate([grantUserKey(baseline.user.id), accessToken]),
        mutate([`${API_URL}/billing/me`, accessToken]),
        mutate((key: unknown) => Array.isArray(key) && typeof key[0] === "string" && key[0].startsWith(`${API_URL}/admin/payments/`)),
      ]).catch(() => undefined)
    } catch (failure) {
      const stale = failure instanceof ApiError && failure.status === 409
      setConflict(stale)
      setError(stale ? "Gói hoặc tài khoản đã thay đổi. Hãy đóng và tải dữ liệu mới để kiểm tra trước khi cấp lại." : "Chưa xác nhận được kết quả cấp gói. Thử lại sẽ giữ nguyên yêu cầu để tránh cấp trùng.")
    } finally { setSaving(false); setBusy(false) }
  }

  async function reload() {
    setSaving(true); setBusy(true)
    try { await Promise.all([mutate([ADMIN_PLANS_KEY, accessToken]), mutate([grantUserKey(baseline.user.id), accessToken])]); onClose() }
    catch { setError("Chưa tải được dữ liệu mới. Vui lòng thử lại.") }
    finally { setSaving(false); setBusy(false) }
  }

  return <>
    <div className="space-y-1 rounded-xl border p-3">
      <p className="font-medium">{baseline.user.fullName} <span className="text-muted-foreground">@{baseline.user.username}</span></p>
      <p className="break-all text-sm text-muted-foreground">{baseline.user.email}</p>
      <Badge variant="outline">{statusName[baseline.user.status]}</Badge>
      <p className="pt-2 text-sm">Gói hiện tại: <strong>{planName(baseline.membership.planCode)}</strong></p>
      {baseline.membership.planCode !== "FREE" && <p className="text-xs text-muted-foreground">Hết hạn {dateTime(baseline.membership.expiresAt)} (UTC+7) · {baseline.membership.source === "ADMIN_GRANT" ? "Admin cấp" : "Đã thanh toán"}</p>}
    </div>
    {result ? <div className="space-y-4">
      <Alert><AlertDescription>Đã cấp {planName(result.planCode)} cho @{baseline.user.username}. Có hiệu lực đến {dateTime(result.expiresAt)} (UTC+7).</AlertDescription></Alert>
      <p className="break-all text-xs text-muted-foreground">Mã lần cấp: {result.id}</p>
      <Button onClick={onClose}>Hoàn tất</Button>
    </div> : <form className="space-y-5" onSubmit={(event) => void submit(event)}>
      <label className="flex flex-col gap-2 text-sm font-medium">Gói được cấp<NativeSelect aria-label="Gói được cấp" value={code} disabled={locked || saving} onChange={e => setCode(e.target.value as "PLUS" | "PRO")}><NativeSelectOption value="PLUS">Plus</NativeSelectOption><NativeSelectOption value="PRO">Pro</NativeSelectOption></NativeSelect></label>
      <div className="space-y-1 rounded-xl bg-muted/50 p-3 text-sm">
        <p>{plan.durationDays} ngày từ lúc cấp · {plan.textLimit} lượt AI chữ · {plan.imageLimit} lượt tạo ảnh.</p>
        <p>{code === "PRO" ? "Có thoại AI hai chiều, dùng chung lượt AI chữ, không tính hạn mức phút." : "Không có thoại AI hai chiều."}</p>
        <p className="text-xs text-muted-foreground">Cấu hình phiên bản {catalog.version}. Không thu tiền và không tính doanh thu.</p>
      </div>
      <Alert><AlertDescription>Gói mới thay gói đang dùng ngay khi cấp, bắt đầu lại chu kỳ và hạn mức. Không cộng dồn thời gian còn lại.</AlertDescription></Alert>
      {baseline.user.status !== "ACTIVE" && <Alert><AlertDescription>Chu kỳ vẫn bắt đầu ngay. Người dùng cần xác minh email và tài khoản hoạt động để sử dụng.</AlertDescription></Alert>}
      {baseline.pendingPayment && <Alert><AlertDescription>Người dùng còn QR chờ thanh toán. QR giữ giá và quyền lợi cũ; nếu thanh toán thành công sau lần cấp này, gói của đơn đó sẽ thay gói vừa cấp.</AlertDescription></Alert>}
      <label className="flex flex-col gap-2 text-sm font-medium">Lý do cấp gói<Textarea value={reason} maxLength={500} minLength={3} required disabled={locked || saving} onChange={e => setReason(e.target.value)} placeholder="Ví dụ: hỗ trợ người dùng, chương trình trải nghiệm…" /></label>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {conflict ? <Button type="button" variant="outline" disabled={saving} onClick={() => void reload()}>Đóng và tải dữ liệu mới</Button> : <Button type="submit" aria-label="Xác nhận cấp gói" disabled={saving || reason.trim().length < 3}>{saving && <Spinner aria-hidden />}Xác nhận cấp gói</Button>}
      {!locked && <Button type="button" variant="ghost" onClick={onBack}>Chọn người khác</Button>}
    </form>}
    {baseline.recentGrants.length > 0 && <div className="space-y-2 border-t pt-4">
      <h3 className="text-sm font-medium">Các lần cấp gần đây</h3>
      <ul className="space-y-3">{baseline.recentGrants.map(grant => <li key={grant.id} className="space-y-1 text-xs text-muted-foreground"><p>{planName(grant.planCode)} · {dateTime(grant.startsAt)} → {dateTime(grant.expiresAt)} (UTC+7)</p><p className="break-words">{grant.reason}</p><p className="break-all">Admin: {grant.actorId}</p></li>)}</ul>
    </div>}
  </>
}
