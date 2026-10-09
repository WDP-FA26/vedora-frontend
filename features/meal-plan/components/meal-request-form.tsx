"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  MessageCircleIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { DIETARY_PATH } from "@/features/dietary/dietary"
import { MEAL_SECTIONS, SECTION_LABELS, type MealSection } from "@/features/meal-plan/meal-plan"

const MAX_CHAT_MESSAGE_LENGTH = 4000
const MAX_EXTRA_ITEMS = 20
const PRIORITIES = ["Đa dạng", "Nấu nhanh", "Tiết kiệm", "Tận dụng nguyên liệu"] as const

type ExtraIngredient = {
  id: number
  name: string
  amount: string
  unit: string
}

type IngredientEditor = Omit<ExtraIngredient, "id">

type MealRequestFormProps = {
  savedAvoided?: string[]
  savedLiked?: string[]
  profileLoading?: boolean
  profileError?: boolean
  onRetryProfile?: () => void
  seed?: { text: string; nonce: number } | null
  handoffState?: "editing" | "prepared" | "sent"
  awaitingReply?: boolean
  chatError?: string | null
  onContinue: (prompt: string) => void
  onEdit?: () => void
  onCancel?: () => void
  busy?: boolean
}

function clean(value: string) {
  return value.trim().replace(/\s+/gu, " ")
}

function ingredientLabel(item: { name: string; amount: string; unit: string }) {
  const amount = clean(item.amount)
  const unit = clean(item.unit)
  return `${clean(item.name)}${amount ? ` (${amount}${unit ? ` ${unit}` : ""})` : ""}`
}

function amountError(item: IngredientEditor) {
  const amount = clean(item.amount)
  if (!amount) return null
  const number = Number(amount.replace(",", "."))
  return Number.isFinite(number) && number > 0 && number <= 1_000_000
    ? null
    : "Lượng nguyên liệu phải lớn hơn 0 và không quá 1.000.000."
}

function seedDetails(text: string) {
  const people = text.match(/(\d{1,2})\s*(?:người|suất ăn)/iu)?.[1]
  const minutes = text.match(/(\d{1,3})\s*phút/iu)?.[1]
  const priority: (typeof PRIORITIES)[number] | null = /tận dụng|nguyên liệu đang có/iu.test(text)
    ? "Tận dụng nguyên liệu"
    : /tiết kiệm|ít tốn/iu.test(text)
      ? "Tiết kiệm"
      : /nấu nhanh|nhanh|\d{1,3}\s*phút/iu.test(text)
        ? "Nấu nhanh"
        : /đa dạng/iu.test(text)
          ? "Đa dạng"
          : null
  return { people, minutes, priority }
}

