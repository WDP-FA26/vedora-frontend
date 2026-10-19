"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Controller, useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeftIcon, CircleCheckIcon, ExternalLinkIcon, InfoIcon, Trash2Icon } from "lucide-react"
import { cn } from "cn"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { blogPath, editBlogPath, FIRST_SAVE_PARAM, MY_BLOGS_PATH } from "@/features/blogs/blogs-cache"
import { BlogMarkdown } from "@/features/blogs/components/blog-markdown"
import { BlogStatusBadge } from "@/features/blogs/components/blog-status-badge"
import {
  applyMarkdownFormat,
  markdownShortcut,
  MarkdownToolbar,
} from "@/features/blogs/components/markdown-toolbar"
import { RecipePicker } from "@/features/blogs/components/recipe-picker"
import { useBlogCacheSync } from "@/features/blogs/hooks/use-blogs"
import { useLeaveGuard } from "@/features/blogs/hooks/use-leave-guard"
import { createBlog, deleteBlog, updateBlog } from "@/features/blogs/lib/blogs-api"
import {
  blogFormSchema,
  blogRecipeErrorSchema,
  charCount,
  MAX_BLOG_CONTENT_LENGTH,
  MAX_BLOG_TITLE_LENGTH,
  publishable,
  type ApiBlog,
  type BlogFormValues,
  type BlogInput,
  type BlogStatus,
} from "@/features/blogs/schemas"
import { ApiError } from "@/features/shared/lib/api-client"

/** What the author asked for: each maps to the status the blog should end in. */
type Intent = "draft" | "publish" | "save" | "unpublish"

const LEAVE_MESSAGE = "Bài viết có thay đổi chưa lưu. Bạn muốn rời trang?"

/** The result of the last save, shown above the buttons until the next edit. */
type Notice = { kind: "success" | "info"; text: string }

const FIRST_SAVE_TEXT = "Đã lưu nháp. Chỉ mình bạn thấy bài này."

function toValues(blog: ApiBlog | null): BlogFormValues {
  return {
    title: blog?.blog.title ?? "",
    coverImageUrl: blog?.blog.coverImageUrl ?? "",
    content: blog?.content ?? "",
    recipes: blog?.blog.recipes ?? [],
  }
}

function sameIds(left: { id: string }[], right: { id: string }[]) {
  return left.length === right.length && left.every((item, index) => item.id === right[index].id)
}

/** PATCH sends only what changed; an unchanged blog sends nothing. */
function changes(saved: ApiBlog, values: BlogFormValues, status: BlogStatus): BlogInput {
  const input: BlogInput = {}
  const cover = values.coverImageUrl || null
  if (values.title !== saved.blog.title) input.title = values.title
  if (cover !== saved.blog.coverImageUrl) input.coverImageUrl = cover
  if (values.content !== saved.content) input.content = values.content
  if (!sameIds(values.recipes, saved.blog.recipes)) input.recipeIds = values.recipes.map(({ id }) => id)
  if (status !== saved.status) input.status = status
  return input
}

/**
 * Writes and edits a long blog. A new blog is saved as a draft unless the
 * author publishes it straight away; drafts are visible to their author only.
 */
