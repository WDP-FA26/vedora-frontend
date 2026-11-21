"use client"

import { GlobeIcon, MapPinIcon, PhoneIcon } from "lucide-react"

import { RestaurantLocationMap } from "@/features/workspaces/components/map"
import { MAPBOX_TOKEN } from "@/features/workspaces/lib/mapbox"
import type { RestaurantProfile } from "@/features/profiles/schemas"

/** Address, contact and a small map on a restaurant page's profile. */
export function RestaurantCard({ restaurant }: { restaurant: RestaurantProfile }) {
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${restaurant.latitude},${restaurant.longitude}`
  return (
    <section
      aria-label="Thông tin nhà hàng"
      className="mt-4 overflow-hidden rounded-2xl border border-border bg-card"
    >
      {MAPBOX_TOKEN && (
        <div className="h-40 border-b border-border">
          <RestaurantLocationMap
            point={{ longitude: restaurant.longitude, latitude: restaurant.latitude }}
          />
        </div>
      )}
      <ul className="flex flex-col gap-2 p-4 text-sm">
        <li className="flex items-start gap-2">
          <MapPinIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            {restaurant.address}{" "}
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              Chỉ đường
            </a>
          </span>
        </li>
        {restaurant.phone && (
          <li className="flex items-center gap-2">
            <PhoneIcon aria-hidden className="size-4 shrink-0 text-primary" />
            <a href={`tel:${restaurant.phone.replace(/\s/g, "")}`} className="hover:underline">
              {restaurant.phone}
            </a>
          </li>
        )}
        {restaurant.website && (
          <li className="flex items-center gap-2">
            <GlobeIcon aria-hidden className="size-4 shrink-0 text-primary" />
            <a
              href={restaurant.website}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="truncate hover:underline"
            >
              {restaurant.website.replace(/^https?:\/\//, "")}
            </a>
          </li>
        )}
      </ul>
    </section>
  )
}