/** Builds a chat draft only; sending and saving remain separate user actions. */
export function MealRequestForm({
  savedAvoided = [],
  savedLiked = [],
  profileLoading = false,
  profileError = false,
  onRetryProfile,
  seed,
  handoffState = "editing",
  awaitingReply = false,
  chatError = null,
  onContinue,
  onEdit,
  onCancel,
  busy = false,
}: MealRequestFormProps) {
  const [meals, setMeals] = useState<MealSection[]>(["BREAKFAST", "LUNCH", "DINNER"])
  const [people, setPeople] = useState("")
  const [minutes, setMinutes] = useState("")
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("Đa dạng")
  const [note, setNote] = useState("")
  const [extraIngredients, setExtraIngredients] = useState<ExtraIngredient[]>([])
  const [ingredientEditor, setIngredientEditor] = useState<IngredientEditor>({ name: "", amount: "", unit: "" })
  const [confirmedSignature, setConfirmedSignature] = useState<string | null>(null)
  const [error, setError] = useState("")
  const nextIngredientId = useRef(1)
  const lastSeedNonce = useRef<number | null>(null)

  const profileReady = !profileLoading && !profileError
  const avoidedNames = [...new Set(savedAvoided.map(clean).filter(Boolean))]
  const likedNames = [...new Set(savedLiked.map(clean).filter(Boolean))]
  const profileSignature = JSON.stringify([avoidedNames, likedNames])
  const profileConfirmed = profileReady && confirmedSignature === profileSignature

  useEffect(() => {
    if (!seed || lastSeedNonce.current === seed.nonce) return
    const timer = window.setTimeout(() => {
      lastSeedNonce.current = seed.nonce
      const details = seedDetails(seed.text)
      if (details.people) setPeople(details.people)
      if (details.minutes) setMinutes(details.minutes)
      if (details.priority) setPriority(details.priority)
      setNote(seed.text)
      setError("")
    }, 0)
    return () => window.clearTimeout(timer)
  }, [seed])

  function addExtraIngredient() {
    const name = clean(ingredientEditor.name)
    if (!name) {
      setError("Nhập tên nguyên liệu cần thêm.")
      return
    }
    if (extraIngredients.length >= MAX_EXTRA_ITEMS) {
      setError(`Chỉ thêm tối đa ${MAX_EXTRA_ITEMS} nguyên liệu cho một yêu cầu.`)
      return
    }
    const invalidAmount = amountError(ingredientEditor)
    if (invalidAmount) {
      setError(invalidAmount)
      return
    }
    setExtraIngredients((current) => [...current, {
      ...ingredientEditor,
      id: nextIngredientId.current++,
      name,
      amount: clean(ingredientEditor.amount),
      unit: clean(ingredientEditor.unit),
    }])
    setIngredientEditor({ name: "", amount: "", unit: "" })
    setError("")
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (profileLoading) {
      setError("Đợi tải xong hồ sơ ăn uống trước khi đưa yêu cầu vào chat.")
      return
    }
    if (profileError) {
      setError("Chưa tải được hồ sơ ăn uống. Hãy thử lại trước khi lập thực đơn.")
      return
    }
    if (!profileConfirmed) {
      setError("Hãy kiểm tra và xác nhận thông tin hồ sơ ăn uống.")
      return
    }
    if (meals.length === 0) {
      setError("Chọn ít nhất một bữa cần lập thực đơn.")
      return
    }
    if (people && (!Number.isInteger(Number(people)) || Number(people) < 1 || Number(people) > 20)) {
      setError("Số người ăn cần từ 1 đến 20.")
      return
    }
    if (minutes && (!Number.isInteger(Number(minutes)) || Number(minutes) < 1 || Number(minutes) > 240)) {
      setError("Thời gian nấu tối đa cần từ 1 đến 240 phút.")
      return
    }
    if (note.length > 2500) {
      setError("Yêu cầu bổ sung tối đa 2.500 ký tự.")
      return
    }
    const pending = clean(ingredientEditor.name)
    if (!pending && (ingredientEditor.amount.trim() || ingredientEditor.unit.trim())) {
      setError("Nhập tên cho nguyên liệu đang thêm.")
      return
    }
    if (pending && extraIngredients.length >= MAX_EXTRA_ITEMS) {
      setError(`Chỉ thêm tối đa ${MAX_EXTRA_ITEMS} nguyên liệu cho một yêu cầu.`)
      return
    }
    if (pending) {
      const invalidAmount = amountError(ingredientEditor)
      if (invalidAmount) {
        setError(invalidAmount)
        return
      }
    }

    const ingredients = [
      ...extraIngredients.map(ingredientLabel),
      ...(pending ? [ingredientLabel(ingredientEditor)] : []),
    ]
    const prompt = [
      "Hãy đề xuất bản nháp thực đơn 7 ngày lặp theo thứ trong tuần, từ Thứ Hai đến Chủ nhật.",
      `Các bữa cần lập mỗi ngày: ${MEAL_SECTIONS.filter((meal) => meals.includes(meal)).map((meal) => SECTION_LABELS[meal].toLowerCase()).join(", ")}.`,
      avoidedNames.length ? `Thực phẩm tôi không ăn: ${avoidedNames.join(", ")}.` : "",
      likedNames.length ? `Nguyên liệu tôi thích: ${likedNames.join(", ")}.` : "",
      people ? `Số người ăn: ${people}.` : "",
      minutes ? `Thời gian nấu tối đa cho mỗi bữa: ${minutes} phút.` : "",
      `Ưu tiên: ${priority.toLowerCase()}.`,
      ingredients.length ? `Nguyên liệu đang có, hãy ưu tiên tận dụng khi phù hợp: ${ingredients.join(", ")}.` : "",
      clean(note) ? `Yêu cầu bổ sung: ${note.trim()}` : "",
      "Hãy cho tôi xem đề xuất trước, tôi sẽ tự quyết định khi nào lưu thực đơn.",
    ].filter(Boolean).join("\n")

    if (prompt.length > MAX_CHAT_MESSAGE_LENGTH) {
      setError(`Yêu cầu dài quá ${MAX_CHAT_MESSAGE_LENGTH} ký tự. Hãy rút ngắn ghi chú hoặc bớt nguyên liệu.`)
      return
    }
    setError("")
    onContinue(prompt)
  }

  return (
    <div className="min-w-0 bg-card">
    <form hidden={handoffState !== "editing"} noValidate onSubmit={submit} className="min-w-0 bg-card pb-[calc(4rem+env(safe-area-inset-bottom))] sm:pb-4">
      <header className="flex min-h-24 items-center justify-between gap-2 overflow-hidden border-b border-border bg-gradient-to-r from-card via-card to-brand-cream/25 px-4 py-3 sm:min-h-28 sm:px-5">
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-bold leading-tight">Lên thực đơn</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Điền thông tin rồi đưa yêu cầu sang chat</p>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          <Image src="/tomato-sticker.png" alt="" aria-hidden width={96} height={80} className="h-16 w-16 shrink-0 object-contain drop-shadow-[0_6px_7px_rgba(37,85,50,0.15)] sm:h-24 sm:w-24" />
          {onCancel && <Button type="button" variant="ghost" size="icon-sm" onClick={onCancel} aria-label="Đóng biểu mẫu"><XIcon aria-hidden /></Button>}
        </div>
      </header>

      <div className="space-y-6 px-4 py-5 sm:px-5">
        <section aria-labelledby="request-schedule-title" className="space-y-4">
          <div>
            <h3 id="request-schedule-title" className="text-sm font-bold">1. Thực đơn cần lập</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">7 ngày lặp theo thứ trong tuần.</p>
          </div>
          <fieldset>
            <legend className="mb-2 text-xs font-semibold">Các bữa mỗi ngày</legend>
            <div className="grid grid-cols-2 gap-2">
              {MEAL_SECTIONS.map((meal) => (
                <label key={meal} className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={meals.includes(meal)}
                    onChange={(event) => {
                      setMeals((current) => event.target.checked ? [...current, meal] : current.filter((item) => item !== meal))
                      setError("")
                    }}
                    className="size-4 accent-primary"
                  />
                  {SECTION_LABELS[meal]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold">
              Số người ăn
              <input type="number" min="1" max="20" step="1" value={people} onChange={(event) => { setPeople(event.target.value); setError("") }} placeholder="Ví dụ: 2" className="mt-1.5 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/30" />
            </label>
            <label className="text-xs font-semibold">
              Tối đa mỗi bữa
              <span className="sr-only">(phút)</span>
              <input type="number" min="1" max="240" step="1" value={minutes} onChange={(event) => { setMinutes(event.target.value); setError("") }} placeholder="Phút, ví dụ: 30" className="mt-1.5 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/30" />
            </label>
          </div>
          <label className="block text-xs font-semibold">
            Ưu tiên
            <select value={priority} onChange={(event) => setPriority(event.target.value as (typeof PRIORITIES)[number])} className="mt-1.5 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
              {PRIORITIES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </section>

        <section aria-labelledby="request-pantry-title" className="space-y-3 border-t border-border pt-5">
          <div>
            <h3 id="request-pantry-title" className="text-sm font-bold">2. Nguyên liệu đang có</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Thêm nguyên liệu bạn muốn tận dụng cho yêu cầu này.</p>
          </div>
          {extraIngredients.length > 0 && (
            <ul aria-label="Nguyên liệu thêm cho yêu cầu này" className="space-y-2">
              {extraIngredients.map((item) => (
                <li key={item.id} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                  <span className="min-w-0 break-words">{ingredientLabel(item)}</span>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Xóa ${item.name} khỏi yêu cầu`} onClick={() => setExtraIngredients((current) => current.filter((entry) => entry.id !== item.id))}><Trash2Icon aria-hidden className="size-4" /></Button>
                </li>
              ))}
            </ul>
          )}
          <div className="rounded-2xl border border-border bg-secondary/30 p-3">
            <p className="mb-2 text-xs font-semibold">Thêm nguyên liệu cho lần này</p>
            <label className="block text-xs font-medium">
              Tên nguyên liệu
              <input value={ingredientEditor.name} maxLength={80} onChange={(event) => { setIngredientEditor((current) => ({ ...current, name: event.target.value })); setError("") }} placeholder="Ví dụ: cà chua" className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/30" />
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs font-medium">Số lượng (nếu có)<input type="text" inputMode="decimal" value={ingredientEditor.amount} maxLength={16} onChange={(event) => { setIngredientEditor((current) => ({ ...current, amount: event.target.value })); setError("") }} placeholder="Ví dụ: 500" className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/30" /></label>
              <label className="text-xs font-medium">Đơn vị (nếu có)<input value={ingredientEditor.unit} maxLength={20} onChange={(event) => { setIngredientEditor((current) => ({ ...current, unit: event.target.value })); setError("") }} placeholder="Ví dụ: g" className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/30" /></label>
            </div>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={addExtraIngredient}><PlusIcon aria-hidden /> Thêm nguyên liệu</Button>
          </div>
        </section>

        <section aria-labelledby="request-profile-title" className="space-y-3 border-t border-border pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="request-profile-title" className="text-sm font-bold">3. Kiểm tra hồ sơ ăn uống</h3>
            <Link href={DIETARY_PATH} className="text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline">Chỉnh hồ sơ</Link>
          </div>
          <div className="space-y-1 rounded-2xl bg-secondary/50 p-3 text-xs leading-5">
            {profileLoading || profileError ? null : (
              <>
                <p><strong>Không ăn:</strong> {avoidedNames.length > 0 ? avoidedNames.join(", ") : "Chưa khai báo"}</p>
                <p><strong>Thích:</strong> {likedNames.length > 0 ? likedNames.join(", ") : "Chưa chọn"}</p>
              </>
            )}
          </div>
          {profileLoading && <p role="status" className="rounded-xl bg-secondary/50 px-3 py-2 text-xs leading-5 text-muted-foreground">Đang tải hồ sơ ăn uống…</p>}
          {profileError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive"><span>Chưa tải được hồ sơ ăn uống.</span>{onRetryProfile && <Button type="button" variant="outline" size="sm" onClick={onRetryProfile}>Thử lại</Button>}</div>}
          <label className="flex cursor-pointer items-start gap-2 text-xs leading-5">
            <input type="checkbox" checked={profileConfirmed} disabled={!profileReady} onChange={(event) => { setConfirmedSignature(event.target.checked ? profileSignature : null); setError("") }} className="mt-0.5 size-4 shrink-0 accent-primary" />
            <span>Tôi đã kiểm tra hồ sơ ăn uống ở trên.</span>
          </label>
        </section>

        <section aria-labelledby="request-note-title" className="space-y-2 border-t border-border pt-5">
          <h3 id="request-note-title" className="text-sm font-bold">4. Yêu cầu thêm</h3>
          <label className="block text-xs font-medium">
            Điều bạn muốn trợ lý lưu ý (nếu có)
            <textarea value={note} maxLength={2500} onChange={(event) => { setNote(event.target.value); setError("") }} rows={3} placeholder="Ví dụ: bữa tối nhẹ, ít dầu, không lặp món trong tuần…" className="mt-1.5 min-h-24 w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/30" />
          </label>
        </section>

        {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive">{error}</p>}
        <div className="space-y-2 border-t border-border pt-5">
          <Button type="submit" size="lg" className="w-full" disabled={busy || !profileReady}>Đưa yêu cầu vào chat <ArrowRightIcon aria-hidden /></Button>
          <p className="text-center text-xs leading-5 text-muted-foreground">Bạn sẽ xem lại và nhấn Gửi trong chat. Thực đơn chỉ được lưu khi bạn xác nhận.</p>
        </div>
      </div>
    </form>
    {handoffState !== "editing" && (
      <div role="status" className="flex min-h-[22rem] flex-col bg-card">
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary"><CalendarDaysIcon aria-hidden className="size-5" /></span>
            <div className="min-w-0"><h2 className="font-heading text-lg font-bold leading-tight">Lên thực đơn</h2><p className="mt-0.5 text-xs text-muted-foreground">Yêu cầu của bạn</p></div>
          </div>
          {onCancel && <Button type="button" variant="ghost" size="icon-sm" onClick={onCancel} aria-label="Đóng yêu cầu"><XIcon aria-hidden /></Button>}
        </header>
        <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary"><MessageCircleIcon aria-hidden className="size-6" /></span>
          <h3 className="mt-4 font-heading text-base font-bold">
            {handoffState === "prepared"
              ? "Yêu cầu đã sẵn sàng trong chat"
              : chatError
                ? "Chưa nhận được đề xuất thực đơn"
                : awaitingReply
                  ? busy ? "Trợ lý đang lên thực đơn" : "Đang chờ phản hồi từ trợ lý"
                  : "Chưa có đề xuất thực đơn mới"}
          </h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            {handoffState === "prepared"
              ? "Kiểm tra nội dung trong ô chat rồi bấm Gửi để nhận đề xuất."
              : chatError
                ? "Xem lỗi trong chat. Thông tin bạn đã nhập vẫn còn để chỉnh sửa và thử lại."
                : awaitingReply
                  ? "Yêu cầu đã gửi. Khi có đề xuất, bảng thực đơn sẽ hiện tại đây."
                  : "Xem phản hồi trong chat. Bạn có thể sửa thông tin và gửi lại nếu cần."}
          </p>
          {onEdit && <Button type="button" variant="outline" size="sm" className="mt-5" onClick={onEdit}>Sửa thông tin</Button>}
        </div>
      </div>
    )}
    </div>
  )
}
