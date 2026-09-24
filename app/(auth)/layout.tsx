import { SproutIcon } from "lucide-react"

import { Wordmark } from "@/features/shared/components/wordmark"

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col">
        <Wordmark href="/" className="w-fit text-primary-foreground" />
        <div className="mt-auto max-w-md">
          <SproutIcon aria-hidden className="mb-6 size-10 opacity-80" strokeWidth={1.5} />
          <p className="text-3xl leading-tight font-bold tracking-tight text-balance">
            Công thức, video và bài viết về ẩm thực thuần thực vật, từ bếp nhà
            đến đầu bếp chuyên nghiệp.
          </p>
          <p className="mt-4 text-sm opacity-75">Vedora · Sống xanh có ý thức</p>
        </div>
      </aside>

      <main className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <Wordmark href="/" className="mb-10 lg:hidden" />
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  )
}
