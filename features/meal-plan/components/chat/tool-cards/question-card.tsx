"use client"

import { useState } from "react"
import { CheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { UserQuestion } from "@/features/meal-plan/lib/chat-message-parsers"

export function QuestionCard({
  question,
  open,
  disabled,
  onAnswer,
}: {
  question: UserQuestion
  open: boolean
  disabled: boolean
  onAnswer: (answer: string) => void
}) {
  const [picked, setPicked] = useState<string[]>([])
  const answered = question.answer !== undefined
  const canAnswer = open && !answered && !disabled

  function toggle(option: string) {
    setPicked((current) =>
      current.includes(option) ? current.filter((item) => item !== option) : [...current, option]
    )
  }

  function isChosen(option: string) {
    if (question.answer === undefined) return picked.includes(option)
    if (!question.multiple) return question.answer === option
    return question.answer.split(", ").includes(option)
  }

  return (
    <section
      aria-label="Câu hỏi của trợ lý"
      className="mt-2 flex w-full flex-col gap-2 rounded-xl border border-border bg-card p-3"
    >
      <p className="text-sm font-semibold">{question.question}</p>
      <div className="flex flex-wrap gap-2">
        {question.options.map((option) => (
          <Button
            key={option}
            size="sm"
            variant={isChosen(option) ? "default" : "outline"}
            disabled={!canAnswer}
            aria-pressed={question.multiple ? isChosen(option) : undefined}
            onClick={() => (question.multiple ? toggle(option) : onAnswer(option))}
            className="h-auto min-h-8 max-w-full whitespace-normal text-left"
          >
            <span className="min-w-0 py-1.5 break-words">{option}</span>
          </Button>
        ))}
      </div>
      {question.multiple && canAnswer && (
        <Button
          size="sm"
          className="self-start"
          disabled={picked.length === 0}
          onClick={() => onAnswer(picked.join(", "))}
        >
          <CheckIcon aria-hidden /> Gửi lựa chọn
        </Button>
      )}
      {canAnswer && (
        <p className="text-xs text-muted-foreground">Hoặc nhập câu trả lời khác ở ô bên dưới.</p>
      )}
    </section>
  )
}
