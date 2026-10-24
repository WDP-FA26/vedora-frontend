"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { EditorState } from "lexical"

import { useAuth } from "@/features/auth/hooks/use-auth"
import { editBlogPath } from "@/features/blogs/blogs-cache"
import { createBlog, updateBlog, type BlogInput } from "@/features/blogs/lib/blogs-api"
import { isVideoUrl } from "@/features/blogs/editor/media-node"
import { markdownOf } from "@/features/blogs/editor/markdown"
import { MAX_BLOG_CONTENT_LENGTH, type ApiBlog, type BlogStatus } from "@/features/blogs/schemas"
import { ApiError } from "@/features/shared/lib/api-client"

const AUTOSAVE_DELAY_MS = 2500
const MAX_COVER_URL_LENGTH = 2048

export type SaveState = "idle" | "saving" | "saved" | "error"

/** The first image of the post as its cover; the API only accepts HTTPS links. */
function coverOf(markdown: string) {
  for (const [, url] of markdown.matchAll(/^!\[[^\]]*\]\((https:\/\/[^\s)]+)\)\s*$/gm)) {
    if (!isVideoUrl(url) && url.length <= MAX_COVER_URL_LENGTH) return url
  }
  return null
}

function failureMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "BLOG_CONTENT_REQUIRED") return "Hãy viết nội dung trước khi đăng."
    if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Thử lại sau giây lát."
    if (error.status === 404) return "Không tìm thấy bài viết này."
  }
  return "Không lưu được. Thử lại nhé."
}

/**
 * The blog being written: the first save creates it as a draft, later ones
 * update it. Edits are saved a moment after the author stops typing, once
 * there is a title. The document is only turned into Markdown when saving, so
 * typing costs nothing here. Saves never overlap, and one that finishes while
 * the author kept typing leaves the draft marked as unsaved.
 */
export function useBlogDraft(initial: ApiBlog | null) {
  const { accessToken } = useAuth()
  const router = useRouter()
  const [title, setTitleState] = useState(initial?.blog.title ?? "")
  const [status, setStatus] = useState<BlogStatus>(initial?.status ?? "DRAFT")
  const [saveState, setSaveState] = useState<SaveState>(initial ? "saved" : "idle")
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const id = useRef(initial?.id ?? null)
  const titleRef = useRef(title)
  const editorState = useRef<EditorState | null>(null)
  const revision = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inflight = useRef<Promise<unknown> | null>(null)

  /** Something changed: mark the draft unsaved and restart the autosave countdown. */
  function touch() {
    revision.current += 1
    setDirty(true)
    setSaveState((state) => (state === "saved" || state === "error" ? "idle" : state))
    if (timer.current) clearTimeout(timer.current)
    timer.current = titleRef.current.trim()
      ? setTimeout(() => void latestSave.current(), AUTOSAVE_DELAY_MS)
      : null
  }

  function setTitle(value: string) {
    titleRef.current = value
    setTitleState(value)
    touch()
  }

  /** The editor's latest state; it is exported to Markdown when the draft is saved. */
  function setDocument(state: EditorState) {
    editorState.current = state
    touch()
  }

  /** Saves the draft; resolves to whether the API has it now. */
  async function save(extra: BlogInput = {}): Promise<boolean> {
    if (timer.current) clearTimeout(timer.current)
    const trimmed = titleRef.current.trim()
    if (!trimmed) {
      setSaveState("error")
      setError("Nhập tiêu đề trước khi lưu.")
      return false
    }
    if (!accessToken) {
      setSaveState("error")
      setError("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.")
      return false
    }
    while (inflight.current) await inflight.current.catch(() => {})

    const content = editorState.current ? markdownOf(editorState.current) : (initial?.content ?? "")
    if (content.length > MAX_BLOG_CONTENT_LENGTH) {
      setSaveState("error")
      setError(`Bài viết quá dài (tối đa ${MAX_BLOG_CONTENT_LENGTH.toLocaleString("vi")} ký tự).`)
      return false
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
        // Same page, now addressable; a router navigation would remount the editor.
        window.history.replaceState(null, "", editBlogPath(blog.id))
      }
      setStatus(blog.status)
      const unchanged = revision.current === savedRevision
      setSaveState(unchanged ? "saved" : "idle")
      if (unchanged) setDirty(false)
      return true
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) router.refresh()
      setSaveState("error")
      setError(failureMessage(err))
      return false
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
    /** Saves, then makes the blog public. */
    publish: () => save({ status: "PUBLISHED" }),
    /** Takes a public blog back to a draft. */
    unpublish: () => save({ status: "DRAFT" }),
    save: () => save(),
    /** The blog's id once the first save created it. */
    blogId: () => id.current,
  }
}
