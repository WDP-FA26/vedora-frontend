"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useSWRConfig } from "swr"
import type { EditorState } from "lexical"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { MY_BLOG_DRAFTS_KEY, MY_BLOGS_KEY, newBlogDraftPath } from "@/features/blogs/blogs-cache"
import { createBlog, updateBlog, type BlogInput } from "@/features/blogs/lib/blogs-api"
import { isVideoUrl } from "@/features/blogs/editor/media-node"
import { markdownOf } from "@/features/blogs/editor/markdown"
import { isSystemBlogImageUrl } from "@/features/blogs/lib/media-upload"
import { MAX_BLOG_CONTENT_LENGTH, type ApiBlog, type BlogStatus } from "@/features/blogs/schemas"
import { ApiError } from "@/features/shared/lib/api-client"

const AUTOSAVE_DELAY_MS = 2500
const MAX_COVER_URL_LENGTH = 2048

export type SaveState = "idle" | "saving" | "saved" | "error"

function coverOf(markdown: string) {
  for (const [, url] of markdown.matchAll(/^!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)\s*$/gm)) {
    if (isSystemBlogImageUrl(url) && !isVideoUrl(url) && url.length <= MAX_COVER_URL_LENGTH) {
      return url
    }
  }
  return null
}

function failureMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "BLOG_CONTENT_REQUIRED") return "Hãy viết nội dung trước khi đăng."
    if (error.code === "BLOG_COVER_NOT_ALLOWED" || error.code === "BLOG_MEDIA_NOT_ALLOWED") {
      return "Chỉ dùng được ảnh hoặc video đã tải lên hệ thống."
    }
    if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Thử lại sau giây lát."
    if (error.status === 404) return "Không tìm thấy bài viết này."
  }
  return "Không lưu được. Thử lại nhé."
}

export function useBlogDraft(initial: ApiBlog | null) {
  const { accessToken } = useAuth()
  const { mutate } = useSWRConfig()
  const router = useRouter()
  const [title, setTitleState] = useState(initial?.blog.title ?? "")
  const [status, setStatus] = useState<BlogStatus>(initial?.status ?? "DRAFT")
  const [saveState, setSaveState] = useState<SaveState>(initial ? "saved" : "idle")
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const id = useRef(initial?.id ?? null)
  const statusRef = useRef<BlogStatus>(initial?.status ?? "DRAFT")
  const titleRef = useRef(title)
  const editorState = useRef<EditorState | null>(null)
  const revision = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inflight = useRef<Promise<unknown> | null>(null)

  const locked = Boolean(initial?.appeal?.activeTicket) || status === "REMOVED"

  function touch() {
    if (locked) return
    revision.current += 1
    setDirty(true)
    setSaveState((state) => (state === "saved" || state === "error" ? "idle" : state))
    if (timer.current) clearTimeout(timer.current)
    const autosave = statusRef.current === "DRAFT" || statusRef.current === "REJECTED"
    timer.current = titleRef.current.trim() && autosave
      ? setTimeout(() => void latestSave.current(), AUTOSAVE_DELAY_MS)
      : null
  }

  function setTitle(value: string) {
    titleRef.current = value
    setTitleState(value)
    touch()
  }

  function setDocument(state: EditorState) {
    editorState.current = state
    touch()
  }

  async function save(extra: BlogInput = {}): Promise<BlogStatus | null> {
    if (locked) {
      setSaveState("error")
      setError("Blog đang khóa chỉnh sửa vì đang kháng cáo hoặc đã bị gỡ.")
      return null
    }
    if (timer.current) clearTimeout(timer.current)
    const trimmed = titleRef.current.trim()
    if (!trimmed) {
      setSaveState("error")
      setError("Nhập tiêu đề trước khi lưu.")
      return null
    }
    if (!accessToken) {
      setSaveState("error")
      setError("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.")
      return null
    }
    while (inflight.current) await inflight.current.catch(() => {})

    const content = editorState.current ? markdownOf(editorState.current) : (initial?.content ?? "")
    if (content.length > MAX_BLOG_CONTENT_LENGTH) {
      setSaveState("error")
      setError(`Bài viết quá dài (tối đa ${MAX_BLOG_CONTENT_LENGTH.toLocaleString("vi")} ký tự).`)
      return null
    }

    const savedRevision = revision.current
    setSaveState("saving")
    setError(null)
    const input: BlogInput = { title: trimmed, content, coverImageUrl: coverOf(content), ...extra }
    const request = id.current
      ? updateBlog(accessToken, id.current, input)
      : createBlog(accessToken, input)
    inflight.current = request
    try {
      const blog = await request
      if (!id.current) {
        id.current = blog.id
        window.history.replaceState(null, "", newBlogDraftPath(blog.id))
      }
      statusRef.current = blog.status
      setStatus(blog.status)
      void mutate([MY_BLOGS_KEY, accessToken])
      void mutate([MY_BLOG_DRAFTS_KEY, accessToken])
      const unchanged = revision.current === savedRevision
      if (blog.status === "PROCESSING") {
        setSaveState(unchanged ? "saved" : "idle")
        if (unchanged) setDirty(false)
        setError("Đã lưu. Blog đang được kiểm duyệt, chỉ bạn thấy cho đến khi xong. Bạn sẽ nhận thông báo khi có kết quả.")
        return blog.status
      }
      if (blog.status === "PENDING_REVIEW") {
        setSaveState("error")
        setError("Bài viết đang chờ quản trị viên xem xét và sẽ được đăng nếu được duyệt.")
        return null
      }
      if (blog.status === "REJECTED") {
        setSaveState("error")
        setError("Bài viết vi phạm tiêu chuẩn cộng đồng nên chưa được đăng. Hãy chỉnh sửa rồi thử lại.")
        return null
      }
      setSaveState(unchanged ? "saved" : "idle")
      if (unchanged) setDirty(false)
      return blog.status
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.refresh()
      setSaveState("error")
      setError(failureMessage(err))
      return null
    } finally {
      inflight.current = null
    }
  }

  const latestSave = useRef(save)
  useEffect(() => {
    latestSave.current = save
  })
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  return {
    title,
    setTitle,
    setDocument,
    status,
    saveState,
    error,
    publish: () => save({ status: "PUBLISHED" }),
    unpublish: () => save({ status: "DRAFT" }),
    save: () => save(),
    blogId: () => id.current,
  }
}
