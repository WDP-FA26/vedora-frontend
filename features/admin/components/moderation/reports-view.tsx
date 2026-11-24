"use client"

import { useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ModerationTable } from "./moderation-table"
import { CommentReportsView } from "@/features/admin/comment-reports/comment-reports-view"

export function ReportsView() {
  const [tab, setTab] = useState<string | null>("posts")
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="mx-4 mt-4">
        <TabsTrigger value="posts">Bài viết</TabsTrigger>
        <TabsTrigger value="comments">Bình luận</TabsTrigger>
      </TabsList>
      <TabsContent value="posts">
        <ModerationTable />
      </TabsContent>
      <TabsContent value="comments">
        <CommentReportsView />
      </TabsContent>
    </Tabs>
  )
}
