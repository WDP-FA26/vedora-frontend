import Link from "next/link"
import { AuthProvider } from "@/features/auth/components/auth-provider"
import { getAccessToken, getAuth } from "@/features/auth/server/session"

export default async function BillingLayout({ children }: { children: React.ReactNode }) {
  const [user, accessToken] = await Promise.all([getAuth(), getAccessToken()])
  return <AuthProvider key={user?.id ?? "guest"} user={user} accessToken={accessToken}><div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:py-10"><nav aria-label="Điều hướng thanh toán" className="mb-8 flex gap-5 text-sm"><Link href="/home" className="text-muted-foreground hover:text-foreground">← Về Vedora</Link><Link href="/billing" className="font-medium">Gói của bạn</Link></nav>{children}</div></AuthProvider>
}
