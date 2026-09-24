import { requireAuth } from "@/features/auth/server/session"

export default async function AdminPage() {
  const user = await requireAuth("/admin")
  return <div>Admin Page · {user.fullName}</div>
}
