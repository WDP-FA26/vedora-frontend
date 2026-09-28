import type { Metadata } from "next"

import { KnowledgeDocuments } from "@/features/knowledge/components/knowledge-documents"

export const metadata: Metadata = {
  title: "Tài liệu kiến thức · Vedora Quản trị",
}

export default function AdminKnowledgePage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="text-2xl font-bold tracking-tight">Tài liệu kiến thức</h1>
      <p className="mt-1 mb-6 text-muted-foreground">
        PDF làm nguồn tham khảo cho trợ lý dinh dưỡng. Chữ và hình ảnh được đọc
        tự động sau khi tải lên.
      </p>
      <KnowledgeDocuments />
    </div>
  )
}
