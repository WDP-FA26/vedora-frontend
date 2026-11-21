import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Sticky title bar of the page-management screens. */
export function PageHeader({
  title,
  backHref,
  backLabel,
  children,
}: {
  title: string
  backHref?: string
  backLabel?: string
  children?: React.ReactNode
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-card/85 px-2 py-2 backdrop-blur-md">
      {backHref && (
        <Button
          variant="ghost"
          size="icon"
          shape="pill"
          aria-label={backLabel ?? "Quay lại"}
          nativeButton={false}
          render={<Link href={backHref} />}
        >
          <ArrowLeftIcon aria-hidden />
        </Button>
      )}
      <h1 className="flex-1 px-2 text-lg font-bold">{title}</h1>
      {children}
    </header>
  )
}
