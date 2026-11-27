"use client"

import { useEffect, useRef, useState } from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $insertNodeToNearestRoot } from "@lexical/utils"
import {
  COMMAND_PRIORITY_LOW,
  DROP_COMMAND,
  PASTE_COMMAND,
} from "lexical"

import { toast } from "@/components/ui/toast"
import { useAuth } from "@/features/auth/hooks/use-auth"
import { $createMediaNode } from "@/features/blogs/editor/media-node"
import {
  isAllowedBlogMediaUrl,
  MediaRejectedError,
  mediaKindOf,
  uploadBlogImage,
  uploadBlogVideo,
} from "@/features/blogs/lib/media-upload"

const MARKDOWN_IMAGE_PASTE = /^!\[[^\]]*\]\(\s*<?(https?:\/\/[^\s)>]+)>?[^)]*\)$/
import { ApiError } from "@/features/shared/lib/api-client"

export type MediaProgress = { fileName: string; percent: number | null }

function failureMessage(error: unknown) {
  if (error instanceof MediaRejectedError) return error.message
  if (error instanceof ApiError && error.status === 503) return "Tính năng tải tệp chưa được bật."
  return "Không tải tệp lên được. Thử lại nhé."
}

export function useMediaInsert() {
  const [editor] = useLexicalComposerContext()
  const { accessToken } = useAuth()
  const [progress, setProgress] = useState<MediaProgress | null>(null)

  async function insertFiles(files: File[]) {
    if (!accessToken || progress) return
    for (const file of files) {
      const kind = mediaKindOf(file)
      if (!kind) {
        toast.add({ title: "Chỉ thêm được ảnh (JPEG, PNG, WebP, GIF) hoặc video." })
        continue
      }
      setProgress({ fileName: file.name, percent: kind === "video" ? 0 : null })
      try {
        const url =
          kind === "image"
            ? await uploadBlogImage(accessToken, file)
            : await uploadBlogVideo(accessToken, file, (percent) =>
                setProgress({ fileName: file.name, percent })
              )
        editor.update(() => $insertNodeToNearestRoot($createMediaNode(url)))
      } catch (error) {
        toast.add({ title: failureMessage(error), description: file.name })
      }
    }
    setProgress(null)
  }

  const latest = useRef(insertFiles)
  useEffect(() => {
    latest.current = insertFiles
  })

  useEffect(() => {
    function take(event: Event, files: FileList | null | undefined) {
      const media = [...(files ?? [])].filter((file) => mediaKindOf(file) !== null)
      if (media.length === 0) return false
      event.preventDefault()
      void latest.current(media)
      return true
    }
    const offPaste = editor.registerCommand(
      PASTE_COMMAND,
      (event) => {
        if (!(event instanceof ClipboardEvent)) return false
        if (take(event, event.clipboardData?.files)) return true
        const plain = event.clipboardData?.getData("text/plain")?.trim() ?? ""
        const mdMatch = MARKDOWN_IMAGE_PASTE.exec(plain)
        if (mdMatch?.[1] && !isAllowedBlogMediaUrl(mdMatch[1])) {
          event.preventDefault()
          toast.add({
            title: "Không hỗ trợ chèn link ảnh ngoài.",
            description: "Hãy tải ảnh từ máy hoặc dùng tính năng tạo ảnh AI.",
          })
          return true
        }
        const html = event.clipboardData?.getData("text/html") ?? ""
        if (/<img\b/i.test(html)) {
          toast.add({
            title: "Không hỗ trợ dán ảnh từ link ngoài.",
            description: "Hãy lưu ảnh rồi tải lên hoặc kéo thả tệp ảnh vào bài.",
          })
        }
        return false
      },
      COMMAND_PRIORITY_LOW
    )
    const offDrop = editor.registerCommand(
      DROP_COMMAND,
      (event) => take(event, event.dataTransfer?.files),
      COMMAND_PRIORITY_LOW
    )
    return () => {
      offPaste()
      offDrop()
    }
  }, [editor])

  return { progress, insertFiles }
}
