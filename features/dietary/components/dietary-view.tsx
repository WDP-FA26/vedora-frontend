"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  HeartIcon,
  ImageIcon,
  LeafIcon,
  PencilIcon,
  PlusIcon,
  ShieldCheckIcon,
  ShoppingBasketIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  Trash2Icon,
} from "lucide-react"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/features/auth/hooks/use-auth"
import {
  copyDraft,
  FOOD_CATALOG,
  type AllergyStatus,
  type DietaryDraft,
  type DietMode,
  type FoodOption,
  type PantryItem,
  type PantryUnit,
  type PreferenceKind,
} from "@/features/dietary/dietary-draft"
import { useDietaryDraft } from "@/features/dietary/hooks/use-dietary-draft"
import { profilePath } from "@/features/profiles/profiles-cache"
import { cn } from "cn"

const ALLERGENS = FOOD_CATALOG.filter((item) =>
  ["peanut", "tree-nuts", "milk", "egg", "soy", "wheat", "gluten", "fish", "shellfish", "sesame"].includes(item.id)
)

const MODE_EXCLUSIONS: Record<Exclude<DietMode, null>, string[]> = {
  vegetarian: ["beef", "pork", "chicken", "fish", "shellfish"],
  vegan: ["beef", "pork", "chicken", "fish", "shellfish", "milk", "egg", "honey"],
}

function sameIds(first: string[], second: string[]) {
  return first.length === second.length && first.every((id, index) => id === second[index])
}

function sameFoods(first: FoodOption[], second: FoodOption[]) {
  return first.length === second.length && first.every((item, index) =>
    item.id === second[index].id && item.name === second[index].name
  )
}

function samePantry(first: PantryItem[], second: PantryItem[]) {
  return first.length === second.length && first.every((item, index) => {
    const saved = second[index]
    return item.id === saved.id && item.name === saved.name && item.amount === saved.amount &&
      item.unit === saved.unit && item.imageUrl === saved.imageUrl
  })
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ")
}

function newLocalId() {
  return `local-${crypto.randomUUID()}`
}

function readLocalImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result)
      else reject(new Error("Không thể đọc ảnh."))
    })
    reader.addEventListener("error", () => reject(new Error("Không thể đọc ảnh.")))
    reader.readAsDataURL(file)
  })
}

function searchCatalog(query: string, options = FOOD_CATALOG) {
  const normalizedQuery = query.trim().toLocaleLowerCase("vi")
  if (!normalizedQuery) return options
  return options.filter((option) => option.name.toLocaleLowerCase("vi").includes(normalizedQuery))
}

/** Private dietary editor sharing applied UI choices with the owner's overview. */
export function DietaryView() {
  const { user } = useAuth()
  const { appliedDraft, applyDraft } = useDietaryDraft(user?.id)

  return (
    <DietaryEditor
      key={user?.id ?? "signed-out"}
      userId={user?.id}
      initialDraft={appliedDraft}
      onApply={applyDraft}
    />
  )
}

