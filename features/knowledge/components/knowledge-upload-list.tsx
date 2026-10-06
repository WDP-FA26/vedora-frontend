import { FileTextIcon, XIcon } from "lucide-react"

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentMedia,
} from "@/components/ui/attachment"
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress"
import type { KnowledgeUpload } from "@/features/knowledge/hooks/use-knowledge-uploads"

/** The uploads in flight, each with its progress and a way to cancel. */
export function KnowledgeUploadList({
  uploads,
  onCancel,
}: {
  uploads: KnowledgeUpload[]
  onCancel: (key: string) => void
}) {
  return (
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
  )
}
