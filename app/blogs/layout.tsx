import { Toaster } from "@/components/ui/toast"
import { AuthProvider } from "@/features/auth/components/auth-provider"
import { getAccessToken, requireAuth } from "@/features/auth/server/session"

/** The blog editor is a full-screen page of its own: no nav or right rail, just the session. */
export default async function BlogEditorLayout({ children }: { children: React.ReactNode }) {
  const [user, accessToken] = await Promise.all([requireAuth("/blogs/new"), getAccessToken()])
  return (
    <AuthProvider accessToken={accessToken} user={user}>
      <main className="min-h-dvh bg-background text-foreground">{children}</main>
      <Toaster />
    </AuthProvider>
  )
}