function DietaryEditor({ userId, initialDraft, onApply }: {
  userId: string | undefined
  initialDraft: DietaryDraft
  onApply: (draft: DietaryDraft) => void
}) {
  const [draft, setDraft] = useState<DietaryDraft>(() => copyDraft(initialDraft))
  const [savedDraft, setSavedDraft] = useState<DietaryDraft>(() => copyDraft(initialDraft))
  const [allergyQuery, setAllergyQuery] = useState("")
  const [allergyName, setAllergyName] = useState("")
  const [allergyEditId, setAllergyEditId] = useState<string | null>(null)
  const [preferenceName, setPreferenceName] = useState("")
  const [preferenceKind, setPreferenceKind] = useState<PreferenceKind>("likes")
  const [preferenceEditId, setPreferenceEditId] = useState<string | null>(null)
  const [preferenceEditorOpen, setPreferenceEditorOpen] = useState(false)
  const [preferenceCatalogOpen, setPreferenceCatalogOpen] = useState(false)
  const [preferenceError, setPreferenceError] = useState("")
  const [pantryName, setPantryName] = useState("")
  const [pantryAmount, setPantryAmount] = useState("")
  const [pantryUnit, setPantryUnit] = useState<PantryUnit>("g")
  const [pantryImage, setPantryImage] = useState<string | null>(null)
  const [pantryEditId, setPantryEditId] = useState<string | null>(null)
  const [pantryEditorOpen, setPantryEditorOpen] = useState(false)
  const [pantryError, setPantryError] = useState("")
  const [allergyError, setAllergyError] = useState("")
  const [saveMessage, setSaveMessage] = useState("")

  const isDirty = useMemo(() =>
    draft.dietMode !== savedDraft.dietMode ||
    draft.allergyStatus !== savedDraft.allergyStatus ||
    !sameIds(draft.allergens, savedDraft.allergens) ||
    !sameFoods(draft.customAllergens, savedDraft.customAllergens) ||
    !sameIds(draft.likes, savedDraft.likes) ||
    !sameIds(draft.dislikes, savedDraft.dislikes) ||
    !sameFoods(draft.customPreferences, savedDraft.customPreferences) ||
    !samePantry(draft.pantry, savedDraft.pantry), [draft, savedDraft]
  )
  const hasOpenEditor = Boolean(allergyName.trim() || allergyEditId || preferenceName.trim() || preferenceEditId || pantryName.trim() || pantryAmount || pantryImage || pantryEditId)
  const allergenOptions = useMemo(() => [...ALLERGENS, ...draft.customAllergens], [draft.customAllergens])
  const preferenceOptions = useMemo(() => [...FOOD_CATALOG, ...draft.customPreferences], [draft.customPreferences])
  const visibleAllergens = searchCatalog(allergyQuery, allergenOptions)
  const visiblePreferences = preferenceOptions.filter((item) =>
    !draft.likes.includes(item.id) && !draft.dislikes.includes(item.id)
  )
  const pantrySuggestions = searchCatalog(pantryName).filter((item) =>
    item.name.toLocaleLowerCase("vi") !== normalizeName(pantryName).toLocaleLowerCase("vi")
  )

  const exclusions = useMemo(() => {
    const reasons = new Map<string, Set<string>>()
    const addReason = (id: string, reason: string) => {
      const current = reasons.get(id) ?? new Set<string>()
      current.add(reason)
      reasons.set(id, current)
    }

    if (draft.dietMode) {
      for (const id of MODE_EXCLUSIONS[draft.dietMode]) {
        addReason(id, draft.dietMode === "vegan" ? "Do chế độ thuần chay" : "Do chế độ ăn chay")
      }
    }
    if (draft.allergyStatus === "some") {
      for (const id of draft.allergens) addReason(id, "Do dị ứng")
    }

    return [...reasons.entries()].flatMap(([id, itemReasons]) => {
      const food = allergenOptions.find((item) => item.id === id) ?? FOOD_CATALOG.find((item) => item.id === id)
      return food ? [{ ...food, reasons: [...itemReasons] }] : []
    })
  }, [draft.allergens, draft.allergyStatus, draft.dietMode, allergenOptions])

  const excludedIds = new Set(exclusions.map((item) => item.id))
  const excludedNames = new Set(exclusions.map((item) => normalizeName(item.name).toLocaleLowerCase("vi")))
  const excludedGroups = new Set(
    exclusions.flatMap((item) => (item.allergyGroup ? [item.id, item.allergyGroup] : [item.id]))
  )
  const conflictingLikes = draft.likes
    .map((id) => preferenceOptions.find((item) => item.id === id))
    .filter((item): item is FoodOption =>
      Boolean(item && (
        excludedIds.has(item.id) ||
        excludedNames.has(normalizeName(item.name).toLocaleLowerCase("vi")) ||
        (item.allergyGroup && excludedGroups.has(item.allergyGroup))
      ))
    )

  function updateDraft(patch: Partial<DietaryDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
    setSaveMessage("")
    setAllergyError("")
  }

  function chooseAllergyStatus(status: AllergyStatus) {
    if (status !== "some" && draft.allergens.length > 0) {
      const message = status === "none"
        ? "Chọn “Không có dị ứng” sẽ xoá các dị ứng đã chọn. Bạn muốn tiếp tục?"
        : "Chuyển về “Chưa khai báo” sẽ xoá các dị ứng đã chọn. Bạn muốn tiếp tục?"
      if (!window.confirm(message)) return
    }
    updateDraft({
      allergyStatus: status,
      allergens: status === "some" ? draft.allergens : [],
      customAllergens: status === "some" ? draft.customAllergens : [],
    })
    if (status !== "some") {
      setAllergyName("")
      setAllergyEditId(null)
    }
  }

  function toggleAllergen(id: string) {
    const selected = draft.allergens.includes(id)
    const next = selected
      ? draft.allergens.filter((value) => value !== id)
      : [...draft.allergens, id]
    updateDraft({
      allergyStatus: "some",
      allergens: next,
      customAllergens: selected ? draft.customAllergens.filter((item) => item.id !== id) : draft.customAllergens,
    })
    if (allergyEditId === id) resetAllergyEditor()
  }

  function resetAllergyEditor() {
    setAllergyName("")
    setAllergyEditId(null)
    setAllergyError("")
  }

  function saveAllergen(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = normalizeName(allergyName)
    if (!name || name.length > 80) {
      setAllergyError("Nhập tên dị ứng từ 1 đến 80 ký tự.")
      return
    }
    const match = allergenOptions.find((item) => item.name.toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi"))
    if (match && match.id !== allergyEditId && allergyEditId) {
      setAllergyError("Tên này đã có trong danh mục. Hãy tick vào lựa chọn tương ứng.")
      return
    }
    if (allergyEditId) {
      const existing = allergenOptions.find((item) => item.id === allergyEditId)
      if (!existing) return
      if (draft.customAllergens.some((item) => item.id === allergyEditId)) {
        updateDraft({ customAllergens: draft.customAllergens.map((item) => item.id === allergyEditId ? { ...item, name } : item) })
      } else if (name !== existing.name) {
        const replacement = { id: newLocalId(), name }
        updateDraft({
          allergens: draft.allergens.map((id) => id === allergyEditId ? replacement.id : id),
          customAllergens: [...draft.customAllergens, replacement],
        })
      }
    } else if (match) {
      if (!draft.allergens.includes(match.id)) updateDraft({ allergens: [...draft.allergens, match.id] })
    } else {
      const custom = { id: newLocalId(), name }
      updateDraft({ allergens: [...draft.allergens, custom.id], customAllergens: [...draft.customAllergens, custom] })
    }
    resetAllergyEditor()
  }

  function setPreference(id: string, kind: PreferenceKind) {
    const selected = draft[kind].includes(id)
    const nextValues = selected
      ? draft[kind].filter((value) => value !== id)
      : [...draft[kind], id]
    if (kind === "likes") {
      updateDraft({
        likes: nextValues,
        dislikes: draft.dislikes.filter((value) => value !== id),
        customPreferences: selected ? draft.customPreferences.filter((item) => item.id !== id) : draft.customPreferences,
      })
    } else {
      updateDraft({
        dislikes: nextValues,
        likes: draft.likes.filter((value) => value !== id),
        customPreferences: selected ? draft.customPreferences.filter((item) => item.id !== id) : draft.customPreferences,
      })
    }
    if (selected && preferenceEditId === id) resetPreferenceEditor()
  }

  function resetPreferenceEditor() {
    setPreferenceName("")
    setPreferenceKind("likes")
    setPreferenceEditId(null)
    setPreferenceEditorOpen(false)
    setPreferenceError("")
  }

  function savePreference(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = normalizeName(preferenceName)
    if (!name || name.length > 80) {
      setPreferenceError("Nhập tên nguyên liệu từ 1 đến 80 ký tự.")
      return
    }
    const match = preferenceOptions.find((item) => item.name.toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi"))
    if (match && match.id !== preferenceEditId && preferenceEditId) {
      setPreferenceError("Tên này đã có trong danh mục. Hãy chọn lựa chọn tương ứng.")
      return
    }
    let id = preferenceEditId ?? match?.id
    let customPreferences = draft.customPreferences
    if (preferenceEditId) {
      const existing = preferenceOptions.find((item) => item.id === preferenceEditId)
      if (!existing) return
      if (draft.customPreferences.some((item) => item.id === preferenceEditId)) {
        customPreferences = draft.customPreferences.map((item) => item.id === preferenceEditId ? { ...item, name } : item)
      } else if (name !== existing.name) {
        id = newLocalId()
        customPreferences = [...draft.customPreferences, { id, name }]
      }
    } else if (!id) {
      id = newLocalId()
      customPreferences = [...draft.customPreferences, { id, name }]
    }
    if (!id) return
    const likes = draft.likes.filter((value) => value !== preferenceEditId && value !== id)
    const dislikes = draft.dislikes.filter((value) => value !== preferenceEditId && value !== id)
    if (preferenceKind === "likes") likes.push(id)
    else dislikes.push(id)
    updateDraft({ likes, dislikes, customPreferences })
    resetPreferenceEditor()
  }

  function resetPantryEditor() {
    setPantryName("")
    setPantryAmount("")
    setPantryUnit("g")
    setPantryImage(null)
    setPantryEditId(null)
    setPantryEditorOpen(false)
    setPantryError("")
  }

  async function choosePantryImage(file: File | undefined) {
    if (!file) return
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPantryError("Chọn ảnh JPEG, PNG hoặc WebP.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setPantryError("Ảnh cần nhỏ hơn 5 MB.")
      return
    }
    try {
      setPantryImage(await readLocalImage(file))
      setPantryError("")
    } catch {
      setPantryError("Không thể đọc ảnh này. Hãy chọn ảnh khác.")
    }
  }

  function savePantryItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = normalizeName(pantryName)
    const normalizedAmount = pantryAmount.trim().replace(",", ".")
    const amount = /^\d+(?:\.\d+)?$/.test(normalizedAmount) ? Number(normalizedAmount) : NaN
    if (!name || name.length > 80) {
      setPantryError("Nhập tên nguyên liệu từ 1 đến 80 ký tự.")
      return
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
      setPantryError("Nhập khối lượng lớn hơn 0 và không quá 100.000.")
      return
    }
    if (draft.pantry.some((item) => item.id !== pantryEditId && item.name.toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi"))) {
      setPantryError("Nguyên liệu này đã có. Hãy sửa mục hiện tại.")
      return
    }
    const item: PantryItem = {
      id: pantryEditId ?? newLocalId(),
      name,
      amount: String(amount),
      unit: pantryUnit,
      imageUrl: pantryImage,
    }
    updateDraft({ pantry: pantryEditId ? draft.pantry.map((current) => current.id === pantryEditId ? item : current) : [...draft.pantry, item] })
    resetPantryEditor()
  }

  function savePreview() {
    if (!userId) return
    if (draft.allergyStatus === "some" && draft.allergens.length === 0) {
      setAllergyError("Chọn ít nhất một dị ứng, hoặc đổi trạng thái khai báo.")
      return
    }
    onApply(draft)
    setSavedDraft(copyDraft(draft))
    setSaveMessage("Đã áp dụng lựa chọn.")
  }

  function discardChanges() {
    setDraft(copyDraft(savedDraft))
    setAllergyError("")
    resetAllergyEditor()
    resetPreferenceEditor()
    resetPantryEditor()
    setSaveMessage("Đã huỷ các thay đổi chưa lưu.")
  }

  useEffect(() => {
    if (!isDirty && !hasOpenEditor) return

    const message = "Bạn có thay đổi chưa lưu. Rời trang sẽ huỷ các thay đổi này."
    const confirmNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target
      if (!(target instanceof Element)) return
      const link = target.closest("a[href]")
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return
      const nextUrl = new URL(link.href, window.location.href)
      if (nextUrl.origin === window.location.origin && nextUrl.pathname === window.location.pathname && nextUrl.search === window.location.search) return
      if (!window.confirm(message)) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    }
    const confirmPageClose = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }

    document.addEventListener("click", confirmNavigation, true)
    window.addEventListener("beforeunload", confirmPageClose)
    return () => {
      document.removeEventListener("click", confirmNavigation, true)
      window.removeEventListener("beforeunload", confirmPageClose)
    }
  }, [isDirty, hasOpenEditor])

  return (
    <section aria-labelledby="dietary-title" className="pb-6">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/85 px-2 py-2 backdrop-blur-md">
        <Button
          variant="ghost"
          size="icon"
          shape="pill"
          aria-label="Quay lại hồ sơ"
          nativeButton={false}
          render={<Link href={userId ? profilePath(userId) : "/home"} />}
        >
          <ArrowLeftIcon aria-hidden />
        </Button>
        <div className="min-w-0">
          <h1 id="dietary-title" className="truncate text-lg font-bold">Hồ sơ ăn uống</h1>
          <p className="text-xs text-muted-foreground">Tuỳ chỉnh gợi ý phù hợp với bạn</p>
        </div>
      </header>

      <div className="space-y-5 p-4 sm:px-5">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="border-b border-border/70 px-(--card-spacing) pb-(--card-spacing)">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <LeafIcon aria-hidden className="size-5" />
                </span>
                <div>
                  <CardTitle>Chế độ ăn</CardTitle>
                  <CardDescription className="mt-1">Chọn cách ăn phù hợp với bạn</CardDescription>
                </div>
              </div>
            </div>
            <div className="space-y-3 px-(--card-spacing)">
              <div className="grid gap-2 sm:grid-cols-2">
                {([
                  { id: "vegetarian", title: "Ăn chay", description: "Không dùng thịt, cá và hải sản, có thể dùng trứng và sữa" },
                  { id: "vegan", title: "Thuần chay", description: "Không dùng sản phẩm từ động vật" },
                ] as const).map((option) => {
                  const selected = draft.dietMode === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => updateDraft({ dietMode: selected ? null : option.id })}
                      className={cn(
                        "flex min-h-24 flex-col items-start rounded-2xl border p-3 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/40",
                        selected ? "border-primary bg-primary/[0.06]" : "border-border hover:bg-muted/60"
                      )}
                    >
                      <span className="flex w-full items-center justify-between gap-2 font-semibold">
                        {option.title}
                        {selected && <CheckIcon aria-hidden className="size-4 text-primary" />}
                      </span>
                      <span className="mt-1 text-xs leading-5 text-muted-foreground">{option.description}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                {draft.dietMode
                  ? "Chọn lại chế độ đang bật để gỡ lựa chọn."
                  : "Chưa thiết lập, bạn có thể bỏ qua mục này."}
              </p>
            </div>
          </Card>

          <Card>
            <div className="border-b border-border/70 px-(--card-spacing) pb-(--card-spacing)">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
                  <ShieldCheckIcon aria-hidden className="size-5" />
                </span>
                <div>
                  <CardTitle>Dị ứng thực phẩm</CardTitle>
                  <CardDescription className="mt-1">Khai báo để cá nhân hoá gợi ý món ăn</CardDescription>
                </div>
              </div>
            </div>
            <div className="space-y-4 px-(--card-spacing)">
              <fieldset className="grid gap-2">
                <legend className="sr-only">Tình trạng dị ứng</legend>
                {([
                  { id: "unset", label: "Chưa khai báo", detail: "Bạn có thể thiết lập sau" },
                  { id: "none", label: "Không có dị ứng", detail: "Xác nhận bạn không có dị ứng đã biết" },
                  { id: "some", label: "Có dị ứng", detail: "Chọn các nguyên liệu cần tránh" },
                ] as const).map((option) => {
                  const selected = draft.allergyStatus === option.id
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
                        selected ? "border-primary bg-primary/[0.05]" : "border-border hover:bg-muted/60"
                      )}
                    >
                      <input
                        className="peer sr-only"
                        type="radio"
                        name="allergy-status"
                        value={option.id}
                        checked={selected}
                        onChange={() => chooseAllergyStatus(option.id)}
                      />
                      <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border peer-focus-visible:ring-3 peer-focus-visible:ring-ring/40", selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
                        {selected && <CheckIcon aria-hidden className="size-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{option.label}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{option.detail}</span>
                      </span>
                    </label>
                  )
                })}
              </fieldset>

              {draft.allergyStatus === "some" && (
                <div className="space-y-3 border-t border-border/70 pt-4">
                  <label htmlFor="allergy-search" className="text-sm font-medium">Tìm dị ứng</label>
                  <div className="relative">
                    <Input
                      id="allergy-search"
                      type="search"
                      value={allergyQuery}
                      onChange={(event) => setAllergyQuery(event.target.value)}
                      placeholder="Tìm trong danh mục nguyên liệu"
                      className="h-10"
                    />
                  </div>
                  {draft.allergens.length > 0 && (
                    <div className="flex flex-wrap gap-2" aria-label="Dị ứng đã chọn">
                      {draft.allergens.map((id) => {
                        const food = allergenOptions.find((item) => item.id === id)
                        if (!food) return null
                        return (
                          <span key={id} className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 py-1 pl-3 pr-1 text-xs font-medium text-foreground">
                            {food.name}
                            <button
                              type="button"
                              aria-label={`Sửa dị ứng ${food.name}`}
                              onClick={() => { setAllergyEditId(id); setAllergyName(food.name); setAllergyError("") }}
                              className="rounded-full p-1.5 hover:bg-amber-500/15 focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <PencilIcon aria-hidden className="size-3.5" />
                            </button>
                            <button type="button" aria-label={`Xoá dị ứng ${food.name}`} onClick={() => toggleAllergen(id)} className="rounded-full p-1.5 hover:bg-amber-500/15 focus-visible:ring-2 focus-visible:ring-ring">
                              <Trash2Icon aria-hidden className="size-3.5" />
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                  <form onSubmit={saveAllergen} className="flex flex-col gap-2 rounded-2xl bg-muted/45 p-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <label htmlFor="allergy-name" className="mb-1 block text-xs font-medium">
                        {allergyEditId ? "Sửa tên dị ứng" : "Thêm dị ứng khác"}
                      </label>
                      <Input
                        id="allergy-name"
                        value={allergyName}
                        maxLength={80}
                        onChange={(event) => { setAllergyName(event.target.value); setAllergyError("") }}
                        placeholder="Ví dụ: đậu Hà Lan"
                        className="h-10"
                      />
                    </div>
                    <div className="flex gap-2">
                      {allergyEditId && <Button type="button" variant="ghost" size="sm" onClick={resetAllergyEditor}>Huỷ</Button>}
                      <Button type="submit" size="sm" className="min-h-10">
                        {allergyEditId ? "Lưu sửa" : "Thêm"}
                      </Button>
                    </div>
                  </form>
                  <div className="grid max-h-44 gap-1 overflow-y-auto rounded-2xl border border-border p-1.5 sm:grid-cols-2">
                    {visibleAllergens.map((food) => {
                      const selected = draft.allergens.includes(food.id)
                      return (
                        <button
                          key={food.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleAllergen(food.id)}
                          className={cn("flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring", selected && "bg-primary/[0.06] font-medium")}
                        >
                          <span className={cn("grid size-4 shrink-0 place-items-center rounded border", selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40")}>
                            {selected && <CheckIcon aria-hidden className="size-3" />}
                          </span>
                          {food.name}
                        </button>
                      )
                    })}
                    {visibleAllergens.length === 0 && (
                      <p className="col-span-full px-2 py-3 text-sm text-muted-foreground">Không tìm thấy nguyên liệu phù hợp.</p>
                    )}
                  </div>
                  {allergyError && <p role="alert" className="text-sm text-destructive">{allergyError}</p>}
                  <p className="text-xs leading-5 text-muted-foreground">
                    Tick trong danh mục hoặc thêm tên khác, chỉ ghi lại dị ứng bạn đã được xác định.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="border-b border-border/70 px-(--card-spacing) pb-(--card-spacing)">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-rose-500/10 text-rose-700 dark:text-rose-300">
                  <HeartIcon aria-hidden className="size-5" />
                </span>
                <div>
                  <CardTitle>Sở thích nguyên liệu</CardTitle>
                  <CardDescription className="mt-1">Chọn nguyên liệu bạn thích hoặc không thích</CardDescription>
                </div>
              </div>
            </div>
            <div className="space-y-3 px-(--card-spacing)">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sở thích đã chọn</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  shape="pill"
                  aria-expanded={preferenceEditorOpen}
                  onClick={() => preferenceEditorOpen ? resetPreferenceEditor() : setPreferenceEditorOpen(true)}
                >
                  <PlusIcon aria-hidden className="size-4" />
                  Thêm nguyên liệu khác
                </Button>
              </div>
              {preferenceEditorOpen && <form id="preference-editor" onSubmit={savePreference} className="space-y-3 rounded-2xl border border-border bg-muted/35 p-3">
                <div>
                  <label htmlFor="preference-name" className="mb-1 block text-xs font-medium">
                    {preferenceEditId ? "Sửa nguyên liệu" : "Thêm nguyên liệu"}
                  </label>
                  <Input
                    id="preference-name"
                    value={preferenceName}
                    maxLength={80}
                    onChange={(event) => { setPreferenceName(event.target.value); setPreferenceError("") }}
                    placeholder="Nhập tên nguyên liệu"
                    className="h-10"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div role="group" aria-label="Loại sở thích" className="flex gap-1 rounded-full border border-border bg-background p-1">
                    <button type="button" aria-pressed={preferenceKind === "likes"} onClick={() => setPreferenceKind("likes")} className={cn("rounded-full px-3 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring", preferenceKind === "likes" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                      <ThumbsUpIcon aria-hidden className="mr-1 inline size-3.5" />
                      Thích
                    </button>
                    <button type="button" aria-pressed={preferenceKind === "dislikes"} onClick={() => setPreferenceKind("dislikes")} className={cn("rounded-full px-3 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring", preferenceKind === "dislikes" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                      <ThumbsDownIcon aria-hidden className="mr-1 inline size-3.5" />
                      Không thích
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={resetPreferenceEditor}>Huỷ</Button>
                    <Button type="submit" size="sm">{preferenceEditId ? "Lưu sửa" : "Thêm"}</Button>
                  </div>
                </div>
              </form>}
              {preferenceError && <p role="alert" className="text-sm text-destructive">{preferenceError}</p>}
              {(draft.likes.length > 0 || draft.dislikes.length > 0) ? (
                <div className="space-y-2" aria-label="Sở thích đã chọn">
                  {(["likes", "dislikes"] as const).map((kind) => draft[kind].length > 0 && (
                    <div key={kind} className="space-y-1">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        {kind === "likes" ? <ThumbsUpIcon aria-hidden className="size-3.5 text-primary" /> : <ThumbsDownIcon aria-hidden className="size-3.5 text-brand-tomato" />}
                        {kind === "likes" ? "Thích" : "Không thích"}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {draft[kind].map((id) => {
                          const food = preferenceOptions.find((item) => item.id === id)
                          if (!food) return null
                          return (
                            <span key={id} className="inline-flex items-center gap-1 rounded-full border border-border bg-background py-1 pl-3 pr-1 text-xs font-medium">
                              {kind === "likes" ? <ThumbsUpIcon aria-hidden className="size-3 text-primary" /> : <ThumbsDownIcon aria-hidden className="size-3 text-brand-tomato" />}
                              {food.name}
                              <button type="button" aria-label={`Sửa ${food.name}`} onClick={() => { setPreferenceEditId(id); setPreferenceName(food.name); setPreferenceKind(kind); setPreferenceEditorOpen(true); setPreferenceError("") }} className="rounded-full p-1.5 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                                <PencilIcon aria-hidden className="size-3.5" />
                              </button>
                              <button type="button" aria-label={`Xoá ${food.name} khỏi sở thích`} onClick={() => setPreference(id, kind)} className="rounded-full p-1.5 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                                <Trash2Icon aria-hidden className="size-3.5" />
                              </button>
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Chưa chọn nguyên liệu nào.</p>
              )}
              <button
                type="button"
                aria-expanded={preferenceCatalogOpen}
                aria-controls="preference-catalog"
                onClick={() => setPreferenceCatalogOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>Chọn từ danh mục</span>
                <span className="inline-flex shrink-0 items-center gap-2 text-xs font-normal text-muted-foreground">
                  {visiblePreferences.length} nguyên liệu
                  <ChevronDownIcon aria-hidden className={cn("size-4 transition-transform", preferenceCatalogOpen && "rotate-180")} />
                </span>
              </button>
              <ul id="preference-catalog" hidden={!preferenceCatalogOpen} className="max-h-72 space-y-1 overflow-y-auto rounded-2xl border border-border p-1.5">
                {visiblePreferences.map((food) => {
                  return (
                    <li key={food.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted/60">
                      <span className="min-w-0 flex-1 truncate text-sm">{food.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        shape="pill"
                        className="size-9 shrink-0"
                        aria-label={`Thích ${food.name}`}
                        title={`Thích ${food.name}`}
                        onClick={() => setPreference(food.id, "likes")}
                      >
                        <ThumbsUpIcon aria-hidden className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        shape="pill"
                        className="size-9 shrink-0"
                        aria-label={`Không thích ${food.name}`}
                        title={`Không thích ${food.name}`}
                        onClick={() => setPreference(food.id, "dislikes")}
                      >
                        <ThumbsDownIcon aria-hidden className="size-4" />
                      </Button>
                    </li>
                  )
                })}
                {visiblePreferences.length === 0 && (
                  <li className="px-3 py-4 text-sm text-muted-foreground">Tất cả nguyên liệu trong danh mục đã được chọn.</li>
                )}
              </ul>
              {conflictingLikes.length > 0 && (
                <div role="status" className="flex gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-3 text-xs leading-5 text-foreground">
                  <AlertCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
                  <p>
                    {conflictingLikes.map((item) => item.name).join(", ")} thuộc danh sách cần tránh, vì vậy không được ưu tiên trong gợi ý. Chế độ ăn và dị ứng được áp dụng trước sở thích.
                  </p>
                </div>
              )}
              <p className="text-xs leading-5 text-muted-foreground">
                Sở thích chỉ sắp xếp gợi ý, chế độ ăn và dị ứng vẫn quyết định món nào phù hợp.
              </p>
            </div>
          </Card>

          <Card>
            <div className="border-b border-border/70 px-(--card-spacing) pb-(--card-spacing)">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-sky-500/10 text-sky-700 dark:text-sky-300">
                  <ShoppingBasketIcon aria-hidden className="size-5" />
                </span>
                <div>
                  <CardTitle>Nguyên liệu sẵn có</CardTitle>
                  <CardDescription className="mt-1">Quản lý nguyên liệu trong bếp của bạn</CardDescription>
                </div>
              </div>
            </div>
            <div className="space-y-3 px-(--card-spacing)">
              <Button
                type="button"
                variant={pantryEditorOpen ? "secondary" : "outline"}
                size="lg"
                className="h-11 w-full justify-between"
                aria-expanded={pantryEditorOpen}
                onClick={() => setPantryEditorOpen((open) => !open)}
              >
                <span className="inline-flex items-center gap-2">
                  {pantryEditId ? <PencilIcon aria-hidden className="size-4" /> : <PlusIcon aria-hidden className="size-4" />}
                  {pantryEditId ? "Chỉnh sửa nguyên liệu" : "Thêm nguyên liệu"}
                </span>
                <ChevronDownIcon aria-hidden className={cn("size-4 transition-transform", pantryEditorOpen && "rotate-180")} />
              </Button>
              {pantryEditorOpen && <form onSubmit={savePantryItem} className="animate-in fade-in slide-in-from-top-1 space-y-4 rounded-2xl border border-border bg-background p-4 duration-200">
                <div>
                  <label htmlFor="pantry-name" className="mb-1 block text-xs font-medium">Tên nguyên liệu</label>
                  <Input
                    id="pantry-name"
                    value={pantryName}
                    maxLength={80}
                    onChange={(event) => { setPantryName(event.target.value); setPantryError("") }}
                    placeholder="Ví dụ: cà chua"
                    className="h-10"
                  />
                  {pantryName.trim() && pantrySuggestions.length > 0 && (
                    <div className="mt-1 flex max-h-20 flex-wrap gap-1 overflow-y-auto" aria-label="Tên nguyên liệu gợi ý">
                      {pantrySuggestions.slice(0, 5).map((food) => (
                        <button key={food.id} type="button" onClick={() => setPantryName(food.name)} className="rounded-full border border-border bg-background px-2.5 py-1 text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
                          {food.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
                  <div>
                    <label htmlFor="pantry-amount" className="mb-1 block text-xs font-medium">Khối lượng / dung tích</label>
                    <Input
                      id="pantry-amount"
                      type="text"
                      inputMode="decimal"
                      value={pantryAmount}
                      onChange={(event) => { setPantryAmount(event.target.value); setPantryError("") }}
                      placeholder="Ví dụ: 250"
                      className="h-10"
                    />
                  </div>
                  <div>
                    <label htmlFor="pantry-unit" className="mb-1 block text-xs font-medium">Đơn vị</label>
                    <select id="pantry-unit" value={pantryUnit} onChange={(event) => setPantryUnit(event.target.value as PantryUnit)} className="h-10 w-full rounded-xl border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                      <option value="ml">ml</option>
                      <option value="l">l</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/25 p-3 transition-colors hover:border-primary/40 hover:bg-muted/50 focus-within:ring-2 focus-within:ring-ring">
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Chọn ảnh nguyên liệu" onChange={(event) => { void choosePantryImage(event.target.files?.[0]); event.target.value = "" }} />
                    <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-card text-muted-foreground">
                      {pantryImage ? (
                        <Image src={pantryImage} alt={`Ảnh ${pantryName || "nguyên liệu"}`} width={56} height={56} unoptimized className="size-full object-cover" />
                      ) : <ImageIcon aria-hidden className="size-6" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{pantryImage ? "Đổi ảnh nguyên liệu" : "Thêm ảnh nguyên liệu"}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">Tuỳ chọn, JPG, PNG, WebP · Tối đa 5 MB</span>
                    </span>
                  </label>
                  {pantryImage && <Button type="button" variant="ghost" size="sm" onClick={() => setPantryImage(null)}><Trash2Icon aria-hidden className="size-3.5" />Gỡ ảnh</Button>}
                </div>
                {pantryError && <p role="alert" className="text-sm text-destructive">{pantryError}</p>}
                <div className="flex justify-end gap-2 border-t border-border pt-3">
                  <Button type="button" variant="ghost" size="lg" onClick={resetPantryEditor}>Huỷ</Button>
                  <Button type="submit" size="lg">
                    <CheckIcon aria-hidden className="size-4" />
                    {pantryEditId ? "Lưu chỉnh sửa" : "Thêm vào danh sách"}
                  </Button>
                </div>
              </form>}
              {draft.pantry.length > 0 ? (
                <ul className="grid gap-2">
                  {draft.pantry.map((item) => {
                    const normalizedName = normalizeName(item.name).toLocaleLowerCase("vi")
                    const catalogFood = FOOD_CATALOG.find((food) => food.name.toLocaleLowerCase("vi") === normalizedName)
                    const needsAvoiding = excludedNames.has(normalizedName) || Boolean(catalogFood && (
                      excludedIds.has(catalogFood.id) ||
                      (catalogFood.allergyGroup && excludedGroups.has(catalogFood.allergyGroup))
                    ))
                    return (
                      <li key={item.id} className={cn("flex min-w-0 items-center gap-3 rounded-2xl border bg-background p-3 transition-colors", pantryEditId === item.id ? "border-primary/35" : "border-border")}>
                        <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted text-muted-foreground">
                          {item.imageUrl ? (
                            <Image src={item.imageUrl} alt={`Ảnh ${item.name}`} width={56} height={56} unoptimized className="size-full object-cover" />
                          ) : <ImageIcon aria-hidden className="size-5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{item.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground tabular-nums">{item.amount} {item.unit}</p>
                          {needsAvoiding && <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300"><AlertCircleIcon aria-hidden className="size-3.5" />Cần tránh theo hồ sơ</p>}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button type="button" aria-label={`Sửa ${item.name}`} onClick={() => { setPantryEditId(item.id); setPantryName(item.name); setPantryAmount(item.amount); setPantryUnit(item.unit); setPantryImage(item.imageUrl); setPantryEditorOpen(true); setPantryError("") }} className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                            <PencilIcon aria-hidden className="size-4" />
                          </button>
                          <button type="button" aria-label={`Xoá ${item.name} khỏi nguyên liệu sẵn có`} onClick={() => { updateDraft({ pantry: draft.pantry.filter((current) => current.id !== item.id) }); if (pantryEditId === item.id) resetPantryEditor() }} className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                            <Trash2Icon aria-hidden className="size-4" />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : !pantryEditorOpen ? (
                <div className="flex items-center gap-3 rounded-2xl bg-muted/35 p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-card text-muted-foreground">
                    <ShoppingBasketIcon aria-hidden className="size-5" />
                  </span>
                  <p className="text-sm text-muted-foreground">Chưa có nguyên liệu nào</p>
                </div>
              ) : null}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="flex min-h-10 items-center gap-2 text-sm">
            {hasOpenEditor ? (
              <p role="status" className="text-amber-700 dark:text-amber-300">Hoàn tất hoặc huỷ mục đang nhập trước khi lưu.</p>
            ) : saveMessage ? (
              <p role="status" className="text-muted-foreground">{saveMessage}</p>
            ) : isDirty ? (
              <p role="status" className="text-amber-700 dark:text-amber-300">Có thay đổi chưa lưu.</p>
            ) : null}
          </div>
          <div className="flex gap-2 sm:justify-end">
            <Button type="button" variant="outline" disabled={!isDirty && !hasOpenEditor} onClick={discardChanges}>
              Huỷ thay đổi
            </Button>
            <Button type="button" disabled={!userId || !isDirty || hasOpenEditor} onClick={savePreview}>
              Áp dụng
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
