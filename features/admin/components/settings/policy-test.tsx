"use client"

import { useState } from "react"
import { FlaskConicalIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import type { ModerationTestResult } from "@/features/admin/schemas"
import { ApiError } from "@/features/shared/lib/api-client"

const DECISION_TEXT: Record<ModerationTestResult["decision"], string> = {
  publish: "Sẽ được đăng",
  review: "Sẽ bị giữ chờ quản trị viên",
  reject: "Sẽ bị chặn",
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`
}

/** Runs one text through the policy being edited, saved or not, and shows every choice's chance. */
export function PolicyTest({
  disabled,
  labelOf,
  run,
}: {
  /** The draft has problems, so there is nothing valid to try. */
  disabled: boolean
  labelOf: (key: string) => string
  run: (text: string) => Promise<ModerationTestResult>
}) {
  const [text, setText] = useState("")
  const [result, setResult] = useState<ModerationTestResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  async function submit() {
    setRunning(true)
    setError(null)
    try {
      setResult(await run(text))
    } catch (failure) {
      setResult(null)
      setError(
        failure instanceof ApiError && failure.status === 400
          ? "Chính sách đang sửa chưa hợp lệ."
          : "Model không trả lời được. Thử lại nhé."
      )
    } finally {
      setRunning(false)
    }
  }

  const scores = Object.entries(result?.scores ?? {}).sort(([, left], [, right]) => right - left)

  return (
    <section aria-labelledby="policy-test-title" className="flex flex-col gap-3">
      <div>
        <h2 id="policy-test-title" className="text-lg font-semibold">
          Chạy thử
        </h2>
        <p className="text-muted-foreground">Dán một đoạn văn để xem model chấm thế nào. Không lưu gì.</p>
      </div>
      <Textarea
        value={text}
        maxLength={5000}
        aria-label="Văn bản cần thử"
        placeholder="Dán một bài viết hoặc bình luận"
        onChange={(event) => setText(event.target.value)}
      />
      <div>
        <Button variant="outline" disabled={disabled || running || text.trim() === ""} onClick={() => void submit()}>
          {running ? <Spinner aria-hidden /> : <FlaskConicalIcon aria-hidden />}
          Chạy thử
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {result && (
        <div className="flex flex-col gap-2" role="status">
          <p>
            <span className="font-semibold">{DECISION_TEXT[result.decision]}</span>
            <span className="text-muted-foreground"> · khả năng vi phạm {percent(result.violationScore)}</span>
          </p>
          <ul className="flex flex-col gap-2">
            {scores.map(([key, score]) => (
              <li key={key} className="flex items-center gap-3">
                <span className="w-40 shrink-0">{labelOf(key)}</span>
                <div
                  role="meter"
                  aria-label={labelOf(key)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(score * 100)}
                  className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                >
                  <div className="h-full rounded-full bg-primary" style={{ width: percent(score) }} />
                </div>
                <span className="w-10 text-right tabular-nums">{percent(score)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
