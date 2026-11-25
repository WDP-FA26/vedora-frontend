"use client"

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { FileVideoIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useUpsertFeedPost } from "@/features/posts/hooks/use-feed-posts"
import { PostDraftManager } from "./manager"
import { POST_DRAFTS_PATH } from "./schemas"

type Context = {
  manager: PostDraftManager | null
  connect: (userId: string | undefined, token: string | undefined) => void
  disconnect: () => void
}
const DraftContext = createContext<Context | null>(null)

export function PostDraftProvider({ children }: { children: React.ReactNode }) {
  const current = useRef<PostDraftManager | null>(null)
  const [manager, setManager] = useState<PostDraftManager | null>(null)
  const disconnect = useCallback(() => {
    current.current?.stop()
    current.current = null
    setManager(null)
  }, [])
  const connect = useCallback(
    (userId: string | undefined, token: string | undefined) => {
      if (!userId || !token) {
        disconnect()
        return
      }
      if (current.current?.ownerId === userId) {
        current.current.setToken(token)
        return
      }
      current.current?.stop()
      const next = new PostDraftManager(userId)
      current.current = next
      setManager(next)
      void next.start(token)
    },
    [disconnect]
  )
  useEffect(
    () => () => {
      current.current?.stop()
      current.current = null
    },
    []
  )
  const value = useMemo(() => ({ manager, connect, disconnect }), [manager, connect, disconnect])
  return (
    <DraftContext value={value}>
      {children}
      {manager && <DraftStatus manager={manager} />}
    </DraftContext>
  )
}

export function PostDraftSession({
  userId,
  token,
  updateFeed = true,
}: {
  userId: string | undefined
  token: string | undefined
  updateFeed?: boolean
}) {
  const context = use(DraftContext)
  const connect = context?.connect
  useEffect(() => {
    connect?.(userId, token)
  }, [connect, userId, token])
  return updateFeed && context?.manager ? <PublishedDraftFeed manager={context.manager} /> : null
}

function PublishedDraftFeed({ manager }: { manager: PostDraftManager }) {
  const state = useSyncExternalStore(
    manager.subscribe,
    manager.getSnapshot,
    manager.getServerSnapshot
  )
  const upsert = useUpsertFeedPost()
  const callback = useRef(upsert)
  useEffect(() => {
    callback.current = upsert
  })
  useEffect(() => {
    if (state.published?.status === "PUBLISHED")
      void callback.current(state.published).catch(() => undefined)
  }, [state.published])
  return null
}

export function usePostDraftManager() {
  return use(DraftContext)?.manager ?? null
}
export function useDisconnectPostDrafts() {
  return use(DraftContext)?.disconnect
}

function DraftStatus({ manager }: { manager: PostDraftManager }) {
  const pathname = usePathname()
  const state = useSyncExternalStore(
    manager.subscribe,
    manager.getSnapshot,
    manager.getServerSnapshot
  )
  useEffect(() => {
    if (!state.saving) return
    const saving = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", saving)
    return () => window.removeEventListener("beforeunload", saving)
  }, [state.saving])
  useEffect(() => {
    const retry = () => {
      void manager.refreshRemote()
      for (const draft of manager.getSnapshot().drafts) manager.retry(draft.id)
    }
    window.addEventListener("online", retry)
    return () => window.removeEventListener("online", retry)
  }, [manager])
  const drafts = state.drafts.filter(
    (draft) =>
      !draft.deleted &&
      (draft.files.length > 0 ||
        draft.version !== null ||
        (draft.kind === "VIDEO" && Boolean(draft.body)))
  )
  if (
    (!drafts.length || pathname.startsWith(POST_DRAFTS_PATH)) &&
    !state.storageError &&
    !state.notice
  )
    return null
  const uploading = drafts
    .flatMap((draft) => draft.files)
    .find((file) => file.state === "uploading")
  const message =
    state.storageError ??
    state.notice ??
    // Text saves finish in milliseconds; flagging them made the box flicker while typing.
    (state.savingFiles
      ? "Đang lưu nháp và tệp trên thiết bị…"
      : uploading
        ? `Đang tải video ${Math.round(state.progress[uploading.key] ?? 0)}% — bài vẫn ở nháp.`
        : `${drafts.length} bản nháp được giữ để bạn xem lại và đăng.`)
  return (
    <aside
      aria-label="Trạng thái bản nháp"
      className="fixed right-3 bottom-20 z-40 flex max-w-[calc(100vw-1.5rem)] items-start gap-3 rounded-2xl border border-border bg-popover px-4 py-3 text-sm shadow-lg sm:right-5 sm:bottom-5 sm:max-w-sm"
    >
      <FileVideoIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0">
        <p role={state.storageError ? "alert" : "status"}>{message}</p>
        <Link
          href={POST_DRAFTS_PATH}
          className="mt-1 inline-block font-medium text-primary hover:underline"
        >
          Xem bản nháp
        </Link>
      </div>
      {state.notice && (
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Đóng thông báo bản nháp"
          onClick={manager.dismissNotice}
        >
          <XIcon aria-hidden />
        </Button>
      )}
    </aside>
  )
}
