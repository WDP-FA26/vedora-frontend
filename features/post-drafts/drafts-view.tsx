"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileVideoIcon, Trash2Icon } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Composer } from "@/features/shared/components/composer"
import { usePostDraftManager } from "./provider"
import { EMPTY } from "./manager"
import { POST_DRAFTS_PATH, postDraftPath } from "./schemas"

const subscribeEmpty = () => () => undefined
const getEmpty = () => EMPTY

function useDraftState() {
  const manager = usePostDraftManager()
  const state = useSyncExternalStore(
    manager?.subscribe ?? subscribeEmpty,
    manager?.getSnapshot ?? getEmpty,
    getEmpty
  )
  useEffect(() => {
    void manager?.refreshRemote()
  }, [manager])
  return { manager, state }
}

export function PostDraftsView() {
  const { manager, state } = useDraftState()
  const [confirm, setConfirm] = useState<string | null>(null)
  const drafts = state.drafts
    .filter(
      (draft) =>
        !draft.deleted && (draft.version !== null || draft.files.length > 0 || Boolean(draft.body))
    )
    .sort((a, b) => b.updatedAt - a.updatedAt)
  return (
    <section className="p-4 sm:p-6">
      <h1 className="text-xl font-bold">Bản nháp</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Video chưa được công khai. Mở nháp và bấm Đăng khi bạn đã sẵn sàng.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        File đang tải dở được giữ trên thiết bị này và tự tải lại khi bạn mở Vedora. Khi đóng tab,
        quá trình truyền file tạm dừng.
      </p>
      {state.storageError && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {state.storageError}
        </p>
      )}
      {!state.loaded ? (
        <Spinner className="mt-6" aria-label="Đang tải nháp" />
      ) : !drafts.length ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Chưa có bản nháp. Bạn có thể chọn video từ Tạo nội dung.
        </p>
      ) : (
        <ul aria-label="Danh sách bản nháp" className="mt-5 space-y-3">
          {drafts.map((draft) => (
            <li key={draft.id} className="rounded-2xl border border-border p-4">
              <Link
                href={postDraftPath(draft.id)}
                className="flex min-w-0 gap-3 hover:text-primary"
              >
                <FileVideoIcon className="mt-1 size-5 shrink-0" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {draft.title || draft.body.slice(0, 80) || "Video chưa đặt tiêu đề"}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {draft.files.length} video ·{" "}
                    {draft.files.some(
                      (file) => file.state === "uploading" || file.state === "queued"
                    )
                      ? "Đang tải vào nháp"
                      : "Chưa đăng"}
                  </span>
                </span>
              </Link>
              {draft.error && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {draft.error}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                  href={postDraftPath(draft.id)}
                >
                  Mở nháp
                </Link>
                {draft.error && (
                  <Button size="sm" variant="outline" onClick={() => manager?.retry(draft.id)}>
                    Thử đồng bộ lại
                  </Button>
                )}
                {confirm === draft.id ? (
                  <>
                    <span className="self-center text-xs">Xóa nháp và file đã lưu?</span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        void manager?.remove(draft.id).catch(() => undefined)
                        setConfirm(null)
                      }}
                    >
                      Xác nhận xóa
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                      Giữ lại
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Xóa nháp ${draft.title || "chưa đặt tên"}`}
                    disabled={draft.publishing}
                    onClick={() => setConfirm(draft.id)}
                  >
                    <Trash2Icon className="size-4" aria-hidden />
                    Xóa nháp
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function PostDraftEditor({ id }: { id: string }) {
  const { manager, state } = useDraftState()
  const router = useRouter()
  const draft = state.drafts.find((item) => item.id === id && !item.deleted)
  if (!state.loaded)
    return (
      <div className="p-6">
        <Spinner aria-label="Đang mở nháp" />
      </div>
    )
  if (!draft)
    return (
      <div className="p-6">
        <p>Nháp chưa có trên thiết bị hoặc không còn khả dụng. Hãy mở lại danh sách nháp.</p>
        <Link className="mt-3 block text-primary" href={POST_DRAFTS_PATH}>
          Về bản nháp
        </Link>
      </div>
    )
  return (
    <section className="flex min-h-[calc(100dvh-8rem)] flex-col pb-24 sm:pb-0">
      <header className="border-b border-border p-4">
        <Link href={POST_DRAFTS_PATH} className="text-sm text-primary hover:underline">
          ← Về bản nháp
        </Link>
        <h1 className="mt-2 text-lg font-bold">Chỉnh sửa bản nháp</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Đóng hoặc chuyển trang vẫn giữ nháp. Chỉ công khai sau khi bạn bấm Đăng và kiểm duyệt hoàn
          tất.
        </p>
      </header>
      {draft.conflict && (
        <div className="p-4">
          <p role="alert" className="text-sm text-destructive">
            {draft.error}
          </p>
          <Button
            className="mt-2"
            variant="outline"
            onClick={() => void manager?.reload(id).catch(() => undefined)}
          >
            Dùng bản trên máy chủ
          </Button>
        </div>
      )}
      <Composer
        key={id}
        draftId={id}
        mode={draft.kind === "VIDEO" ? "video" : "post"}
        onPosted={() => router.push(POST_DRAFTS_PATH)}
      />
    </section>
  )
}
