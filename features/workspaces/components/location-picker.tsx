"use client"

import { useEffect, useRef, useState, type ClipboardEvent } from "react"
import { CompassIcon, LocateFixedIcon, MapPinIcon, SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LocationPickerMap } from "@/features/workspaces/components/map"
import {
  GEOLOCATION_OPTIONS,
  geolocationErrorMessage,
  isGeolocationSupported,
} from "@/features/workspaces/lib/geolocation"
import {
  addressAt,
  MAPBOX_TOKEN,
  searchAddresses,
  type AddressSuggestion,
} from "@/features/workspaces/lib/mapbox"
import type { LngLat } from "@/features/workspaces/schemas"
import { cn } from "@/lib/utils"

const SEARCH_DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 3
const COORD_PAIR_RE = /^\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*$/

type LocationMode = "pin" | "search" | "coordinates" | "current"

function isLocationMode(value: unknown): value is LocationMode {
  return value === "pin" || value === "search" || value === "coordinates" || value === "current"
}

function parseCoordinate(raw: string, min: number, max: number): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value < min || value > max) return null
  return value
}

function formatSourceKey(location: LngLat | null): string {
  return location ? `${location.latitude},${location.longitude}` : ""
}

function currentButtonLabel(locating: boolean, hasLocation: boolean): string {
  if (locating) return "Đang lấy vị trí…"
  if (hasLocation) return "Lấy lại vị trí hiện tại"
  return "Lấy vị trí hiện tại"
}

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
  const hasMapbox = Boolean(MAPBOX_TOKEN)
  const [mode, setMode] = useState<LocationMode>(hasMapbox ? "pin" : "coordinates")

  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)
  const [completedQuery, setCompletedQuery] = useState<string | null>(null)

  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [geoAccuracy, setGeoAccuracy] = useState<number | null>(null)

  const [lookingUpAddress, setLookingUpAddress] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)

  const reverseLookupRef = useRef<AbortController | null>(null)
  const geoRequestIdRef = useRef(0)

  useEffect(() => {
    const requestIdRef = geoRequestIdRef
    return () => {
      reverseLookupRef.current?.abort()
      requestIdRef.current += 1
    }
  }, [])

  useEffect(() => {
    const token = MAPBOX_TOKEN
    const trimmed = query.trim()
    if (!token || mode !== "search" || trimmed.length < MIN_QUERY_LENGTH) return

    const controller = new AbortController()
    const timer = setTimeout(() => {
      setSearching(true)
      searchAddresses(token, trimmed, location, controller.signal)
        .then((found) => {
          setSuggestions(found)
          setSearchFailed(false)
          setCompletedQuery(trimmed)
        })
        .catch(() => {
          if (controller.signal.aborted) return
          setSuggestions([])
          setSearchFailed(true)
          setCompletedQuery(trimmed)
        })
        .finally(() => setSearching(false))
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, mode, location])

  function autoFillAddressIfEmpty(point: LngLat) {
    const token = MAPBOX_TOKEN
    if (!token || address.trim()) return
    reverseLookupRef.current?.abort()
    const controller = new AbortController()
    reverseLookupRef.current = controller
    addressAt(token, point, controller.signal)
      .then((found) => {
        if (found) onAddressChange(found)
      })
      .catch(() => undefined)
  }

  function fillAddressFromPoint(point: LngLat) {
    const token = MAPBOX_TOKEN
    if (!token || disabled) return
    reverseLookupRef.current?.abort()
    const controller = new AbortController()
    reverseLookupRef.current = controller
    setLookingUpAddress(true)
    setLookupError(null)
    addressAt(token, point, controller.signal)
      .then((found) => {
        if (found) {
          onAddressChange(found)
          return
        }
        setLookupError("Không tìm thấy tên địa chỉ tại tọa độ này.")
      })
      .catch(() => {
        if (controller.signal.aborted) return
        setLookupError("Không lấy được địa chỉ lúc này.")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLookingUpAddress(false)
      })
  }

  function handlePinChange(point: LngLat) {
    if (disabled) return
    setLookupError(null)
    onLocationChange(point)
    autoFillAddressIfEmpty(point)
  }

  function handleSuggestionPick(suggestion: AddressSuggestion) {
    setLookupError(null)
    onAddressChange(suggestion.label)
    onLocationChange({ longitude: suggestion.longitude, latitude: suggestion.latitude })
    setQuery("")
    setSuggestions([])
    setCompletedQuery(null)
  }

  function handleQueryChange(next: string) {
    setQuery(next)
    if (next.trim().length < MIN_QUERY_LENGTH) {
      setSuggestions([])
      setSearchFailed(false)
      setSearching(false)
      setCompletedQuery(null)
    }
  }

  function locateCurrentPosition() {
    if (disabled) return
    if (!isGeolocationSupported()) {
      setGeoError("Trình duyệt này không hỗ trợ định vị. Hãy ghim bản đồ hoặc nhập tọa độ.")
      return
    }
    const requestId = geoRequestIdRef.current + 1
    geoRequestIdRef.current = requestId
    setLocating(true)
    setGeoError(null)
    setLookupError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (requestId !== geoRequestIdRef.current) return
        const point: LngLat = {
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        }
        const accuracy = Number.isFinite(position.coords.accuracy)
          ? Math.round(position.coords.accuracy)
          : null
        setLocating(false)
        setGeoAccuracy(accuracy)
        onLocationChange(point)
        autoFillAddressIfEmpty(point)
      },
      (error) => {
        if (requestId !== geoRequestIdRef.current) return
        setLocating(false)
        setGeoError(geolocationErrorMessage(error))
      },
      GEOLOCATION_OPTIONS
    )
  }

  function handleModeChange(next: unknown) {
    if (!isLocationMode(next)) return
    setMode(next)
    if (next === "current" && !locating) {
      locateCurrentPosition()
    }
  }

  const trimmedQuery = query.trim()
  const showSuggestions = mode === "search" && trimmedQuery.length >= MIN_QUERY_LENGTH
  const showNoResults =
    showSuggestions &&
    !searching &&
    !searchFailed &&
    completedQuery === trimmedQuery &&
    suggestions.length === 0

  return (
    <div className="flex flex-col gap-3">
      <Tabs value={mode} onValueChange={handleModeChange}>
        <TabsList
          aria-label="Chọn cách xác định vị trí"
          className={cn(
            "grid h-auto! w-full",
            hasMapbox ? "grid-cols-2 xl:grid-cols-4" : "grid-cols-2"
          )}
        >
          {hasMapbox && (
            <TabsTrigger value="pin" className="h-9">
              <MapPinIcon aria-hidden />
              Ghim bản đồ
            </TabsTrigger>
          )}
          {hasMapbox && (
            <TabsTrigger value="search" className="h-9">
              <SearchIcon aria-hidden />
              Gợi ý
            </TabsTrigger>
          )}
          <TabsTrigger value="coordinates" className="h-9">
            <CompassIcon aria-hidden />
            Nhập tọa độ
          </TabsTrigger>
          <TabsTrigger value="current" className="h-9">
            <LocateFixedIcon aria-hidden />
            Vị trí hiện tại
          </TabsTrigger>
        </TabsList>

        {hasMapbox && (
          <TabsContent value="pin">
            <p className="text-sm text-muted-foreground">
              Bấm lên bản đồ hoặc kéo ghim để đặt chính xác vị trí nhà hàng.
            </p>
          </TabsContent>
        )}

        {hasMapbox && (
          <TabsContent value="search">
            <div className="flex flex-col gap-2">
              <InputGroup>
                <InputGroupAddon>
                  <SearchIcon aria-hidden />
                </InputGroupAddon>
                <InputGroupInput
                  type="search"
                  value={query}
                  disabled={disabled}
                  onChange={(event) => handleQueryChange(event.target.value)}
                  placeholder="Nhập địa chỉ để tìm gợi ý…"
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
                        disabled={disabled}
                        onClick={() => handleSuggestionPick(suggestion)}
                        className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-50"
                      >
                        <MapPinIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{suggestion.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {showNoResults && (
                <p className="text-sm text-muted-foreground">
                  Không tìm thấy địa chỉ phù hợp. Thử từ khóa khác hoặc chuyển sang ghim bản đồ.
                </p>
              )}

              {showSuggestions && searchFailed && (
                <p role="alert" className="text-sm text-destructive">
                  Không tìm được địa chỉ lúc này. Bạn vẫn có thể ghim trực tiếp trên bản đồ.
                </p>
              )}
            </div>
          </TabsContent>
        )}

        <TabsContent value="coordinates">
          <CoordinatesPanel
            location={location}
            invalid={invalid}
            disabled={disabled}
            onLocationChange={(point) => {
              setLookupError(null)
              onLocationChange(point)
            }}
          />
        </TabsContent>

        <TabsContent value="current">
          <CurrentLocationPanel
            locating={locating}
            geoError={geoError}
            geoAccuracy={geoAccuracy}
            location={location}
            disabled={disabled}
            onLocate={locateCurrentPosition}
          />
        </TabsContent>
      </Tabs>

      {hasMapbox && (
        <div
          className={cn(
            "h-72 overflow-hidden rounded-2xl border",
            invalid ? "border-destructive" : "border-border"
          )}
        >
          <LocationPickerMap value={location} onChange={handlePinChange} />
        </div>
      )}

      {location && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs">
          <span className="font-mono text-muted-foreground tabular-nums">
            Vĩ độ {location.latitude.toFixed(6)}, Kinh độ {location.longitude.toFixed(6)}
          </span>
          {hasMapbox && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              shape="pill"
              disabled={disabled || lookingUpAddress}
              onClick={() => fillAddressFromPoint(location)}
            >
              {lookingUpAddress && <Spinner aria-hidden />}
              Điền địa chỉ từ vị trí này
            </Button>
          )}
        </div>
      )}

      {lookupError && (
        <p role="alert" className="text-xs text-destructive">
          {lookupError}
        </p>
      )}
    </div>
  )
}

