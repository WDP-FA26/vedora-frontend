import type { Metadata } from "next"

import { KnowledgeDocuments } from "@/features/knowledge/components/knowledge-documents"

export const metadata: Metadata = {
  title: "Tài liệu kiến thức · Vedora Quản trị",
}

export default function AdminKnowledgePage() {
  return <KnowledgeDocuments />
}
