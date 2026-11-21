"use client"

import { useEffect, useRef, useState } from "react"
import { MapPinIcon, SearchIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { LocationPickerMap } from "@/features/workspaces/components/map"
import {
  addressAt,
  MAPBOX_TOKEN,
  searchAddresses,
  type AddressSuggestion,
} from "@/features/workspaces/lib/mapbox"
import type { LngLat } from "@/features/workspaces/schemas"

const SEARCH_DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 3

/**
 * Address search plus a map to pin the restaurant. Picking a suggestion fills
 * the address and moves the pin; moving the pin looks up the address there
 * when the field is still empty. Without a Mapbox token, the address is typed
 * and the coordinates entered by hand.
 */
export function LocationPicker({
  address,
  location,
  invalid,
  disabled,
  onAddressChange,
  onLocationChange,
}: {
  address: string
  location: LngLat | null
  invalid: boolean
  disabled: boolean
  onAddressChange: (address: string) => void
  onLocationChange: (point: LngLat) => void
}) {
  if (!MAPBOX_TOKEN) {
    return (
      <ManualLocation
        location={location}
        invalid={invalid}
        disabled={disabled}
        onLocationChange={onLocationChange}
      />
    )
  }
  return (
    <MapLocation
      token={MAPBOX_TOKEN}
      address={address}
      location={location}
      disabled={disabled}
      onAddressChange={onAddressChange}
      onLocationChange={onLocationChange}
    />
  )
}

function MapLocation({
  token,
  address,
  location,
  disabled,
  onAddressChange,
  onLocationChange,
}: {
  token: string
  address: string
  location: LngLat | null
  disabled: boolean
  onAddressChange: (address: string) => void
  onLocationChange: (point: LngLat) => void
}) {
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)
  const reverseLookup = useRef<AbortController | null>(null)

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setSearching(true)
      searchAddresses(token, trimmed, location, controller.signal)
        .then((found) => {
          setSuggestions(found)
          setSearchFailed(false)
        })
        .catch(() => {
          if (controller.signal.aborted) return
          setSuggestions([])
          setSearchFailed(true)
        })
        .finally(() => setSearching(false))
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, token, location])

  function pick(suggestion: AddressSuggestion) {
    onAddressChange(suggestion.label)
    onLocationChange({ longitude: suggestion.longitude, latitude: suggestion.latitude })
    setQuery("")
    setSuggestions([])
  }

  function pin(point: LngLat) {
    onLocationChange(point)
    if (address.trim()) return
    reverseLookup.current?.abort()
    const controller = new AbortController()
    reverseLookup.current = controller
    addressAt(token, point, controller.signal)
      .then((found) => {
        if (found) onAddressChange(found)
      })
      // The address can still be typed by hand.
      .catch(() => undefined)
  }

  const showSuggestions = query.trim().length >= MIN_QUERY_LENGTH

  return (
    <div className="flex flex-col gap-2">
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm địa chỉ để ghim lên bản đồ"
          aria-label="Tìm địa chỉ trên bản đồ"
        />
        {searching && (
          <InputGroupAddon align="inline-end">
            <Spinner aria-label="Đang tìm" />
          </InputGroupAddon>
        )}
      </InputGroup>
      {showSuggestions && suggestions.length > 0 && (
        <ul
          aria-label="Gợi ý địa chỉ"
          className="overflow-hidden rounded-xl border border-border bg-popover text-sm"
        >
          {suggestions.map((suggestion) => (
            <li key={suggestion.id}>
              <button
                type="button"
                onClick={() => pick(suggestion)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                <MapPinIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                {suggestion.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {showSuggestions && searchFailed && (
        <p role="alert" className="text-sm text-destructive">
          Không tìm được địa chỉ lúc này. Bạn vẫn có thể bấm lên bản đồ để ghim.
        </p>
      )}
      <div className="h-72 overflow-hidden rounded-2xl border border-border">
        <LocationPickerMap value={location} onChange={pin} />
      </div>
      <p className="text-sm text-muted-foreground">
        {location
          ? "Kéo ghim hoặc bấm vào chỗ khác trên bản đồ để chỉnh vị trí."
          : "Bấm lên bản đồ để ghim vị trí nhà hàng."}
      </p>
    </div>
  )
}

function ManualLocation({
  location,
  invalid,
  disabled,
  onLocationChange,
}: {
  location: LngLat | null
  invalid: boolean
  disabled: boolean
  onLocationChange: (point: LngLat) => void
}) {
  function update(field: keyof LngLat, raw: string) {
    const value = Number(raw)
    if (raw.trim() === "" || !Number.isFinite(value)) return
    const current = location ?? { longitude: 0, latitude: 0 }
    onLocationChange({ ...current, [field]: value })
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Input
        type="number"
        step="any"
        inputMode="decimal"
        aria-label="Vĩ độ"
        placeholder="Vĩ độ, ví dụ 21.0285"
        aria-invalid={invalid}
        disabled={disabled}
        defaultValue={location?.latitude}
        onChange={(event) => update("latitude", event.target.value)}
      />
      <Input
        type="number"
        step="any"
        inputMode="decimal"
        aria-label="Kinh độ"
        placeholder="Kinh độ, ví dụ 105.8542"
        aria-invalid={invalid}
        disabled={disabled}
        defaultValue={location?.longitude}
        onChange={(event) => update("longitude", event.target.value)}
      />
    </div>
  )
}
