"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import {
  ArrowDownIcon,
  ArrowRightIcon,
  PaletteIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useGSAP } from "@gsap/react"
import Lenis from "lenis"
import "lenis/dist/lenis.css"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ThemeMenuGroup } from "@/components/theme-switcher"
import { Wordmark } from "@/features/shared/components/wordmark"
import { FeatureArt } from "@/features/landing/components/feature-art"
import {
  bodyBenefits,
  planetStats,
  platformFeatures,
} from "@/features/landing/data/story"
import { Soundscape } from "@/features/landing/lib/soundscape"

gsap.registerPlugin(useGSAP, ScrollTrigger)

// three.js only runs in the browser, and the story reads fine before it loads.
const ParticleScene = dynamic(
  () => import("./particle-scene").then((mod) => mod.ParticleScene),
  { ssr: false },
)

export function Landing() {
  const root = useRef<HTMLDivElement>(null)
  // 0–4: which shape the particle cloud shows, written by ScrollTrigger.
  const sceneProgress = useRef(0)
  // The closing copy, which the final sprout is planted above.
  const closing = useRef<HTMLDivElement>(null)
  // Created on first opt-in: browsers only allow audio after a user gesture.
  const sound = useRef<Soundscape | null>(null)
  const [soundOn, setSoundOn] = useState(false)

  useEffect(() => () => sound.current?.dispose(), [])

  const toggleSound = () => {
    sound.current ??= new Soundscape()
    if (soundOn) void sound.current.stop()
    else void sound.current.start()
    setSoundOn(!soundOn)
  }

  // Inertial scrolling, driven by GSAP's ticker so ScrollTrigger stays in sync.
  // Touch devices keep their native scrolling, which already has momentum.
  useEffect(() => {
    const smooth = window.matchMedia(
      "(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)",
    )
    if (!smooth.matches) return
    const lenis = new Lenis({ lerp: 0.09 })
    lenis.on("scroll", ScrollTrigger.update)
    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)
    return () => {
      gsap.ticker.remove(raf)
      gsap.ticker.lagSmoothing(500, 33)
      lenis.destroy()
    }
  }, [])

  useGSAP(
    () => {
      const q = gsap.utils.selector(root)
      const mm = gsap.matchMedia()

      mm.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          wide: "(min-width: 768px)",
          hover: "(hover: hover) and (pointer: fine)",
        },
        (context) => {
          const { motion, wide, hover } = context.conditions as {
            motion: boolean
            wide: boolean
            hover: boolean
          }
          const pin = motion && wide
          // Phones get flat fades that play once; 3D flips, blur and
          // replaying on scroll-back cost too much there and feel busy.
          const reveal = wide
            ? { y: 48, rotateX: -25, toggleActions: "play none none reverse" }
            : { y: 20, rotateX: 0, toggleActions: "play none none none" }
          const cleanups: Array<() => void> = []

          // Hero entrance.
          if (motion) {
            gsap.from(q("[data-hero-title]"), {
              y: wide ? 40 : 24,
              rotateX: wide ? -30 : 0,
              opacity: 0,
              transformOrigin: "50% 100%",
              duration: 1.2,
              ease: "expo.out",
              delay: 0.15,
            })
            gsap.from(q("[data-hero-fade]"), {
              y: 24,
              opacity: 0,
              duration: 1,
              ease: "power3.out",
              stagger: 0.1,
              delay: 0.55,
            })
            gsap.to(q("[data-scroll-hint]"), {
              y: 6,
              repeat: -1,
              yoyo: true,
              duration: 0.9,
              ease: "sine.inOut",
            })

            // Hero drifts up and out of focus as the story begins.
            gsap.to(q("[data-hero-inner]"), {
              yPercent: -18,
              opacity: 0,
              ...(wide && { filter: "blur(8px)" }),
              ease: "none",
              scrollTrigger: {
                trigger: q("[data-hero]")[0],
                start: "top top",
                end: "bottom 30%",
                scrub: true,
              },
            })
          }

          // Triggers are created in document order so each one accounts for
          // the pin spacing added above it.
          const stages = q<HTMLElement>("[data-stage]")
          const local = stages.map(() => 0)
          stages.forEach((section, i) => {
            ScrollTrigger.create({
              trigger: section,
              start: "top 85%",
              end: "top 20%",
              onUpdate: (self) => {
                local[i] = self.progress
                sceneProgress.current = local.reduce((sum, p) => sum + p, 0)
              },
            })

            // Not every section has lines or reveals; skip empty targets.
            const reveals = section.querySelectorAll("[data-reveal]")
            const lines = section.querySelectorAll("[data-line]")
            if (motion && reveals.length) {
              gsap.from(reveals, {
                y: reveal.y,
                rotateX: reveal.rotateX,
                opacity: 0,
                duration: wide ? 1 : 0.7,
                ease: "power3.out",
                stagger: wide ? 0.08 : 0.06,
                scrollTrigger: {
                  trigger: section,
                  start: wide ? "top 70%" : "top 80%",
                  toggleActions: reveal.toggleActions,
                },
              })
            }
            if (motion && lines.length) {
              gsap.from(lines, {
                scaleX: 0,
                duration: 1.2,
                ease: "expo.out",
                delay: 0.2,
                scrollTrigger: {
                  trigger: section,
                  start: wide ? "top 70%" : "top 80%",
                  toggleActions: reveal.toggleActions,
                },
              })
            }

            if (section.id === "co-the" && pin) {
              const items = section.querySelectorAll("[data-benefit]")
              const tl = gsap.timeline({
                scrollTrigger: {
                  trigger: section,
                  start: "top top",
                  end: "+=160%",
                  pin: true,
                  scrub: 0.6,
                },
              })
              items.forEach((item, n) => {
                tl.fromTo(
                  item,
                  { opacity: 0.18, x: -24 },
                  { opacity: 1, x: 0, duration: 1, ease: "power2.out" },
                  n,
                ).fromTo(
                  item.querySelector("[data-benefit-bar]"),
                  { scaleY: 0 },
                  { scaleY: 1, duration: 1, ease: "none" },
                  n,
                )
              })
              tl.to({}, { duration: 0.5 })
            }

            if (section.id === "hanh-tinh" && motion) {
              section
                .querySelectorAll<HTMLElement>("[data-count]")
                .forEach((el) => {
                  const target = Number(el.dataset.count)
                  const counter = { value: 0 }
                  gsap.to(counter, {
                    value: target,
                    duration: 1.8,
                    ease: "power2.out",
                    onUpdate: () => {
                      el.textContent = String(Math.round(counter.value))
                    },
                    scrollTrigger: {
                      trigger: el,
                      start: "top 80%",
                      once: true,
                    },
                  })
                })
              section.querySelectorAll("[data-bar]").forEach((bar) => {
                gsap.from(bar, {
                  scaleX: 0,
                  duration: 1.8,
                  ease: "power2.out",
                  scrollTrigger: { trigger: bar, start: "top 85%", once: true },
                })
              })
            }

            if (section.id === "vedora" && pin) {
              const track = section.querySelector<HTMLElement>("[data-track]")!
              // Slide until the track's end meets the end of its own box.
              const distance = () =>
                Math.max(
                  0,
                  track.offsetWidth - track.parentElement!.clientWidth,
                )
              const slide = gsap.to(track, {
                x: () => -distance(),
                ease: "none",
                scrollTrigger: {
                  trigger: section,
                  start: "top top",
                  end: () => `+=${distance()}`,
                  pin: true,
                  scrub: 0.8,
                  invalidateOnRefresh: true,
                },
              })
              track.querySelectorAll("[data-card]").forEach((card) => {
                gsap.fromTo(
                  card,
                  { rotateY: -32, z: -160, opacity: 0.35 },
                  {
                    rotateY: 0,
                    z: 0,
                    opacity: 1,
                    ease: "none",
                    scrollTrigger: {
                      trigger: card,
                      containerAnimation: slide,
                      start: "left 100%",
                      // Settle once fully in view, so the last card (which
                      // never travels far left) still lands flat.
                      end: "right 100%",
                      scrub: true,
                    },
                  },
                )
              })
            }
          })

          if (motion && hover) {
            // Cards lean toward the cursor, with a sheen that follows it.
            q<HTMLElement>("[data-tilt]").forEach((card) => {
              const rotateX = gsap.quickTo(card, "rotationX", {
                duration: 0.6,
                ease: "power3",
              })
              const rotateY = gsap.quickTo(card, "rotationY", {
                duration: 0.6,
                ease: "power3",
              })
              const move = (event: PointerEvent) => {
                const box = card.getBoundingClientRect()
                const x = (event.clientX - box.left) / box.width
                const y = (event.clientY - box.top) / box.height
                rotateY((x - 0.5) * 16)
                rotateX((0.5 - y) * 12)
                card.style.setProperty("--gx", `${x * 100}%`)
                card.style.setProperty("--gy", `${y * 100}%`)
              }
              const leave = () => {
                rotateX(0)
                rotateY(0)
              }
              card.addEventListener("pointermove", move)
              card.addEventListener("pointerleave", leave)
              cleanups.push(() => {
                card.removeEventListener("pointermove", move)
                card.removeEventListener("pointerleave", leave)
              })
            })

            // The closing button leans toward the cursor.
            q<HTMLElement>("[data-magnetic]").forEach((zone) => {
              const target = zone.firstElementChild as HTMLElement
              const x = gsap.quickTo(target, "x", {
                duration: 0.5,
                ease: "power3",
              })
              const y = gsap.quickTo(target, "y", {
                duration: 0.5,
                ease: "power3",
              })
              const move = (event: PointerEvent) => {
                const box = zone.getBoundingClientRect()
                x((event.clientX - box.left - box.width / 2) * 0.3)
                y((event.clientY - box.top - box.height / 2) * 0.4)
              }
              const leave = () => {
                x(0)
                y(0)
              }
              zone.addEventListener("pointermove", move)
              zone.addEventListener("pointerleave", leave)
              cleanups.push(() => {
                zone.removeEventListener("pointermove", move)
                zone.removeEventListener("pointerleave", leave)
              })
            })
          }

          gsap.fromTo(
            q("[data-progress]"),
            { scaleX: 0 },
            {
              scaleX: 1,
              ease: "none",
              scrollTrigger: {
                trigger: root.current,
                start: "top top",
                end: "bottom bottom",
                scrub: 0.3,
              },
            },
          )

          return () => cleanups.forEach((cleanup) => cleanup())
        },
      )
    },
    { scope: root },
  )

  return (
    <div
      ref={root}
      className="relative isolate flex-1 overflow-x-clip bg-background"
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-lvh bg-[radial-gradient(60%_50%_at_70%_40%,color-mix(in_oklch,var(--primary)_10%,transparent),transparent)]"
      >
        <ParticleScene
          progress={sceneProgress}
          anchor={closing}
          sound={sound}
        />
      </div>

      <header className="fixed inset-x-0 top-0 z-20 bg-background/60 backdrop-blur-md">
        <div
          data-progress
          aria-hidden
          className="h-0.5 origin-left scale-x-0 bg-primary"
        />
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-8">
          <Wordmark href="/" />
          <div className="flex items-center gap-1 sm:gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="action" size="icon-lg" shape="pill" />}
                aria-label="Giao diện"
                title="Giao diện"
              >
                <PaletteIcon aria-hidden />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <ThemeMenuGroup />
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="action"
              size="icon-lg"
              shape="pill"
              aria-pressed={soundOn}
              aria-label={soundOn ? "Tắt âm thanh" : "Bật âm thanh"}
              title={soundOn ? "Tắt âm thanh" : "Bật âm thanh"}
              onClick={toggleSound}
            >
              {soundOn ? (
                <Volume2Icon aria-hidden />
              ) : (
                <VolumeXIcon aria-hidden />
              )}
            </Button>
            <Button
              size="pill-sm"
              shape="pill"
              render={<Link href="/app" />}
              nativeButton={false}
            >
              Vào Vedora
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section
          data-hero
          aria-labelledby="hero-title"
          className="mx-auto flex min-h-svh max-w-7xl flex-col justify-end px-4 pt-24 pb-10 sm:px-8 sm:pb-16 md:justify-center md:pb-24"
        >
          <div data-hero-inner className="max-w-2xl perspective-[900px]">
            <p
              data-hero-fade
              className="mb-5 text-sm font-semibold tracking-[0.18em] text-primary uppercase"
            >
              Sống xanh có ý thức
            </p>
            <h1
              id="hero-title"
              data-hero-title
              className="text-[clamp(2.75rem,7vw,5.75rem)] leading-[1.2] font-extrabold tracking-[-0.045em] text-balance"
            >
              Ăn xanh hơn, sống nhẹ hơn.
            </h1>
            <p
              data-hero-fade
              className="mt-6 max-w-lg text-lg leading-relaxed text-pretty text-muted-foreground"
            >
              Một câu chuyện ngắn về điều bữa ăn thực vật làm cho cơ thể, cho
              Trái Đất, và vì sao chúng tôi xây Vedora để bạn không phải nấu một
              mình.
            </p>
            <p
              data-hero-fade
              className="mt-8 flex items-center gap-2 text-sm font-medium text-muted-foreground sm:mt-12"
            >
              <ArrowDownIcon data-scroll-hint aria-hidden className="size-4" />
              Cuộn để bắt đầu
            </p>
          </div>
        </section>

        {/* Chapter 01: body */}
        <section
          id="co-the"
          data-stage
          aria-labelledby="co-the-title"
          className="flex min-h-svh items-center"
        >
          <div className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-8">
            <div className="max-w-xl perspective-[900px]">
              <ChapterLabel number="01" name="Cơ thể" />
              <h2
                id="co-the-title"
                data-reveal
                className="mt-4 text-[clamp(2.25rem,5vw,4rem)] leading-[1.2] font-extrabold tracking-[-0.04em] text-balance"
              >
                Bắt đầu từ bên trong.
              </h2>
              <p
                data-reveal
                className="mt-5 text-lg leading-relaxed text-pretty text-muted-foreground"
              >
                Rau, đậu, ngũ cốc nguyên hạt và các loại hạt mang đến những thứ
                cơ thể cần mỗi ngày.
              </p>
              <ol className="mt-10 space-y-7">
                {bodyBenefits.map((benefit) => (
                  <li
                    key={benefit.title}
                    data-benefit
                    className="relative pl-6"
                  >
                    <span
                      aria-hidden
                      className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-border"
                    >
                      <span
                        data-benefit-bar
                        className="block size-full origin-top rounded-full bg-primary"
                      />
                    </span>
                    <h3 className="text-xl font-bold tracking-[-0.02em]">
                      {benefit.title}
                    </h3>
                    <p className="mt-1.5 leading-relaxed text-muted-foreground">
                      {benefit.body}
                    </p>
                  </li>
                ))}
              </ol>
              <p className="mt-10 text-xs text-muted-foreground">
                Thông tin tham khảo chung, không thay thế tư vấn dinh dưỡng cá
                nhân.
              </p>
            </div>
          </div>
        </section>

        {/* Chapter 02: planet */}
        <section
          id="hanh-tinh"
          data-stage
          aria-labelledby="hanh-tinh-title"
          className="flex min-h-svh items-center"
        >
          <div className="mx-auto flex w-full max-w-7xl justify-end px-4 py-24 sm:px-8">
            <div className="max-w-xl perspective-[900px]">
              <ChapterLabel number="02" name="Hành tinh" />
              <h2
                id="hanh-tinh-title"
                data-reveal
                className="mt-4 text-[clamp(2.25rem,5vw,4rem)] leading-[1.2] font-extrabold tracking-[-0.04em] text-balance"
              >
                Một chiếc đĩa, một Trái Đất.
              </h2>
              <p
                data-reveal
                className="mt-5 text-lg leading-relaxed text-pretty text-muted-foreground"
              >
                Thứ chúng ta ăn là một trong những đòn bẩy lớn nhất cho khí hậu.
                So với chế độ ăn hiện nay, ăn hoàn toàn thực vật có thể giảm:
              </p>
              <dl className="mt-10 grid gap-6 sm:grid-cols-3">
                {planetStats.map((stat) => (
                  <div
                    key={stat.label}
                    data-reveal
                    className="border-t border-border pt-4"
                  >
                    <dt className="sr-only">{stat.label}</dt>
                    <dd className="text-5xl font-extrabold tracking-[-0.04em] text-primary tabular-nums">
                      <span data-count={stat.value}>{stat.value}</span>%
                    </dd>
                    <dd
                      aria-hidden
                      className="mt-3 h-1 overflow-hidden rounded-full bg-border"
                    >
                      <span
                        data-bar
                        className="block h-full origin-left rounded-full bg-primary"
                        style={{ transform: `scaleX(${stat.value / 100})` }}
                      />
                    </dd>
                    <dd
                      aria-hidden
                      className="mt-2 text-sm leading-snug text-muted-foreground"
                    >
                      {stat.label}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-8 text-xs text-muted-foreground">
                Nguồn: Poore &amp; Nemecek, <cite>Science</cite> (2018), mức
                giảm trên toàn hệ thống thực phẩm toàn cầu.
              </p>
            </div>
          </div>
        </section>

        {/* Chapter 03: platform */}
        <section
          id="vedora"
          data-stage
          aria-labelledby="vedora-title"
          className="flex min-h-svh flex-col justify-center py-24"
        >
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-8">
            <div className="max-w-2xl perspective-[900px]">
              <ChapterLabel number="03" name="Vedora" />
              <h2
                id="vedora-title"
                data-reveal
                className="mt-4 text-[clamp(2.25rem,5vw,4rem)] leading-[1.2] font-extrabold tracking-[-0.04em] text-balance"
              >
                Nơi bếp chay trở thành cộng đồng.
              </h2>
              <p
                data-reveal
                className="mt-5 text-lg leading-relaxed text-pretty text-muted-foreground"
              >
                Vedora là mạng xã hội cho người nấu ăn thuần thực vật: xem, học,
                nấu và chia sẻ trong cùng một dòng thời gian.
              </p>
            </div>
          </div>

          {/* Cards are sized as a share of this container (cqw), so on
              desktop the row always overflows it and has room to slide. */}
          <div className="@container mx-auto mt-10 w-full max-w-7xl md:mt-12">
            <div className="snap-x snap-mandatory scroll-px-4 overflow-x-auto overscroll-x-contain pb-4 [scrollbar-width:none] sm:scroll-px-8 md:motion-safe:overflow-visible">
              <ul
                data-track
                className="flex w-max gap-5 px-4 perspective-[1400px] transform-3d sm:px-8"
              >
                {platformFeatures.map((feature) => (
                  <li
                    key={feature.title}
                    data-card
                    className="w-[82cqw] snap-start perspective-[900px] sm:w-[55cqw] md:w-[34cqw]"
                  >
                    <div
                      data-tilt
                      className="group/card relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card/95 p-6 shadow-[0_24px_60px_-30px_oklch(0.3_0.06_165/0.45)] md:bg-card/85 md:p-7 md:backdrop-blur-md"
                    >
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_var(--gx,50%)_var(--gy,0%),color-mix(in_oklch,var(--primary)_16%,transparent),transparent_60%)] opacity-0 transition-opacity duration-500 group-hover/card:opacity-100"
                      />
                      <FeatureArt
                        name={feature.art}
                        className="mx-auto aspect-8/5 w-3/5"
                      />
                      <h3 className="mt-6 text-2xl font-bold tracking-[-0.03em] md:mt-8">
                        {feature.title}
                      </h3>
                      <p className="mt-3 leading-relaxed text-muted-foreground">
                        {feature.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p
            aria-hidden
            className="mt-2 flex items-center gap-2 px-4 text-sm font-medium text-muted-foreground sm:px-8 md:hidden"
          >
            Vuốt để xem thêm
            <ArrowRightIcon className="size-4" />
          </p>
        </section>

        {/* Closing */}
        <section
          data-stage
          aria-labelledby="cta-title"
          className="flex min-h-svh flex-col items-center justify-end px-4 pb-[min(6rem,10svh)] text-center sm:px-8"
        >
          <div ref={closing} className="max-w-2xl perspective-[900px]">
            <h2
              id="cta-title"
              data-reveal
              className="text-[clamp(2.25rem,min(6vw,9svh),4.75rem)] leading-[1.2] font-extrabold tracking-[-0.045em] text-balance"
            >
              Gieo hạt giống đầu tiên.
            </h2>
            <p
              data-reveal
              className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-pretty text-muted-foreground"
            >
              Tham gia cùng những người nấu ăn tò mò và các đầu bếp thực vật.
              Bữa ăn xanh tiếp theo của bạn bắt đầu từ đây.
            </p>
            <div data-reveal className="mt-9">
              <span data-magnetic className="inline-block p-4">
                <Button
                  variant="raised"
                  size="pill"
                  shape="pill"
                  className="h-12 px-7 text-base"
                  render={<Link href="/app" />}
                  nativeButton={false}
                >
                  Khám phá Vedora
                  <ArrowRightIcon aria-hidden data-icon="inline-end" />
                </Button>
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function ChapterLabel({ number, name }: { number: string; name: string }) {
  return (
    <p
      data-reveal
      className="flex items-center gap-3 text-sm font-semibold tracking-[0.18em] text-primary uppercase"
    >
      <span className="font-mono tabular-nums">{number}</span>
      <span
        data-line
        aria-hidden
        className="h-px w-8 origin-left bg-primary/50"
      />
      {name}
    </p>
  )
}
