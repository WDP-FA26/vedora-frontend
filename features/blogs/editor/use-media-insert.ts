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
  MediaRejectedError,
  mediaKindOf,
  uploadBlogImage,
  uploadBlogVideo,
} from "@/features/blogs/lib/media-upload"
import { ApiError } from "@/features/shared/lib/api-client"

export type MediaProgress = { fileName: string; percent: number | null }

function failureMessage(error: unknown) {
  if (error instanceof MediaRejectedError) return error.message
  if (error instanceof ApiError && error.status === 503) return "Tính năng tải tệp chưa được bật."
  return "Không tải tệp lên được. Thử lại nhé."
}

/**
 * Uploads images (RustFS) and videos (Cloudinary), one at a time, and drops
 * each into the document where the caret was. Also takes files that are pasted
 * or dropped on the editor. Must be used inside the `LexicalComposer`.
 */
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

  // The commands are registered once; they call the latest `insertFiles`.
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
      (event) => event instanceof ClipboardEvent && take(event, event.clipboardData?.files),
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
