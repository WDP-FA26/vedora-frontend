"use client"

import { useState } from "react"
import { cn } from "cn"

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

export type GalleryImage = { src: string; alt: string }

/** Tiles shown in the grid; the rest are counted on the last one. */
const MAX_TILES = 4

// Grid per number of images: two side by side, one big beside two small,
// then a 2×2 grid.
const GRID: Record<number, string> = {
  2: "aspect-[2/1] grid-cols-2",
  3: "aspect-[4/3] grid-cols-2 grid-rows-2 [&>*:first-child]:row-span-2",
  4: "aspect-[4/3] grid-cols-2 grid-rows-2",
}

/**
 * Images the author put one after another, as one grid instead of a long
 * column. Any image opens a full-screen viewer that swipes through them all.
 */
export function BlogGallery({ images }: { images: GalleryImage[] }) {
  const [openAt, setOpenAt] = useState<number | null>(null)
  const tiles = images.slice(0, MAX_TILES)
  const hidden = images.length - tiles.length

  return (
    <>
      <div
        className={cn(
          "my-4 grid gap-1 overflow-hidden rounded-2xl",
          GRID[Math.min(images.length, MAX_TILES)]
        )}
      >
        {tiles.map((image, index) => (
          <button
            key={`${image.src}-${index}`}
            type="button"
            onClick={() => setOpenAt(index)}
            aria-label={`Xem ảnh ${index + 1} trên ${images.length}${image.alt ? `: ${image.alt}` : ""}`}
            className="relative min-h-0 overflow-hidden bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
          >
            {/* Blog images come from storage or other sites, so the Next image optimizer is not used. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.src}
              alt={image.alt}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="size-full object-cover transition-transform duration-300 hover:scale-[1.03]"
            />
            {hidden > 0 && index === tiles.length - 1 && (
              <span
                aria-hidden
                className="absolute inset-0 flex items-center justify-center bg-black/50 text-2xl font-bold text-white"
              >
                +{hidden}
              </span>
            )}
          </button>
        ))}
      </div>

      <Dialog open={openAt !== null} onOpenChange={(open) => !open && setOpenAt(null)}>
        <DialogContent flush className="sm:max-w-4xl">
          <DialogTitle className="sr-only">Ảnh trong bài viết</DialogTitle>
          {openAt !== null && (
            <Carousel opts={{ startIndex: openAt, loop: images.length > 1 }} className="w-full">
              <CarouselContent>
                {images.map((image, index) => (
                  <CarouselItem key={`${image.src}-${index}`} className="flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.src}
                      alt={image.alt}
                      referrerPolicy="no-referrer"
                      className="max-h-[80dvh] w-full object-contain"
                    />
                  </CarouselItem>
                ))}
              </CarouselContent>
              {images.length > 1 && (
                <>
                  <CarouselPrevious className="left-3" />
                  <CarouselNext className="right-3" />
                </>
              )}
            </Carousel>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