type CoordDraft = {
  sourceKey: string
  lat: string
  lng: string
}

function CoordinatesPanel({
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
  const sourceKey = formatSourceKey(location)
  const [draft, setDraft] = useState<CoordDraft>(() => ({
    sourceKey,
    lat: location ? String(location.latitude) : "",
    lng: location ? String(location.longitude) : "",
  }))

  const activeDraft =
    draft.sourceKey === sourceKey
      ? draft
      : {
          sourceKey,
          lat: location ? String(location.latitude) : "",
          lng: location ? String(location.longitude) : "",
        }

  const latParsed = parseCoordinate(activeDraft.lat, -90, 90)
  const lngParsed = parseCoordinate(activeDraft.lng, -180, 180)
  const latInvalid = activeDraft.lat.trim() !== "" && latParsed === null
  const lngInvalid = activeDraft.lng.trim() !== "" && lngParsed === null

  function updateField(field: "lat" | "lng", raw: string) {
    const nextLat = field === "lat" ? raw : activeDraft.lat
    const nextLng = field === "lng" ? raw : activeDraft.lng
    const parsedLat = parseCoordinate(nextLat, -90, 90)
    const parsedLng = parseCoordinate(nextLng, -180, 180)

    if (parsedLat !== null && parsedLng !== null) {
      const point: LngLat = { latitude: parsedLat, longitude: parsedLng }
      setDraft({ sourceKey: formatSourceKey(point), lat: nextLat, lng: nextLng })
      onLocationChange(point)
      return
    }

    setDraft({ sourceKey, lat: nextLat, lng: nextLng })
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text")
    const match = COORD_PAIR_RE.exec(text)
    if (!match) return
    const parsedLat = parseCoordinate(match[1], -90, 90)
    const parsedLng = parseCoordinate(match[2], -180, 180)
    if (parsedLat === null || parsedLng === null) return

    event.preventDefault()
    const point: LngLat = { latitude: parsedLat, longitude: parsedLng }
    setDraft({
      sourceKey: formatSourceKey(point),
      lat: String(parsedLat),
      lng: String(parsedLng),
    })
    onLocationChange(point)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="restaurant-lat" className="text-xs font-medium text-muted-foreground">
            Vĩ độ (Latitude, -90 đến 90)
          </label>
          <Input
            id="restaurant-lat"
            type="text"
            inputMode="decimal"
            value={activeDraft.lat}
            disabled={disabled}
            aria-invalid={invalid || latInvalid}
            placeholder="Ví dụ: 10.7769"
            onChange={(event) => updateField("lat", event.target.value)}
            onPaste={handlePaste}
          />
          {latInvalid && (
            <p className="text-xs text-destructive">Vĩ độ phải nằm trong khoảng -90 đến 90.</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="restaurant-lng" className="text-xs font-medium text-muted-foreground">
            Kinh độ (Longitude, -180 đến 180)
          </label>
          <Input
            id="restaurant-lng"
            type="text"
            inputMode="decimal"
            value={activeDraft.lng}
            disabled={disabled}
            aria-invalid={invalid || lngInvalid}
            placeholder="Ví dụ: 106.7009"
            onChange={(event) => updateField("lng", event.target.value)}
            onPaste={handlePaste}
          />
          {lngInvalid && (
            <p className="text-xs text-destructive">Kinh độ phải nằm trong khoảng -180 đến 180.</p>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Mẹo: có thể dán trực tiếp cặp tọa độ từ Google Maps (ví dụ: 10.7769, 106.7009).
      </p>
    </div>
  )
}

function CurrentLocationPanel({
  locating,
  geoError,
  geoAccuracy,
  location,
  disabled,
  onLocate,
}: {
  locating: boolean
  geoError: string | null
  geoAccuracy: number | null
  location: LngLat | null
  disabled: boolean
  onLocate: () => void
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-3">
      {locating && (
        <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner aria-hidden />
          Đang xác định vị trí hiện tại của thiết bị…
        </div>
      )}

      {geoError && (
        <p role="alert" className="text-sm text-destructive">
          {geoError}
        </p>
      )}

      {!locating && !geoError && location && (
        <p className="text-sm text-muted-foreground">
          Đã ghi nhận vị trí
          {geoAccuracy !== null ? ` (sai số khoảng ${geoAccuracy} m)` : ""}. Bạn có thể kéo ghim
          trên bản đồ nếu cần tinh chỉnh thêm.
        </p>
      )}

      {!locating && !geoError && !location && (
        <p className="text-sm text-muted-foreground">
          Dùng GPS hoặc vị trí trình duyệt để tự động đặt ghim nhà hàng tại chỗ bạn đang đứng.
        </p>
      )}

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          shape="pill"
          disabled={disabled || locating}
          onClick={onLocate}
        >
          {locating ? <Spinner aria-hidden /> : <LocateFixedIcon aria-hidden />}
          {currentButtonLabel(locating, location !== null)}
        </Button>
      </div>
    </div>
  )
}
