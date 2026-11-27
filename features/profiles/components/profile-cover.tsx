import Image from "next/image"

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
        <img src={profile.coverUrl} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
      ) : (
        <DefaultCoverArt />
      )}
      {children}
    </div>
  )
}

function DefaultCoverArt() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -right-[6%] -top-[45%] aspect-square w-[34%] rounded-full border-[1.5rem] border-white/25 sm:border-[2rem] dark:border-white/5" />
      <div className="absolute left-[38%] top-[22%] size-2 rounded-full bg-brand-sprout/30 sm:size-3" />
      <div className="absolute left-[46%] top-[62%] size-1.5 rounded-full bg-brand-leaf/25 sm:size-2" />
      <div className="absolute left-[54%] top-[14%] size-1.5 rounded-full bg-[#f2a65a]/40 sm:size-2" />

      <Image
        src="/carrot-sticker.png"
        alt=""
        width={1263}
        height={1245}
        sizes="15vw"
        className="absolute bottom-[8%] right-[33%] h-[52%] w-auto -rotate-12 drop-shadow-[0_8px_10px_rgba(37,85,50,0.18)]"
      />
      <Image
        src="/avocado-sticker.png"
        alt=""
        width={1254}
        height={1254}
        sizes="20vw"
        className="absolute bottom-[6%] right-[15%] h-[78%] w-auto rotate-6 drop-shadow-[0_10px_12px_rgba(37,85,50,0.2)]"
      />
      <Image
        src="/tomato-sticker.png"
        alt=""
        width={1374}
        height={1145}
        sizes="15vw"
        className="absolute right-[3%] top-[12%] h-[44%] w-auto rotate-12 drop-shadow-[0_8px_10px_rgba(37,85,50,0.18)]"
      />
    </div>
  )
}
