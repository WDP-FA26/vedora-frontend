"use client"

import { useState, type FormEvent } from "react"
import { useSWRConfig } from "swr"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { toast } from "@/components/ui/toast"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { API_URL } from "@/features/auth/lib/api"
import { ApiError } from "@/features/shared/lib/api-client"
import { ADMIN_PLANS_KEY, saveAdminPlans } from "./api"
import { freeDraftSchema, paidDraftSchema, updatePayload, type AdminPlans, type ManagedPlan, type PlanDraft } from "./schema"

export function PlanEditor({ plan, catalog, onClose }: { plan: ManagedPlan; catalog: AdminPlans; onClose: () => void }) {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()
  // Preserve the revision that the admin started editing, including after focus refreshes.
  const [baseline] = useState(catalog)
  const [draft, setDraft] = useState<PlanDraft>({ priceVnd: plan.priceVnd, textLimit: String(plan.textLimit), imageLimit: String(plan.imageLimit) })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const free = plan.code === "FREE"
  const dirty = draft.priceVnd !== plan.priceVnd || draft.textLimit !== String(plan.textLimit) || draft.imageLimit !== String(plan.imageLimit)

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!accessToken || saving || !dirty) return
    const checked = (free ? freeDraftSchema : paidDraftSchema).safeParse(draft)
    if (!checked.success) {
      setError(checked.error.issues[0]?.message ?? "Kiểm tra lại các giá trị.")
      return
    }
    setError(null)
    setSaving(true)
    try {
      await mutate([ADMIN_PLANS_KEY, accessToken], () => saveAdminPlans(accessToken, updatePayload(baseline, plan.code, draft)), { populateCache: true, revalidate: false })
      void Promise.all([
        mutate([`${API_URL}/billing/plans`, accessToken]),
        mutate([`${API_URL}/billing/me`, accessToken]),
      ]).catch(() => undefined)
      toast.add({ title: `Đã cập nhật gói ${plan.name}` })
      onClose()
    } catch (failure) {
      const stale = failure instanceof ApiError && failure.status === 409
      setConflict(stale)
      setError(stale
        ? "Cấu hình đã được quản trị viên khác thay đổi. Bản nháp của bạn vẫn được giữ; hãy tải lại cấu hình trước khi chỉnh sửa tiếp."
        : "Không lưu được cấu hình. Bản nháp vẫn được giữ, bạn có thể thử lại.")
    } finally {
      setSaving(false)
    }
  }

  async function reload() {
    if (saving) return
    setSaving(true)
    try {
      await mutate([ADMIN_PLANS_KEY, accessToken])
      onClose()
    } catch {
      setError("Chưa tải được cấu hình mới. Bản nháp của bạn vẫn được giữ.")
    } finally {
      setSaving(false)
    }
  }

  function field(label: string, key: keyof PlanDraft, hint: string) {
    return <label className="flex flex-col gap-2 text-sm font-medium">
      {label}
      <Input aria-label={label} inputMode="numeric" value={draft[key]} disabled={saving} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} />
      <span className="text-xs font-normal text-muted-foreground">{hint}</span>
    </label>
  }

  return <Sheet open onOpenChange={(open) => { if (!open && !saving) onClose() }}>
    <SheetContent className="overflow-y-auto sm:max-w-lg">
      <SheetHeader>
        <SheetTitle>Chỉnh sửa gói {plan.name}</SheetTitle>
        <SheetDescription>{free ? "Hạn mức mỗi ngày, đặt lại lúc 00:00 giờ Việt Nam." : `Hạn mức cho một chu kỳ ${plan.durationDays} ngày.`}</SheetDescription>
      </SheetHeader>
      <form onSubmit={(event) => void save(event)} className="flex flex-col gap-5 px-4 pb-6">
        <Alert><AlertDescription>{free
          ? "Thay đổi có hiệu lực ngay cho gói Free. Số lượt đã dùng trong ngày vẫn được giữ."
          : "Giá và hạn mức mới chỉ áp dụng cho đơn tạo sau khi lưu. QR đang chờ và gói đã mua giữ nguyên giá, hạn mức và thời hạn đã chốt."}</AlertDescription></Alert>
        {!free && field("Giá (VND)", "priceVnd", "Nhập số nguyên từ 1 đến 1.000.000.000 đồng.")}
        {field("Hạn mức AI chữ", "textLimit", "Tổng lượt dùng chung cho các tính năng AI chữ và yêu cầu voice; từ 0 đến 1.000.000.")}
        {field("Hạn mức tạo ảnh", "imageLimit", `Số lượt tạo ảnh AI ${free ? "mỗi ngày" : "trong chu kỳ"}; từ 0 đến 1.000.000. Nhập 0 để không cấp lượt.`)}
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {conflict && <Button type="button" variant="outline" onClick={() => void reload()} disabled={saving}>Bỏ bản nháp và tải cấu hình mới</Button>}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" aria-label="Lưu thay đổi" disabled={!dirty || saving || conflict}>{saving && <Spinner aria-hidden />}Lưu thay đổi</Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Hủy</Button>
          {dirty && <span className="text-xs text-muted-foreground">Chưa lưu</span>}
        </div>
      </form>
    </SheetContent>
  </Sheet>
}
