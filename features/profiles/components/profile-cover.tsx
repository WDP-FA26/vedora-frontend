import type { ApiProfile } from "@/features/profiles/schemas"

export function ProfileCover({
  profile,
  children,
}: {
  profile: Pick<ApiProfile, "coverUrl">
  children?: React.ReactNode
}) {
  return (
    <div className="relative isolate aspect-[3/1] w-full overflow-hidden bg-gradient-to-br from-[#dcefd2] via-[#edf6e8] to-[#d5ece8] dark:from-[#203d29] dark:via-[#274632] dark:to-[#22514d]">
      {profile.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.coverUrl} alt="" className="size-full object-cover" />
      ) : (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-10 -top-24 size-72 rounded-full border-[2rem] border-white/20 sm:size-80" />
          <div className="absolute -bottom-28 right-28 size-52 rounded-full border-[1.5rem] border-brand-leaf/10 sm:size-64" />
          <div className="absolute left-1/3 top-1/4 size-4 rounded-full bg-brand-sprout/25" />
        </div>
      )}
      {children}
    </div>
  )
}
