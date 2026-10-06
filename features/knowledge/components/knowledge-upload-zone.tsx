"use client"

import { useDropzone } from "react-dropzone"
import { FileTextIcon, FileUpIcon, XIcon } from "lucide-react"
import { cn } from "cn"

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentMedia,
} from "@/components/ui/attachment"
import { Button } from "@/components/ui/button"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress"
import type { KnowledgeUpload } from "@/features/knowledge/hooks/use-knowledge-uploads"
import {
  KNOWLEDGE_ACCEPT,
  MAX_KNOWLEDGE_FILE_MB,
} from "@/features/knowledge/schemas"

/** Drop target and file picker for PDFs, with the uploads in flight below. */
export function KnowledgeUploadZone({
  uploads,
  onFiles,
  onCancel,
}: {
  uploads: KnowledgeUpload[]
  onFiles: (files: File[]) => void
  onCancel: (key: string) => void
}) {
  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    accept: KNOWLEDGE_ACCEPT,
    noClick: true,
    noKeyboard: true,
    // Rejected files go through too, so vedora-api explains why.
    onDrop: (accepted, rejected) => onFiles([...accepted, ...rejected.map(({ file }) => file)]),
  })

  return (
    <section aria-label="Tải tài liệu lên" className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-10 text-center transition-colors",
          isDragActive && "border-primary bg-accent"
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-accent text-primary">
          <FileUpIcon aria-hidden className="size-5" />
        </span>
        <div className="space-y-1">
          <p className="font-medium">Kéo thả tệp PDF vào đây</p>
          <p className="text-sm text-muted-foreground">
            Tối đa {MAX_KNOWLEDGE_FILE_MB} MB mỗi tệp. Đọc được cả bảng, trang
            nhiều cột và bản scan.
          </p>
        </div>
        <Button variant="outline" onClick={open}>
          Chọn tệp
        </Button>
        <input {...getInputProps()} />
      </div>

      {uploads.length > 0 && (
        <ul className="space-y-2" aria-label="Đang tải lên">
          {uploads.map((upload) => (
            <li key={upload.key}>
              <Attachment state="uploading" className="w-full">
                <AttachmentMedia>
                  <FileTextIcon aria-hidden />
                </AttachmentMedia>
                <AttachmentContent>
                  <Progress value={upload.progress}>
                    <ProgressLabel className="min-w-0 flex-1">
                      <span className="block truncate">{upload.name}</span>
                    </ProgressLabel>
                    <ProgressValue />
                  </Progress>
                </AttachmentContent>
                <AttachmentActions>
                  <AttachmentAction
                    aria-label={`Huỷ tải ${upload.name}`}
                    onClick={() => onCancel(upload.key)}
                  >
                    <XIcon aria-hidden />
                  </AttachmentAction>
                </AttachmentActions>
              </Attachment>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
