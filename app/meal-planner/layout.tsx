import { Toaster } from "@/components/ui/toast"
import { AuthProvider } from "@/features/auth/components/auth-provider"
import { getAccessToken, requireAuth } from "@/features/auth/server/session"
import { MEAL_PLANNER_PATH } from "@/features/meal-plan/meal-plan"

export default async function MealPlannerLayout({ children }: { children: React.ReactNode }) {
  const [user, accessToken] = await Promise.all([requireAuth(MEAL_PLANNER_PATH), getAccessToken()])
  return (
    <AuthProvider accessToken={accessToken} user={user}>
      <main className="min-h-dvh bg-background text-foreground">{children}</main>
      <Toaster />
    </AuthProvider>
  )
}
