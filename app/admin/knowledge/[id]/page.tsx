import type { Metadata } from "next"

import { KnowledgeReview } from "@/features/knowledge/components/knowledge-review"

export const metadata: Metadata = {
  title: "Duyệt tài liệu · Vedora Quản trị",
}

export default async function AdminKnowledgeReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <KnowledgeReview id={id} />
}
