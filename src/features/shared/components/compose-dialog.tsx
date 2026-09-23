"use client"

import { useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Composer } from "./composer"

/** Wraps any trigger element so it opens the composer in a dialog. */
export function ComposeDialog({ trigger }: { trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="top-[12%] translate-y-0 sm:max-w-[36rem]">
        <DialogTitle className="sr-only">Bài viết mới</DialogTitle>
        <Composer
          autoFocus
          onPosted={() => setOpen(false)}
          className="border-b-0 px-0 pt-8 pb-0 sm:px-0"
        />
      </DialogContent>
    </Dialog>
  )
}
