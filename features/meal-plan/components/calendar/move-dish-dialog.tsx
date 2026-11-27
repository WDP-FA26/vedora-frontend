"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { DAY_LABELS, SECTION_LABELS } from "@/features/meal-plan/lib/dates"
import {
  MEAL_SECTIONS,
  WEEKDAYS,
  type MealSection,
  type SlotRef,
  type Weekday,
} from "@/features/meal-plan/schemas/meal-plan.schema"

export type DraggedDish = SlotRef & { recipeId: string }

export function MoveDishDialog({
  moving,
  days,
  onClose,
  onMove,
}: {
  moving: (DraggedDish & { title: string }) | null
  days: Weekday[]
  onClose: () => void
  onMove: (to: SlotRef) => void
}) {
  const [day, setDay] = useState<Weekday | null>(null)
  const [section, setSection] = useState<MealSection | null>(null)
  const targetDay = day ?? (moving && days.includes(moving.day) ? moving.day : days[0]) ?? "MON"
  const targetSection = section ?? moving?.section ?? "LUNCH"

  function close() {
    setDay(null)
    setSection(null)
    onClose()
  }

  return (
    <Dialog open={moving !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chuyển món</DialogTitle>
          <DialogDescription>{moving?.title}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold">
            Ngày
            <NativeSelect
              className="mt-1.5 w-full"
              value={targetDay}
              onChange={(event) => setDay(WEEKDAYS.find((item) => item === event.target.value) ?? null)}
            >
              {days.map((item) => (
                <NativeSelectOption key={item} value={item}>
                  {DAY_LABELS[item]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <label className="text-xs font-semibold">
            Bữa
            <NativeSelect
              className="mt-1.5 w-full"
              value={targetSection}
              onChange={(event) =>
                setSection(MEAL_SECTIONS.find((item) => item === event.target.value) ?? null)
              }
            >
              {MEAL_SECTIONS.map((item) => (
                <NativeSelectOption key={item} value={item}>
                  {SECTION_LABELS[item]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Hủy
          </Button>
          <Button
            onClick={() => {
              onMove({ day: targetDay, section: targetSection })
              close()
            }}
          >
            Chuyển
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
