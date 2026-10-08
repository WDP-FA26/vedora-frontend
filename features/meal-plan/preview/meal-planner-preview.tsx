"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowRightIcon,
  ArrowUpIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock3Icon,
  ImageIcon,
  LockKeyholeIcon,
  LockKeyholeOpenIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SparklesIcon,
  UtensilsCrossedIcon,
  UsersRoundIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  alternatePreviewMeal,
  createPreviewDays,
  formatPreviewDate,
  PREVIEW_MEAL_KEYS,
  PREVIEW_MEAL_LABELS,
  previewStartDate,
  type PreviewDay,
  type PreviewMeal,
  type PreviewMealKey,
} from "./preview-data"

type PreviewTab = "chat" | "plan"
type AllergyState = "unknown" | "none" | "some"
type Scenario =
  | "empty"
  | "confirmation"
  | "draft"
  | "locked"
  | "replacement"
  | "dirty"
  | "create-error"
  | "save-error"
  | "quota"
  | "insufficient"
  | "missing-profile"
  | "profile-loading"
  | "answer-loading"
  | "create-loading"
  | "replace-loading"
  | "save-loading"

type PreviewRequest = {
  start: string
  meals: PreviewMealKey[]
  people: number
  maxMinutes: number
  ingredients: string
  priority: string
  note: string
}

type Target = { dayIndex: number; meal: PreviewMealKey }
type Proposal = Target & { oldMeal: PreviewMeal; newMeal: PreviewMeal }

const SCENARIOS: { value: Scenario; label: string }[] = [
  { value: "empty", label: "Chưa có thực đơn" },
  { value: "confirmation", label: "Biểu mẫu yêu cầu" },
  { value: "draft", label: "Bản nháp 7 ngày" },
  { value: "locked", label: "Có bữa đã khóa" },
  { value: "replacement", label: "Đề xuất đổi món" },
  { value: "dirty", label: "Thay đổi chưa lưu" },
  { value: "create-error", label: "Lỗi tạo bản nháp" },
  { value: "save-error", label: "Lỗi lưu" },
  { value: "quota", label: "Hết lượt trợ lý" },
  { value: "insufficient", label: "Không đủ món phù hợp" },
  { value: "missing-profile", label: "Chưa khai báo hồ sơ" },
  { value: "profile-loading", label: "Đang tải hồ sơ" },
  { value: "answer-loading", label: "Đang trả lời" },
  { value: "create-loading", label: "Đang tạo bản nháp" },
  { value: "replace-loading", label: "Đang tìm món" },
  { value: "save-loading", label: "Đang lưu" },
]

const QUICK_ACTIONS = [
  "Lên thực đơn 7 ngày",
  "Mỗi bữa nấu trong 30 phút",
  "Tận dụng nguyên liệu đang có",
  "Hỏi về nguyên liệu và dinh dưỡng",
] as const

const PREVIEW_PANTRY = [
  { id: "tomato", name: "Cà chua", amount: "500 g" },
  { id: "mushroom", name: "Nấm", amount: "300 g" },
] as const

const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]
const FIELD_CLASS =
  "h-9 min-w-0 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25"

function cloneDays(days: PreviewDay[]) {
  return days.map((day) => ({
    ...day,
    meals: {
      breakfast: { ...day.meals.breakfast },
      lunch: { ...day.meals.lunch },
      dinner: { ...day.meals.dinner },
    },
  }))
}

function dateLabel(iso: string) {
  const date = new Date(`${iso}T12:00:00`)
  return `${WEEKDAY_SHORT[date.getDay()]}, ${formatPreviewDate(iso)}`
}

