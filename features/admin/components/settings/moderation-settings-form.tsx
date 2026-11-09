"use client"

import { useEffect, useState } from "react"
import { CircleAlertIcon, Undo2Icon } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { AdvancedSettings } from "@/features/admin/components/settings/advanced-settings"
import { CriteriaList } from "@/features/admin/components/settings/criteria-list"
import { CriterionDialog, type CriterionTarget } from "@/features/admin/components/settings/criterion-dialog"
import { PolicyTest } from "@/features/admin/components/settings/policy-test"
import {
  draftProblems,
  isDirty,
  normalizeDraft,
  policyOf,
} from "@/features/admin/components/settings/policy-validation"
import { StrictnessPicker } from "@/features/admin/components/settings/strictness-picker"
import { useModerationSettings, useModerationSettingsActions } from "@/features/admin/hooks/use-moderation-settings"
import type { ModerationChoice, ModerationPolicyDraft, ModerationSettings } from "@/features/admin/schemas"
import { ApiError } from "@/features/shared/lib/api-client"

/** Where an admin tunes what the automatic content check looks for. */
export function ModerationSettingsPage() {
  const { settings, error, isLoading } = useModerationSettings()

  if (isLoading) {
    return (
      <div className="space-y-3 p-6" aria-hidden>
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }
  if (error || !settings) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden />
          <AlertDescription>
            {error instanceof ApiError && error.status === 403
              ? "Tài khoản của bạn không có quyền xem cài đặt này."
              : "Không tải được cài đặt kiểm duyệt. Thử tải lại trang nhé."}
          </AlertDescription>
        </Alert>
      </div>
    )
  }
  // A new version (after saving or resetting) starts a fresh draft.
  return <SettingsView key={settings.version} settings={settings} />
}

function failureMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 409) {
    return "Có quản trị viên khác vừa lưu cài đặt. Hãy tải lại trang rồi làm lại."
  }
  if (error instanceof ApiError && error.code === "VALIDATION_FAILED") {
    const messages = error.details?.messages
    if (Array.isArray(messages)) return messages.map(String).join(" ")
  }
  return "Không lưu được. Thử lại nhé."
}

function SettingsView({ settings }: { settings: ModerationSettings }) {
  const actions = useModerationSettingsActions()
  const saved = policyOf(settings)
  // Everything on the page edits this one draft; nothing is stored until "Lưu thay đổi".
  const [draft, setDraft] = useState<ModerationPolicyDraft>(saved)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<CriterionTarget | null>(null)

  const dirty = isDirty(draft, saved)
  const problems = draftProblems(draft)

  // Leaving with unsaved changes would lose them silently.
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  function change(changes: Partial<ModerationPolicyDraft>) {
    setDraft((current) => ({ ...current, ...changes }))
  }

  function saveCriterion(choice: ModerationChoice) {
    const exists = draft.choices.some(({ key }) => key === choice.key)
    change({
      choices: exists
        ? draft.choices.map((current) => (current.key === choice.key ? choice : current))
        : [...draft.choices, choice],
    })
    setEditing(null)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await actions.save(normalizeDraft(draft), settings.version)
      toast.add({ title: "Đã lưu thay đổi" })
    } catch (failure) {
      setError(failureMessage(failure))
      setSaving(false)
    }
  }

  async function reset() {
    setSaving(true)
    setError(null)
    try {
      await actions.reset()
      toast.add({ title: "Đã khôi phục mặc định" })
    } catch (failure) {
      setError(failureMessage(failure))
      setSaving(false)
    }
  }

  function labelOf(key: string) {
    if (key === "allow") return "Không vi phạm"
    return draft.choices.find((choice) => choice.key === key)?.label ?? key
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pt-6 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Kiểm duyệt nội dung</h1>
        <p className="text-muted-foreground">
          Model tự chấm bài đăng, blog, video và bình luận theo các tiêu chí dưới đây.
        </p>
      </header>

      <StrictnessPicker value={draft} onChange={(thresholds) => change(thresholds)} />

      <CriteriaList
        choices={draft.choices}
        allowDescription={draft.allowDescription}
        onAdd={() => setEditing("new")}
        onEdit={setEditing}
        onEditAllow={() => setEditing("allow")}
        onRemove={(choice) => change({ choices: draft.choices.filter(({ key }) => key !== choice.key) })}
      />

      <PolicyTest
        disabled={problems.length > 0}
        labelOf={labelOf}
        run={(text) => actions.test(text, normalizeDraft(draft))}
      />

      <AdvancedSettings
        instructions={draft.instructions}
        canReset={!settings.isDefault || dirty}
        busy={saving}
        onChange={(instructions) => change({ instructions })}
        onReset={() => void reset()}
      />

      {editing !== null && (
        <CriterionDialog
          target={editing}
          allowDescription={draft.allowDescription}
          takenKeys={new Set(draft.choices.map(({ key }) => key))}
          onClose={() => setEditing(null)}
          onSubmit={saveCriterion}
          onSubmitAllow={(allowDescription) => {
            change({ allowDescription })
            setEditing(null)
          }}
        />
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        {dirty && problems.length > 0 && (
          <ul role="alert" className="list-disc pl-5 text-sm text-destructive">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{dirty ? "Có thay đổi chưa lưu." : "Không có thay đổi."}</p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={saving || !dirty} onClick={() => setDraft(saved)}>
              <Undo2Icon aria-hidden />
              Hoàn tác
            </Button>
            <Button disabled={saving || !dirty || problems.length > 0} onClick={() => void save()}>
              {saving && <Spinner aria-hidden />}
              Lưu thay đổi
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