export function BlogEditor({
  blog: initial,
  justCreated = false,
}: {
  blog: ApiBlog | null
  /** The editor was opened right after this blog's first save. */
  justCreated?: boolean
}) {
  const router = useRouter()
  const { accessToken } = useAuth()
  const sync = useBlogCacheSync()
  const [saved, setSaved] = useState(initial)
  const [busy, setBusy] = useState<Intent | "delete" | null>(null)
  const [notice, setNotice] = useState<Notice | null>(
    justCreated ? { kind: "success", text: FIRST_SAVE_TEXT } : null
  )
  // Counts saves, so the banner animates in again even when its text repeats.
  const [noticeCount, setNoticeCount] = useState(0)
  const [missingIds, setMissingIds] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [coverFailed, setCoverFailed] = useState<string | null>(null)
  const contentRef = useRef<HTMLTextAreaElement | null>(null)

  // Drop `?saved=` so a reload does not announce the save again.
  useEffect(() => {
    if (justCreated && initial) window.history.replaceState(null, "", editBlogPath(initial.id))
  }, [justCreated, initial])

  function announce(kind: Notice["kind"], text: string) {
    setNotice({ kind, text })
    setNoticeCount((count) => count + 1)
  }

  const form = useForm<BlogFormValues>({
    resolver: zodResolver(blogFormSchema),
    defaultValues: toValues(initial),
  })
  const { errors, isDirty } = form.formState
  const [title, coverImageUrl, content] = useWatch({
    control: form.control,
    name: ["title", "coverImageUrl", "content"],
  })

  const titleLength = charCount(title)
  const contentLength = charCount(content)
  const status: BlogStatus = saved?.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"
  const working = busy !== null
  useLeaveGuard(isDirty && busy !== "delete", LEAVE_MESSAGE)

  function failed(error: unknown) {
    if (error instanceof ApiError) {
      if (error.status === 401) {
        // The layout rotates the token pair on the next render.
        router.refresh()
        return "Phiên đăng nhập đã hết hạn. Nội dung vẫn ở đây, hãy thử lại sau giây lát."
      }
      if (error.code === "BLOG_CONTENT_REQUIRED") {
        form.setError("content", { message: "Bài viết cần có nội dung trước khi xuất bản." })
        return null
      }
      if (error.code === "BLOG_RECIPE_NOT_FOUND") {
        const gone = blogRecipeErrorSchema.safeParse(error.body)
        setMissingIds(gone.success ? gone.data.recipeIds : [])
        form.setError("recipes", {
          message: "Có món không còn trong kho công thức. Bỏ món được đánh dấu rồi lưu lại.",
        })
        return null
      }
      if (error.status === 404) return "Bài viết không còn tồn tại hoặc bạn không có quyền sửa."
      // Other 400s: a field the form let through, or a recipe deleted mid-save.
      if (error.status === 400) {
        return "Chưa lưu được vì có dữ liệu không hợp lệ hoặc món vừa bị xoá khỏi kho. Kiểm tra lại rồi lưu lại."
      }
    }
    return "Không lưu được. Nội dung vẫn ở đây, hãy thử lại."
  }

  async function submit(intent: Intent, values: BlogFormValues) {
    if (!accessToken) {
      form.setError("root", { message: "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại." })
      return
    }
    const target: BlogStatus =
      intent === "publish" ? "PUBLISHED" : intent === "save" ? status : "DRAFT"
    if (target === "PUBLISHED" && !publishable(values)) {
      form.setError("content", {
        message:
          status === "PUBLISHED"
            ? "Bài đã xuất bản cần có nội dung. Chuyển về nháp nếu muốn để trống."
            : "Viết nội dung trước khi xuất bản.",
      })
      return
    }

    setBusy(intent)
    setNotice(null)
    setMissingIds([])
    form.clearErrors()
    try {
      let next: ApiBlog
      if (saved) {
        const input = changes(saved, values, target)
        if (Object.keys(input).length === 0) {
          form.reset(values)
          announce("info", "Không có thay đổi nào cần lưu.")
          return
        }
        next = await updateBlog(accessToken, saved.id, input)
      } else {
        next = await createBlog(accessToken, {
          title: values.title,
          coverImageUrl: values.coverImageUrl || undefined,
          content: values.content,
          status: target,
          recipeIds: values.recipes.map(({ id }) => id),
        })
      }
      await sync.saved(next)
      setSaved(next)
      form.reset(toValues(next))

      if (next.status === "PUBLISHED" && intent === "publish") {
        router.push(blogPath(next.id))
        return
      }
      if (!saved) {
        // The edit page mounts a new editor, which shows the notice from the URL.
        router.replace(`${editBlogPath(next.id)}?${FIRST_SAVE_PARAM}=1`)
        return
      }
      announce(
        "success",
        intent === "unpublish"
          ? "Đã chuyển về nháp. Bài không còn hiện trên bảng tin."
          : next.status === "PUBLISHED"
            ? "Đã lưu thay đổi."
            : FIRST_SAVE_TEXT
      )
    } catch (error) {
      const message = failed(error)
      if (message) form.setError("root", { message })
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    if (!accessToken || !saved) return
    setBusy("delete")
    try {
      await deleteBlog(accessToken, saved.id)
      await sync.deleted(saved.id)
      router.replace(MY_BLOGS_PATH)
    } catch (error) {
      setConfirmDelete(false)
      setBusy(null)
      // Already gone is what the author wanted.
      if (error instanceof ApiError && error.status === 404) {
        await sync.deleted(saved.id)
        router.replace(MY_BLOGS_PATH)
        return
      }
      form.setError("root", {
        message:
          error instanceof ApiError && error.status === 401
            ? "Phiên đăng nhập đã hết hạn. Hãy thử xoá lại sau giây lát."
            : "Không xoá được bài viết. Thử lại nhé.",
      })
      if (error instanceof ApiError && error.status === 401) router.refresh()
    }
  }

  const run = (intent: Intent) => form.handleSubmit((values) => submit(intent, values))

  return (
    <section aria-labelledby="blog-editor-title" className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-card/85 px-2 py-2 backdrop-blur-md">
        <Button
          variant="ghost"
          size="icon"
          shape="pill"
          aria-label="Về danh sách blog của tôi"
          nativeButton={false}
          render={<Link href={MY_BLOGS_PATH} />}
        >
          <ArrowLeftIcon aria-hidden />
        </Button>
        <h1 id="blog-editor-title" className="min-w-0 flex-1 truncate text-lg font-bold">
          {saved ? "Sửa blog" : "Viết blog"}
        </h1>
        {saved && <BlogStatusBadge status={saved.status} />}
        {saved?.status === "PUBLISHED" && (
          <Button
            variant="ghost"
            size="icon"
            shape="pill"
            aria-label="Mở bài đã xuất bản"
            nativeButton={false}
            render={<Link href={blogPath(saved.id)} />}
          >
            <ExternalLinkIcon aria-hidden />
          </Button>
        )}
      </header>

      <form
        noValidate
        onSubmit={run(status === "PUBLISHED" ? "save" : "draft")}
        className="flex flex-1 flex-col gap-6 px-4 py-5 sm:px-5"
      >
        <Controller
          name="title"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="blog-title">Tiêu đề</FieldLabel>
              <Input
                {...field}
                id="blog-title"
                aria-invalid={fieldState.invalid}
                // In UTF-16 units: room for a full title even in emoji, the counter shows the real limit.
                maxLength={MAX_BLOG_TITLE_LENGTH * 2}
                placeholder="Ví dụ: Đậu hũ sốt cà cho bữa tối"
                disabled={working}
                className="h-11"
              />
              <div className="flex justify-between gap-2">
                <FieldError errors={[fieldState.error]} />
                <span
                  className={cn(
                    "ml-auto text-xs text-muted-foreground tabular-nums",
                    titleLength > MAX_BLOG_TITLE_LENGTH && "text-destructive"
                  )}
                >
                  {titleLength}/{MAX_BLOG_TITLE_LENGTH}
                </span>
              </div>
            </Field>
          )}
        />

        <Controller
          name="coverImageUrl"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="blog-cover">Ảnh bìa (không bắt buộc)</FieldLabel>
              <Input
                {...field}
                id="blog-cover"
                type="url"
                inputMode="url"
                aria-invalid={fieldState.invalid}
                placeholder="https://…"
                disabled={working}
              />
              <FieldDescription>
                Dán liên kết HTTPS tới một ảnh đã có trên mạng. Vedora không tải ảnh lên hộ bạn.
              </FieldDescription>
              <FieldError errors={[fieldState.error]} />
              {coverImageUrl && !fieldState.invalid && coverImageUrl.startsWith("https://") && (
                coverFailed === coverImageUrl ? (
                  <p className="text-sm text-muted-foreground">Không xem trước được ảnh từ liên kết này.</p>
                ) : (
                  // Hot-linked from another site, so the Next image optimizer is not used.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverImageUrl}
                    alt="Xem trước ảnh bìa"
                    onError={() => setCoverFailed(coverImageUrl)}
                    className="mt-1 aspect-[1.91/1] w-full rounded-2xl border border-border object-cover"
                  />
                )
              )}
            </Field>
          )}
        />

        <Controller
          name="content"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="blog-content">Nội dung</FieldLabel>
              <Tabs defaultValue="write">
                <TabsList aria-label="Chế độ soạn thảo">
                  <TabsTrigger value="write">Viết</TabsTrigger>
                  <TabsTrigger value="preview">Xem trước</TabsTrigger>
                </TabsList>
                <TabsContent value="write">
                  <MarkdownToolbar textareaRef={contentRef} controls="blog-content" disabled={working} />
                  <textarea
                    {...field}
                    ref={(element) => {
                      field.ref(element)
                      contentRef.current = element
                    }}
                    onKeyDown={(event) => {
                      const format = markdownShortcut(event)
                      if (!format) return
                      event.preventDefault()
                      applyMarkdownFormat(event.currentTarget, format)
                    }}
                    id="blog-content"
                    aria-invalid={fieldState.invalid}
                    aria-describedby="blog-content-help"
                    disabled={working}
                    rows={16}
                    placeholder={"## Chuẩn bị\nChọn đậu hũ và cà chua…"}
                    className="field-sizing-content block min-h-80 w-full resize-y rounded-2xl border border-input bg-transparent px-3 py-2.5 font-mono text-sm leading-relaxed outline-none placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive"
                  />
                </TabsContent>
                <TabsContent value="preview">
                  <div className="min-h-80 rounded-2xl border border-border px-4 py-3">
                    {content.trim() ? (
                      <BlogMarkdown content={content} />
                    ) : (
                      <p className="text-sm text-muted-foreground">Chưa có nội dung để xem trước.</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
              <div className="flex justify-between gap-2">
                <FieldDescription id="blog-content-help">
                  Bôi đen chữ rồi bấm các nút phía trên để định dạng (hoặc gõ Markdown nếu đã quen).
                  Bấm Xem trước để xem bài sẽ hiển thị thế nào.
                </FieldDescription>
                <span
                  className={cn(
                    "shrink-0 text-xs text-muted-foreground tabular-nums",
                    contentLength > MAX_BLOG_CONTENT_LENGTH && "text-destructive"
                  )}
                >
                  {contentLength.toLocaleString("vi")}/{MAX_BLOG_CONTENT_LENGTH.toLocaleString("vi")}
                </span>
              </div>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          name="recipes"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel>Món liên quan (tối đa 10)</FieldLabel>
              <FieldDescription>
                Không bắt buộc. Gắn công thức có sẵn để người đọc xem nguyên liệu, cách nấu và thêm
                món vào thực đơn tuần chỉ với một lần bấm.
              </FieldDescription>
              <RecipePicker
                value={field.value}
                onChange={(recipes) => {
                  field.onChange(recipes)
                  form.clearErrors("recipes")
                }}
                missingIds={missingIds}
                disabled={working}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <div className="sticky bottom-0 mt-auto -mx-4 flex flex-col gap-3 border-t border-border bg-card px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:-mx-5 sm:px-5">
          {errors.root && <FieldError role="alert" errors={[errors.root]} />}
          {notice && !isDirty && <SaveNotice key={noticeCount} notice={notice} />}
          <div className="flex flex-wrap items-center gap-2">
            {saved && (
              <Button
                type="button"
                variant="destructive"
                disabled={working}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2Icon aria-hidden /> Xoá
              </Button>
            )}
            <div className="ml-auto flex flex-wrap gap-2">
              {status === "PUBLISHED" ? (
                <>
                  <Button type="button" variant="outline" disabled={working} onClick={run("unpublish")}>
                    {busy === "unpublish" && <Spinner aria-hidden />}
                    Chuyển về nháp
                  </Button>
                  <Button type="submit" disabled={working}>
                    {busy === "save" && <Spinner aria-hidden />}
                    Lưu thay đổi
                  </Button>
                </>
              ) : (
                <>
                  <Button type="submit" variant="outline" disabled={working}>
                    {busy === "draft" && <Spinner aria-hidden />}
                    Lưu nháp
                  </Button>
                  <Button type="button" disabled={working} onClick={run("publish")}>
                    {busy === "publish" && <Spinner aria-hidden />}
                    Xuất bản
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </form>

      <AlertDialog open={confirmDelete} onOpenChange={(open) => busy !== "delete" && setConfirmDelete(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá bài viết này?</AlertDialogTitle>
            <AlertDialogDescription>
              Bài viết cùng bình luận, lượt thả mầm và lượt lưu sẽ bị xoá vĩnh viễn. Các món trong kho
              công thức vẫn giữ nguyên.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "delete"}>Giữ lại</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy === "delete"}
              onClick={(event) => {
                event.preventDefault()
                void remove()
              }}
            >
              {busy === "delete" && <Spinner aria-hidden />}
              Xoá bài viết
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

function SaveNotice({ notice }: { notice: Notice }) {
  const success = notice.kind === "success"
  const Icon = success ? CircleCheckIcon : InfoIcon
  return (
    <p
      role="status"
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold",
        "animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out motion-reduce:animate-none",
        success
          ? "border-primary/25 bg-primary/10 text-primary"
          : "border-border bg-muted text-foreground"
      )}
    >
      <Icon aria-hidden className="size-[1.125rem] shrink-0" />
      {notice.text}
    </p>
  )
}