/** Entirely local UI sandbox. Never imports the auth context or meal-plan API service. */
export function MealPlannerPreview() {
  const [scenario, setScenario] = useState<Scenario>("empty")
  const [tab, setTab] = useState<PreviewTab>("chat")
  const [request, setRequest] = useState<PreviewRequest>(() => ({
    start: previewStartDate(),
    meals: [...PREVIEW_MEAL_KEYS],
    people: 2,
    maxMinutes: 30,
    ingredients: "",
    priority: "Đa dạng",
    note: "",
  }))
  const [allergy, setAllergy] = useState<AllergyState>("none")
  const [profileOpen, setProfileOpen] = useState(true)
  const [useProfileForChat, setUseProfileForChat] = useState(true)
  const [confirmationOpen, setConfirmationOpen] = useState(true)
  const [profileConfirmed, setProfileConfirmed] = useState(false)
  const [selectedPantry, setSelectedPantry] = useState<string[]>(PREVIEW_PANTRY.map((item) => item.id))
  const [handoffState, setHandoffState] = useState<"editing" | "prepared" | "sent">("editing")
  const [isFormMessage, setIsFormMessage] = useState(false)
  const [draft, setDraft] = useState<PreviewDay[] | null>(null)
  const [saved, setSaved] = useState<PreviewDay[] | null>(null)
  const [selectedDay, setSelectedDay] = useState(0)
  const [replaceTarget, setReplaceTarget] = useState<Target | null>(null)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [context, setContext] = useState<Target | null>(null)
  const [recipe, setRecipe] = useState<PreviewMeal | null>(null)
  const [messages, setMessages] = useState<string[]>([])
  const [input, setInput] = useState("")
  const [notice, setNotice] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const hasUnsaved = Boolean(draft && (!saved || JSON.stringify(draft) !== JSON.stringify(saved)))
  const isBusy = ["answer-loading", "create-loading", "replace-loading", "save-loading"].includes(
    scenario
  )

  useEffect(() => {
    if (!hasUnsaved) return
    function warnBeforeLeave(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warnBeforeLeave)
    return () => window.removeEventListener("beforeunload", warnBeforeLeave)
  }, [hasUnsaved])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "nearest" })
  }, [messages.length, notice])

  function loadScenario(next: Scenario) {
    const sample = createPreviewDays(request.start)
    setScenario(next)
    setTab("plan")
    setSelectedDay(0)
    setReplaceTarget(null)
    setProposal(null)
    setContext(null)
    setRecipe(null)
    setMessages([])
    setInput("")
    setNotice("")
    setIsFormMessage(false)
    setProfileConfirmed(false)
    setAllergy(next === "missing-profile" ? "unknown" : "none")
    setConfirmationOpen(["empty", "confirmation", "missing-profile", "profile-loading"].includes(next))
    setHandoffState(next === "create-error" || next === "create-loading" ? "sent" : "editing")
    if (["empty", "confirmation", "create-error", "missing-profile", "profile-loading", "create-loading"].includes(next)) {
      setDraft(null)
      setSaved(null)
    } else if (next === "draft") {
      setDraft(sample)
      setSaved(null)
    } else if (next === "locked") {
      sample[0].meals.lunch.locked = true
      setDraft(sample)
      setSaved(null)
    } else if (next === "replacement") {
      setDraft(sample)
      setSaved(cloneDays(sample))
      setProposal({
        dayIndex: 0,
        meal: "lunch",
        oldMeal: sample[0].meals.lunch,
        newMeal: alternatePreviewMeal(sample[0].meals.lunch, "lunch"),
      })
    } else {
      const original = cloneDays(sample)
      if (next === "dirty" || next === "save-error" || next === "save-loading") {
        sample[0].meals.dinner = alternatePreviewMeal(sample[0].meals.dinner, "dinner")
      }
      setDraft(sample)
      setSaved(original)
    }
  }

  function quickAction(index: number) {
    if (index === 3) {
      setInput("Mình muốn hỏi về nguyên liệu và dinh dưỡng.")
      setTab("chat")
      requestAnimationFrame(() => inputRef.current?.focus())
      return
    }
    if (index === 1) setRequest((current) => ({ ...current, maxMinutes: 30, priority: "Nấu nhanh" }))
    if (index === 2) setRequest((current) => ({ ...current, priority: "Tận dụng nguyên liệu" }))
    setRequest((current) => ({ ...current, note: QUICK_ACTIONS[index] }))
    setConfirmationOpen(true)
    setHandoffState("editing")
    setTab("plan")
    setNotice("")
  }

  function sendMessage(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    const text = input.trim()
    if (!text || isBusy) return
    if (scenario === "quota") {
      setNotice("Bạn đã hết lượt dùng trợ lý trong bản xem thử. Nội dung vẫn ở ô nhập.")
      return
    }
    setMessages((current) => [...current, text])
    setInput("")
    if (isFormMessage) {
      setIsFormMessage(false)
      setHandoffState("sent")
      if (scenario === "create-error") {
        setNotice("Bản xem thử mô phỏng lỗi tạo đề xuất. Yêu cầu vẫn còn trong biểu mẫu để bạn sửa và thử lại.")
        return
      }
      setDraft(createPreviewDays(request.start, 7))
      setSaved(null)
      setSelectedDay(0)
      setConfirmationOpen(false)
      setScenario("draft")
      setNotice("Đây là đề xuất thực đơn mẫu để xem giao diện. Không có yêu cầu nào được gửi tới trợ lý.")
      setTab("plan")
      return
    }
    if (draft && (replaceTarget || /(?:đổi|thay)\s+(?:món|bữa)|món\s+khác/iu.test(text))) {
      const meal: PreviewMealKey = /bữa\s*sáng|món\s*sáng/iu.test(text) ? "breakfast" : /bữa\s*tối|món\s*tối/iu.test(text) ? "dinner" : "lunch"
      findReplacement(replaceTarget ?? context ?? { dayIndex: selectedDay, meal })
      setContext(null)
      setTab("plan")
      return
    }
    if (/^(?:lên|lập|tạo|gợi ý)\s+thực đơn/iu.test(text)) {
      setRequest((current) => ({ ...current, note: text }))
      setConfirmationOpen(true)
      setHandoffState("editing")
      setTab("plan")
      setNotice("Điền thông tin ở cột phải rồi đưa yêu cầu vào chat.")
      return
    }
    setNotice("Đây là bản xem thử giao diện. Câu hỏi chưa được gửi cho trợ lý.")
  }

  function prepareRequest() {
    if (scenario === "profile-loading") {
      setNotice("Đợi tải xong hồ sơ mẫu trước khi lập thực đơn.")
      return
    }
    if (allergy === "unknown") {
      setNotice("Hãy xác nhận dị ứng trong hồ sơ ăn uống trước khi lập thực đơn.")
      return
    }
    if (!profileConfirmed) {
      setNotice("Hãy kiểm tra và xác nhận hồ sơ ăn uống mẫu.")
      return
    }
    if (request.meals.length === 0) {
      setNotice("Chọn ít nhất một bữa cần lập.")
      return
    }
    if (!Number.isInteger(request.people) || request.people < 1 || request.people > 20) {
      setNotice("Số người ăn cần từ 1 đến 20.")
      return
    }
    const pantry = PREVIEW_PANTRY.filter((item) => selectedPantry.includes(item.id)).map((item) => `${item.name} (${item.amount})`)
    const prompt = [
      "Hãy đề xuất bản nháp thực đơn 7 ngày lặp theo thứ trong tuần, từ Thứ Hai đến Chủ nhật.",
      `Các bữa cần lập mỗi ngày: ${request.meals.map((meal) => PREVIEW_MEAL_LABELS[meal].toLowerCase()).join(", ")}.`,
      `Số người ăn: ${request.people}. Thời gian nấu tối đa mỗi bữa: ${request.maxMinutes} phút.`,
      `Ưu tiên: ${request.priority.toLowerCase()}.`,
      `Hồ sơ ăn uống mẫu: ăn chay, dị ứng ${allergy === "none" ? "đã xác nhận không có" : "đậu phộng và mè"}.`,
      pantry.length || request.ingredients.trim() ? `Nguyên liệu đang có, hãy ưu tiên dùng khi phù hợp: ${[...pantry, request.ingredients.trim()].filter(Boolean).join(", ")}.` : "",
      request.note.trim() ? `Yêu cầu bổ sung: ${request.note.trim()}` : "",
      "Hãy cho tôi xem đề xuất trước, tôi sẽ tự quyết định khi nào lưu thực đơn.",
    ].filter(Boolean).join("\n")
    if (prompt.length > 4000) {
      setNotice("Yêu cầu quá 4.000 ký tự. Hãy rút ngắn nội dung thêm.")
      return
    }
    setInput(prompt)
    setIsFormMessage(true)
    setConfirmationOpen(false)
    setHandoffState("prepared")
    setTab("chat")
    setNotice("Yêu cầu đã ở ô chat. Bấm Gửi để xem đề xuất mẫu bên phải.")
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function updateMeal(dayIndex: number, meal: PreviewMealKey, next: PreviewMeal) {
    setDraft((current) =>
      current?.map((day, index) =>
        index === dayIndex ? { ...day, meals: { ...day.meals, [meal]: next } } : day
      ) ?? null
    )
  }

  function toggleLock(dayIndex: number, meal: PreviewMealKey) {
    const current = draft?.[dayIndex]?.meals[meal]
    if (!current) return
    updateMeal(dayIndex, meal, { ...current, locked: !current.locked })
  }

  function findReplacement(target: Target) {
    if (!draft) return
    const current = draft[target.dayIndex].meals[target.meal]
    if (current.locked) {
      setNotice("Mở khóa bữa này trước khi đổi món.")
      return
    }
    if (scenario === "insufficient") {
      setNotice("Không có món phù hợp trong dữ liệu mẫu với yêu cầu này. Bữa hiện tại không đổi.")
      return
    }
    setProposal({
      ...target,
      oldMeal: current,
      newMeal: alternatePreviewMeal(current, target.meal),
    })
    setReplaceTarget(null)
    setNotice("Món dưới đây là đề xuất mẫu. Chưa có thay đổi nào được áp dụng.")
  }

  function applyProposal() {
    if (!proposal) return
    const current = draft?.[proposal.dayIndex]?.meals[proposal.meal]
    if (!current || current.locked) {
      setNotice("Bữa này đang khóa hoặc đã đổi. Hãy kiểm tra lại trước khi áp dụng.")
      return
    }
    updateMeal(proposal.dayIndex, proposal.meal, proposal.newMeal)
    setSelectedDay(proposal.dayIndex)
    setProposal(null)
    setNotice("Đã áp dụng vào bản nháp trong bản xem thử. Thực đơn chưa được lưu.")
  }

  function regenerate(scope: "day" | "week") {
    setDraft((current) =>
      current?.map((day, index) => {
        if (scope === "day" && index !== selectedDay) return day
        return {
          ...day,
          meals: Object.fromEntries(
            PREVIEW_MEAL_KEYS.map((key) => [
              key,
              day.meals[key].locked ? day.meals[key] : alternatePreviewMeal(day.meals[key], key),
            ])
          ) as PreviewDay["meals"],
        }
      }) ?? null
    )
    setNotice(
      scope === "day"
        ? "Đã làm mới các bữa chưa khóa của ngày này trong bản nháp mẫu."
        : "Đã làm mới các bữa chưa khóa trong bản nháp mẫu."
    )
  }

  function savePreview() {
    if (!draft) return
    if (scenario === "save-error") {
      setNotice("Không lưu được bản xem thử. Bản nháp và thực đơn mẫu đã lưu trước đó vẫn được giữ.")
      return
    }
    setSaved(cloneDays(draft))
    setScenario("draft")
    setNotice("Đã lưu trong bản xem thử trên trang này. Tài khoản của bạn không thay đổi.")
  }

  const currentDay = draft?.[selectedDay]
  const contextDay = context && draft?.[context.dayIndex]
  const showPlanBadge = Boolean(draft && tab === "chat")

  return (
    <section aria-label="Bản xem thử trang lên thực đơn" className="min-w-0 bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-primary/5 px-4 py-2 sm:px-5">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
          <SparklesIcon aria-hidden className="size-3.5" />
          Bản xem thử — dữ liệu mẫu
        </span>
        <label className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="shrink-0">Tình huống</span>
          <select
            aria-label="Chọn tình huống xem thử"
            className="h-8 max-w-[14rem] rounded-lg border border-border bg-card px-2 text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            value={scenario}
            onChange={(event) => loadScenario(event.target.value as Scenario)}
          >
            {SCENARIOS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as PreviewTab)}>
        <div className="border-b border-border bg-card px-4 py-2 lg:hidden sm:px-5">
          <TabsList aria-label="Chọn vùng lên thực đơn" className="w-full">
            <TabsTrigger value="chat" className="flex-1">
              Trợ lý
            </TabsTrigger>
            <TabsTrigger value="plan" className="flex-1">
              {draft && !confirmationOpen ? "Thực đơn" : "Lên thực đơn"}
              {showPlanBadge && <span className="size-2 rounded-full bg-primary" aria-label="Có thực đơn để xem" />}
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="min-w-0 lg:grid lg:h-[calc(100dvh-3.25rem)] lg:grid-cols-[minmax(0,11fr)_minmax(22rem,9fr)]">
          <div className={cn("min-w-0 lg:flex lg:min-h-0 lg:flex-col", tab !== "chat" && "hidden lg:flex")}>
            <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 sm:px-5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <SparklesIcon aria-hidden className="size-5" />
              </span>
              <div className="min-w-0">
                <h1 className="font-heading text-base font-bold">Trợ lý Vedora</h1>
                <p className="text-xs text-muted-foreground">Cùng bạn chọn món và lên thực đơn</p>
              </div>
            </header>

            <div className="min-w-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 pb-8 sm:p-5">
              <div className="rounded-2xl border border-border bg-card shadow-sm">
                <button
                  type="button"
                  aria-expanded={profileOpen}
                  aria-controls="preview-profile-body"
                  className="flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                  onClick={() => setProfileOpen((value) => !value)}
                >
                  <span>
                    <span className="block text-sm font-semibold">Hồ sơ ăn uống</span>
                    <span className="block text-xs text-muted-foreground">Tóm tắt để bạn kiểm tra trước khi lên thực đơn</span>
                  </span>
                  <ChevronDownIcon aria-hidden className={cn("size-4 transition-transform", profileOpen && "rotate-180")} />
                </button>
                {profileOpen && (
                  <div id="preview-profile-body" className="space-y-3 border-t border-border px-4 py-3 text-sm">
                    {scenario === "profile-loading" ? (
                      <p role="status" className="text-muted-foreground">Đang tải hồ sơ ăn uống…</p>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          <p><span className="text-muted-foreground">Chế độ ăn:</span> Ăn chay</p>
                          <p>
                            <span className="text-muted-foreground">Dị ứng:</span>{" "}
                            {allergy === "unknown"
                              ? "Chưa khai báo"
                              : allergy === "none"
                                ? "Đã xác nhận không có dị ứng"
                                : "Đậu phộng, mè"}
                          </p>
                        </div>
                        <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>Trạng thái dị ứng mẫu</span>
                          <select
                            aria-label="Trạng thái dị ứng mẫu"
                            className="rounded-lg border border-border bg-background px-2 py-1 text-foreground"
                            value={allergy}
                            onChange={(event) => { setAllergy(event.target.value as AllergyState); setProfileConfirmed(false) }}
                          >
                            <option value="unknown">Chưa khai báo</option>
                            <option value="none">Đã xác nhận không có</option>
                            <option value="some">Có dị ứng</option>
                          </select>
                        </label>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <Link href="/home/dietary" className="text-xs font-semibold text-primary underline-offset-4 hover:underline focus-visible:underline">
                            Xem hồ sơ
                          </Link>
                          <label className="flex items-center gap-2 text-xs">
                            <span>Dùng hồ sơ ăn uống khi trò chuyện</span>
                            <Switch checked={useProfileForChat} onCheckedChange={setUseProfileForChat} size="sm" aria-label="Dùng hồ sơ ăn uống khi trò chuyện" />
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <SparklesIcon aria-hidden className="size-4" />
                </span>
                <div className="max-w-[38rem] rounded-2xl rounded-tl-md bg-card px-4 py-3 text-sm leading-relaxed shadow-sm ring-1 ring-border">
                  Bạn muốn lên thực đơn hay tìm hiểu thêm về món chay? Mình có thể giúp bạn chọn món theo sở thích, thời gian nấu và các thành phần cần tránh.
                </div>
              </div>

              {messages.map((message, index) => (
                <div key={`${index}-${message}`} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-sm leading-relaxed text-primary-foreground">
                    {message}
                  </p>
                </div>
              ))}

              {messages.length === 0 && (
                <div className="flex flex-wrap gap-2 pl-11" aria-label="Gợi ý bắt đầu">
                  {QUICK_ACTIONS.map((suggestion, index) => (
                    <button
                      key={suggestion}
                      type="button"
                      className="rounded-full border border-border bg-card px-3 py-2 text-left text-xs transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                      onClick={() => quickAction(index)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}

              {scenario === "answer-loading" && <p role="status" className="pl-11 text-sm text-muted-foreground">Đang trả lời…</p>}
              {scenario === "create-loading" && <p role="status" className="pl-11 text-sm text-muted-foreground">Đang tạo bản nháp…</p>}
              {scenario === "quota" && (
                <div role="alert" className="rounded-2xl border border-amber-500/30 bg-amber-50 p-4 text-sm text-amber-950">
                  Bạn đã hết lượt dùng trợ lý. Thực đơn hiện có vẫn xem được. Bạn có thể mở biểu mẫu để tiếp tục.
                </div>
              )}
              {scenario === "missing-profile" && (
                <div role="alert" className="rounded-2xl border border-border bg-card p-4 text-sm">
                  Bạn chưa khai báo dị ứng. Hãy xác nhận hồ sơ ăn uống trước khi lập thực đơn.
                  <Link href="/home/dietary" className="ml-1 font-semibold text-primary underline">Xem hồ sơ</Link>
                </div>
              )}
              {scenario === "create-error" && (
                <div role="alert" className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
                  Chưa tạo được bản nháp. Yêu cầu đã nhập vẫn được giữ. Bạn có thể thử lại.
                </div>
              )}
              {notice && <p role="status" className="rounded-xl bg-muted px-3 py-2 text-xs leading-relaxed">{notice}</p>}
              {draft && tab === "chat" && (
                <Button variant="outline" onClick={() => setTab("plan")} className="lg:hidden">
                  Xem đề xuất <ArrowRightIcon aria-hidden />
                </Button>
              )}
              <div ref={chatEndRef} aria-hidden />
            </div>

            <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-border bg-card/95 p-4 shadow-[0_-8px_22px_rgba(20,38,26,0.04)] backdrop-blur-lg sm:bottom-0 sm:px-5 lg:static">
              {replaceTarget && draft && (
                <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs text-primary">
                  <span className="truncate">Đổi món · {PREVIEW_MEAL_LABELS[replaceTarget.meal]} · {draft[replaceTarget.dayIndex]?.meals[replaceTarget.meal].title}</span>
                  <button type="button" aria-label="Bỏ yêu cầu đổi món" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { setReplaceTarget(null); setInput("") }}><XIcon aria-hidden className="size-3.5" /></button>
                </div>
              )}
              {context && contextDay && (
                <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs text-primary">
                  <span className="truncate">{dateLabel(contextDay.date)} · {PREVIEW_MEAL_LABELS[context.meal]} · {contextDay.meals[context.meal].title}</span>
                  <button type="button" aria-label="Bỏ món đính kèm" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setContext(null)}><XIcon aria-hidden className="size-3.5" /></button>
                </div>
              )}
              <form onSubmit={sendMessage} className="flex items-end gap-2 rounded-2xl border border-border bg-background p-1.5 focus-within:border-primary/40 focus-within:ring-3 focus-within:ring-ring/15">
                <textarea
                  ref={inputRef}
                  aria-label="Tin nhắn cho trợ lý"
                  rows={1}
                  className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
                  placeholder="Hỏi về món chay hoặc yêu cầu đổi món…"
                  maxLength={4000}
                  value={input}
                  onChange={(event) => {
                    setInput(event.target.value)
                    event.target.style.height = "auto"
                    event.target.style.height = `${Math.min(event.target.scrollHeight, 128)}px`
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return
                    event.preventDefault()
                    sendMessage()
                  }}
                />
                <Button type="submit" size="icon" shape="pill" aria-label="Gửi tin nhắn" disabled={!input.trim() || isBusy}>
                  <ArrowUpIcon aria-hidden />
                </Button>
              </form>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">Bản xem thử không gửi câu hỏi đến trợ lý.</p>
                <Button variant="link" size="xs" onClick={() => { setConfirmationOpen(true); setHandoffState("editing"); setIsFormMessage(false); setInput(""); setNotice(""); setTab("plan") }}>
                  Lên thực đơn
                </Button>
              </div>
            </div>
          </div>

          <div className={cn("min-w-0 border-l border-border bg-card lg:flex lg:min-h-0 lg:flex-col", tab !== "plan" && "hidden lg:flex")}>
            <header className={cn("flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5", confirmationOpen && "min-h-24 bg-gradient-to-r from-card via-card to-brand-cream/25")}>
              <div className="min-w-0">
                <h2 className="font-heading text-base font-bold">{confirmationOpen || handoffState === "prepared" || !draft ? "Lên thực đơn" : "Thực đơn mẫu"}</h2>
                {draft && !confirmationOpen && handoffState !== "prepared" && <p className="text-xs text-muted-foreground">{formatPreviewDate(draft[0].date)} – {formatPreviewDate(draft[draft.length - 1].date)}</p>}
              </div>
              {confirmationOpen && <Image src="/tomato-sticker.png" alt="" aria-hidden width={80} height={68} className="h-16 w-16 shrink-0 object-contain drop-shadow-[0_6px_7px_rgba(37,85,50,0.15)] sm:h-20 sm:w-20" />}
              {draft && !confirmationOpen && handoffState !== "prepared" && (
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", hasUnsaved ? "bg-amber-100 text-amber-900" : "bg-primary/10 text-primary")}>
                  {hasUnsaved ? saved ? "Có thay đổi chưa lưu" : "Bản nháp" : "Đã lưu trong bản xem thử"}
                </span>
              )}
            </header>

            {confirmationOpen ? (
              <form noValidate onSubmit={(event) => { event.preventDefault(); prepareRequest() }} className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
                <div>
                  <h3 className="font-heading text-lg font-bold">Yêu cầu lập thực đơn</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">7 ngày lặp theo thứ trong tuần. Đây là bản xem thử dùng dữ liệu mẫu.</p>
                </div>
                <fieldset>
                  <legend className="mb-2 text-xs font-semibold">Các bữa mỗi ngày</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {PREVIEW_MEAL_KEYS.map((key) => (
                      <label key={key} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                        <input type="checkbox" className="size-4 accent-primary" checked={request.meals.includes(key)} onChange={(event) => setRequest((current) => ({ ...current, meals: event.target.checked ? [...current.meals, key] : current.meals.filter((meal) => meal !== key) }))} />
                        {PREVIEW_MEAL_LABELS[key]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1 text-xs font-semibold"><span>Số người ăn</span><input type="number" min={1} max={20} className={FIELD_CLASS} value={request.people} onChange={(event) => setRequest((current) => ({ ...current, people: Number(event.target.value) }))} /></label>
                  <label className="space-y-1 text-xs font-semibold"><span>Tối đa mỗi bữa</span><select className={FIELD_CLASS} value={request.maxMinutes} onChange={(event) => setRequest((current) => ({ ...current, maxMinutes: Number(event.target.value) }))}><option value={15}>15 phút</option><option value={30}>30 phút</option><option value={45}>45 phút</option><option value={60}>60 phút</option></select></label>
                </div>
                <label className="block space-y-1 text-xs font-semibold"><span>Ưu tiên</span><select className={FIELD_CLASS} value={request.priority} onChange={(event) => setRequest((current) => ({ ...current, priority: event.target.value }))}><option>Đa dạng</option><option>Nấu nhanh</option><option>Tiết kiệm</option><option>Tận dụng nguyên liệu</option></select></label>

                <section aria-labelledby="preview-pantry-title" className="space-y-3 border-t border-border pt-5">
                  <div><h4 id="preview-pantry-title" className="text-sm font-bold">Nguyên liệu đang có</h4><p className="mt-1 text-xs leading-5 text-muted-foreground">Chọn từ hồ sơ ăn uống mẫu hoặc nhập thêm cho yêu cầu này.</p></div>
                  <fieldset>
                    <legend className="mb-2 text-xs font-semibold">Từ hồ sơ ăn uống mẫu</legend>
                    <div className="space-y-2">
                      {PREVIEW_PANTRY.map((item) => (
                        <label key={item.id} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm">
                          <input type="checkbox" className="size-4 accent-primary" checked={selectedPantry.includes(item.id)} onChange={(event) => setSelectedPantry((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />
                          {item.name} · {item.amount}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label className="block space-y-1 text-xs font-semibold"><span>Thêm nguyên liệu (tên, lượng nếu có)</span><input className={FIELD_CLASS} maxLength={300} value={request.ingredients} onChange={(event) => setRequest((current) => ({ ...current, ingredients: event.target.value }))} placeholder="Ví dụ: cà rốt 300 g, đậu hũ 2 miếng" /></label>
                </section>

                <section aria-labelledby="preview-diet-title" className="space-y-3 border-t border-border pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2"><h4 id="preview-diet-title" className="text-sm font-bold">Kiểm tra hồ sơ ăn uống</h4><Link href="/home/dietary" className="text-xs font-semibold text-primary underline-offset-4 hover:underline">Chỉnh hồ sơ</Link></div>
                  <div className="rounded-xl bg-primary/5 px-3 py-2 text-xs leading-5"><p><strong>Chế độ ăn:</strong> Ăn chay</p><p><strong>Dị ứng:</strong> {allergy === "unknown" ? "Chưa khai báo" : allergy === "none" ? "Đã xác nhận không có" : "Đậu phộng và mè"}</p><p><strong>Thực phẩm cần tránh đã lưu:</strong> Không có trong dữ liệu mẫu</p></div>
                  {scenario === "profile-loading" && <p role="status" className="rounded-xl bg-muted px-3 py-2 text-xs">Đang tải hồ sơ ăn uống mẫu…</p>}
                  {allergy === "unknown" && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">Hãy khai báo dị ứng trong hồ sơ ăn uống trước khi lập thực đơn.</p>}
                  <label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={profileConfirmed} disabled={allergy === "unknown" || scenario === "profile-loading"} onChange={(event) => setProfileConfirmed(event.target.checked)} /><span>Tôi đã kiểm tra thông tin ăn uống và dị ứng ở trên.</span></label>
                </section>

                <label className="block space-y-1 border-t border-border pt-5 text-xs font-semibold"><span>Yêu cầu thêm (nếu có)</span><textarea value={request.note} maxLength={2500} rows={3} onChange={(event) => setRequest((current) => ({ ...current, note: event.target.value }))} placeholder="Ví dụ: bữa tối nhẹ, ít dầu…" className="min-h-24 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/25" /></label>
                {notice && <p role="status" className="rounded-xl bg-muted px-3 py-2 text-xs leading-5">{notice}</p>}
                <div className="space-y-2 border-t border-border pt-5">
                  <Button type="submit" className="w-full" disabled={allergy === "unknown" || scenario === "profile-loading" || scenario === "create-loading"}>Đưa yêu cầu vào chat <ArrowRightIcon aria-hidden /></Button>
                  {draft && <Button type="button" variant="ghost" className="w-full" onClick={() => setConfirmationOpen(false)}>Quay lại thực đơn mẫu</Button>}
                  <p className="text-center text-xs leading-5 text-muted-foreground">Bạn sẽ xem lại và bấm Gửi trong chat. Không có dữ liệu nào được gửi tới API.</p>
                </div>
              </form>
            ) : handoffState === "prepared" || (handoffState === "sent" && !draft) ? (
              <div role="status" className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
                <span className="flex size-16 items-center justify-center rounded-3xl bg-primary/10 text-primary"><CalendarDaysIcon aria-hidden className="size-8" /></span>
                <div className="max-w-[20rem] space-y-2">
                  <h3 className="font-heading text-lg font-bold">{handoffState === "prepared" ? "Yêu cầu đã sẵn sàng trong chat" : scenario === "create-loading" ? "Đang tạo đề xuất mẫu…" : scenario === "create-error" ? "Chưa tạo được đề xuất mẫu" : "Chưa có đề xuất thực đơn mới"}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{handoffState === "prepared" ? "Kiểm tra nội dung trong ô chat rồi bấm Gửi để xem bảng thực đơn mẫu tại đây." : scenario === "create-error" ? "Đây là tình huống lỗi mẫu. Bạn có thể sửa yêu cầu và thử lại." : "Xem phản hồi trong chat; bảng thực đơn mẫu sẽ hiện ở cột này khi có đề xuất."}</p>
                </div>
                <Button variant="outline" onClick={() => { setConfirmationOpen(true); setHandoffState("editing"); setIsFormMessage(false); setInput(""); setNotice(""); setTab("plan") }}>Sửa thông tin</Button>
              </div>
            ) : !draft ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
                <span className="flex size-16 items-center justify-center rounded-3xl bg-primary/10 text-primary"><CalendarDaysIcon aria-hidden className="size-8" /></span>
                <div className="max-w-[19rem] space-y-2">
                  <h3 className="font-heading text-xl font-bold">Tuần này mình ăn gì?</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">Điền yêu cầu tại đây rồi gửi trong chat để xem thực đơn mẫu.</p>
                </div>
                <Button onClick={() => { setTab("plan"); setConfirmationOpen(true) }}>Bắt đầu lên thực đơn <ArrowRightIcon aria-hidden /></Button>
              </div>
            ) : (
              <>
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 pb-8 sm:p-5">
                  <p className="rounded-xl bg-primary/5 px-3 py-2 text-xs leading-5 text-primary">Bảng thực đơn này dùng món và ngày minh họa. Thực đơn thật lặp theo thứ trong tuần.</p>
                  {scenario === "save-error" && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">Không lưu được. Bản nháp vẫn còn để bạn thử lại.</p>}
                  {scenario === "insufficient" && <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-50 p-3 text-sm text-amber-950">Không đủ món phù hợp trong dữ liệu mẫu. Các bữa hiện tại được giữ nguyên.</p>}
                  {scenario === "quota" && <p role="alert" className="rounded-xl border border-amber-500/30 bg-amber-50 p-3 text-sm text-amber-950">Đã hết lượt trợ lý. Bạn vẫn xem và chỉnh bản nháp hiện có.</p>}
                  {scenario === "save-loading" && <p role="status" className="text-sm text-muted-foreground">Đang lưu…</p>}
                  {scenario === "replace-loading" && <p role="status" className="text-sm text-muted-foreground">Đang tìm món thay thế…</p>}
                  <p className="text-xs text-muted-foreground">{request.people} người · {request.meals.map((key) => PREVIEW_MEAL_LABELS[key].toLowerCase()).join(", ")}</p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon-sm" aria-label="Ngày trước" disabled={selectedDay === 0} onClick={() => setSelectedDay((day) => day - 1)}><ChevronLeftIcon aria-hidden /></Button>
                    <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1" aria-label="Chọn ngày">
                      {draft.map((day, index) => (
                        <button key={day.date} type="button" aria-current={selectedDay === index ? "date" : undefined} className={cn("min-w-14 rounded-xl border px-2 py-2 text-center text-xs outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/30", selectedDay === index ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/40")} onClick={() => setSelectedDay(index)}>
                          <span className="block font-semibold">{WEEKDAY_SHORT[new Date(`${day.date}T12:00:00`).getDay()]}</span>
                          <span className="block">{formatPreviewDate(day.date)}</span>
                          {day.date === formatToday() && <span className="mt-0.5 block text-[10px]">Hôm nay</span>}
                        </button>
                      ))}
                    </div>
                    <Button variant="outline" size="icon-sm" aria-label="Ngày sau" disabled={selectedDay === draft.length - 1} onClick={() => setSelectedDay((day) => day + 1)}><ChevronRightIcon aria-hidden /></Button>
                  </div>

                  {currentDay && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-heading text-lg font-bold">{dateLabel(currentDay.date)}</h3>
                        <Button variant="ghost" size="sm" onClick={() => regenerate("day")}><RefreshCwIcon aria-hidden /> Tạo lại ngày này</Button>
                      </div>
                      {request.meals.map((key) => {
                        const meal = currentDay.meals[key]
                        const isProposal = proposal?.dayIndex === selectedDay && proposal.meal === key
                        return (
                          <article key={key} className="rounded-2xl border border-border bg-background p-3 shadow-sm">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-primary">{PREVIEW_MEAL_LABELS[key]}</p>
                              <Button variant="ghost" size="icon-sm" title={meal.locked ? "Mở khóa bữa" : "Khóa bữa"} aria-label={`${meal.locked ? "Mở khóa" : "Khóa"} ${PREVIEW_MEAL_LABELS[key].toLowerCase()} ${dateLabel(currentDay.date)}`} onClick={() => toggleLock(selectedDay, key)}>
                                {meal.locked ? <LockKeyholeIcon aria-hidden /> : <LockKeyholeOpenIcon aria-hidden />}
                              </Button>
                            </div>
                            <div className="flex gap-3">
                              <div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary/55"><ImageIcon aria-hidden className="size-6" /></div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold leading-snug">{meal.title}</p>
                                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Clock3Icon aria-hidden className="size-3.5" />{meal.minutes} phút</span><span className="inline-flex items-center gap-1"><UsersRoundIcon aria-hidden className="size-3.5" />{meal.servings} khẩu phần</span></p>
                                {meal.locked && <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary"><LockKeyholeIcon aria-hidden className="size-3" />Đã khóa</span>}
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                              <Button variant="outline" size="xs" onClick={() => setRecipe(meal)}>Xem công thức</Button>
                              <Button variant="outline" size="xs" onClick={() => { setReplaceTarget({ dayIndex: selectedDay, meal: key }); setProposal(null); setNotice(""); setInput(`Đề xuất món khác thay cho "${meal.title}" ở ${dateLabel(currentDay.date)}, ${PREVIEW_MEAL_LABELS[key].toLowerCase()}.`); setTab("chat"); requestAnimationFrame(() => inputRef.current?.focus()) }} disabled={meal.locked}>Đổi món</Button>
                              <Button variant="ghost" size="xs" onClick={() => { setContext({ dayIndex: selectedDay, meal: key }); setTab("chat"); requestAnimationFrame(() => inputRef.current?.focus()) }}>Hỏi trợ lý về món này</Button>
                            </div>
                            {isProposal && proposal && (
                              <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Đề xuất của trợ lý · dữ liệu mẫu</p>
                                <p className="mt-2 text-sm"><span className="text-muted-foreground">{proposal.oldMeal.title}</span><ArrowRightIcon aria-hidden className="mx-2 inline size-3.5" /><strong>{proposal.newMeal.title}</strong></p>
                                <p className="mt-1 text-xs text-muted-foreground">Món thay thế mẫu để xem cách xác nhận. Chưa cập nhật thực đơn.</p>
                                <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={applyProposal}>Áp dụng vào bản nháp</Button><Button variant="outline" size="sm" onClick={() => { setProposal(null); setNotice("Đã giữ món cũ. Bản nháp không thay đổi.") }}>Giữ món cũ</Button></div>
                              </div>
                            )}
                          </article>
                        )
                      })}
                    </div>
                  )}
                  <Button variant="outline" className="w-full" onClick={() => regenerate("week")}><RotateCcwIcon aria-hidden /> Tạo lại thực đơn</Button>
                </div>
                <footer className="border-t border-border bg-card px-4 py-3 sm:px-5">
                  {hasUnsaved && <p className="mb-2 text-xs text-amber-900">Còn thay đổi chưa lưu trong bản xem thử.</p>}
                  {notice && tab === "plan" && <p role="status" className="mb-2 text-xs text-muted-foreground">{notice}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={savePreview} disabled={scenario === "save-loading"}><CheckIcon aria-hidden />{scenario === "save-loading" ? "Đang lưu…" : "Lưu bản xem thử"}</Button>
                    {saved && hasUnsaved && <Button variant="outline" onClick={() => { setDraft(cloneDays(saved)); setProposal(null); setNotice("Đã bỏ thay đổi trong bản xem thử.") }}>Bỏ thay đổi</Button>}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">Không lưu vào tài khoản hay gửi dữ liệu lên máy chủ.</p>
                </footer>
              </>
            )}
          </div>
        </div>
      </Tabs>

      <Dialog open={recipe !== null} onOpenChange={(open) => !open && setRecipe(null)}>
        {recipe && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{recipe.title}</DialogTitle>
              <DialogDescription>Công thức chưa được kèm trong dữ liệu xem thử. Món này chỉ dùng để kiểm tra bố cục.</DialogDescription>
            </DialogHeader>
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><UtensilsCrossedIcon aria-hidden className="size-4" />{recipe.minutes} phút · {recipe.servings} khẩu phần</p>
          </DialogContent>
        )}
      </Dialog>
    </section>
  )
}

function formatToday() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
}
