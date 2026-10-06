import type { ApiProfile } from "@/features/profiles/schemas"

export function ProfileCover({
  profile,
  children,
}: {
  profile: Pick<ApiProfile, "coverUrl">
  children?: React.ReactNode
}) {
  return (
    <div className="relative aspect-[3/1] w-full overflow-hidden bg-muted">
      {profile.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.coverUrl} alt="" className="size-full object-cover" />
      )}
      {children}
    </div>
  )
}
