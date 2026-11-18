import { PostDraftEditor } from "@/features/post-drafts/drafts-view"

export const metadata = { title: "Chỉnh sửa nháp · Vedora" }
export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PostDraftEditor id={id} />
}
