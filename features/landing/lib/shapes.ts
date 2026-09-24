/**
 * Point-cloud targets for the landing particle scene. Every shape returns the
 * same number of points so the shader can morph between them index by index.
 */

type Vec3 = [number, number, number]
type Rand = () => number
type Sampler = (r: Rand) => Vec3

/** Small seeded PRNG so the shapes are identical on every load. */
function mulberry32(seed: number): Rand {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(r: Rand, parts: Array<[number, T]>): T {
  const total = parts.reduce((sum, [weight]) => sum + weight, 0)
  let roll = r() * total
  for (const [weight, value] of parts) {
    roll -= weight
    if (roll <= 0) return value
  }
  return parts[parts.length - 1][1]
}

function sample(count: number, seed: number, parts: Array<[number, Sampler]>) {
  const r = mulberry32(seed)
  const out = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    out.set(pick(r, parts)(r), i * 3)
  }
  return out
}

const jitter = (r: Rand, amount: number) => (r() * 2 - 1) * amount

function rotateX([x, y, z]: Vec3, a: number): Vec3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [x, y * c - z * s, y * s + z * c]
}

function rotateY([x, y, z]: Vec3, a: number): Vec3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [x * c + z * s, y, -x * s + z * c]
}

function rotateZ([x, y, z]: Vec3, a: number): Vec3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [x * c - y * s, x * s + y * c, z]
}

/* Leaf ------------------------------------------------------------------- */

/** Half-width along the midrib, widest a little below the middle. */
function leafWidth(u: number) {
  const s = (u + 1) / 2
  return 0.46 * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.8)), 0.9)
}

/** Leaf in local space: base at u = -1, tip at u = 1, lying along x. */
function leafAt(u: number, v: number, r: Rand): Vec3 {
  const w = leafWidth(u)
  return [
    u,
    v * w - 0.12 * u * u,
    0.35 * v * v * w - 0.08 * u + jitter(r, 0.015),
  ]
}

const leafLocal: Sampler = (r) =>
  pick<Sampler>(r, [
    [0.52, () => leafAt(r() * 2 - 1, r() * 2 - 1, r)],
    [0.22, () => leafAt(r() * 2 - 1, r() < 0.5 ? -1 : 1, r)],
    [0.1, () => leafAt(r() * 2 - 1, jitter(r, 0.03), r)],
    [0.03, () => [-1 - r() * 0.35, jitter(r, 0.015), jitter(r, 0.015)]],
    [
      0.13,
      () => {
        const start = -0.8 + r() * 1.45
        const t = r()
        return leafAt(Math.min(start + t * 0.32, 1), (r() < 0.5 ? -1 : 1) * t * 0.9, r)
      },
    ],
  ])(r)

export function leafShape(count: number) {
  return sample(count, 11, [
    [1, (r) => {
      const [x, y, z] = leafLocal(r)
      return rotateY(rotateZ([x * 2.15, y * 2.15, z * 2.15], 0.62), -0.35)
    }],
  ])
}

/* Heart ------------------------------------------------------------------ */

function heartAt(t: number, s: number): [number, number] {
  const x = 16 * Math.pow(Math.sin(t), 3)
  const y =
    13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
  const k = 1.95 / 16
  return [x * s * k, (y * s + 2.5) * k]
}

export function heartShape(count: number) {
  return sample(count, 23, [
    [0.3, (r) => {
      const [x, y] = heartAt(r() * Math.PI * 2, 1)
      return [x, y, jitter(r, 0.08)]
    }],
    [0.7, (r) => {
      const s = Math.sqrt(r())
      const [x, y] = heartAt(r() * Math.PI * 2, s)
      const puff = Math.sqrt(Math.max(0, 1 - s * s)) * 0.75
      return [x, y, (r() < 0.5 ? -1 : 1) * puff + jitter(r, 0.03)]
    }],
  ])
}

/* Globe ------------------------------------------------------------------ */

function onSphere(r: Rand): Vec3 {
  const u = r() * 2 - 1
  const a = r() * Math.PI * 2
  const q = Math.sqrt(1 - u * u)
  return [q * Math.cos(a), u, q * Math.sin(a)]
}

/** Cheap trig "noise" that reads as landmasses on the sphere. */
function land([x, y, z]: Vec3) {
  return (
    Math.sin(3 * x + 1.3) * Math.sin(2.6 * y + 0.4) * Math.sin(3.1 * z + 2.1) +
    0.45 * Math.sin(5.3 * x + 2.2 * z) * Math.cos(4.1 * y - 0.7)
  )
}

export function globeShape(count: number) {
  const radius = 1.72
  return sample(count, 37, [
    [0.72, (r) => {
      let p = onSphere(r)
      // Thin out the oceans so continents stand out.
      while (land(p) < 0.05 && r() < 0.72) p = onSphere(r)
      const lift = land(p) > 0.05 ? 1.03 : 1
      return [p[0] * radius * lift, p[1] * radius * lift, p[2] * radius * lift]
    }],
    [0.18, (r) => {
      const a = r() * Math.PI * 2
      const d = 2.45 + jitter(r, 0.06)
      return rotateZ(rotateX([Math.cos(a) * d, jitter(r, 0.02), Math.sin(a) * d], 1.25), 0.32)
    }],
    [0.1, (r) => {
      const p = onSphere(r)
      const d = radius * (1.12 + r() * 0.35)
      return [p[0] * d, p[1] * d, p[2] * d]
    }],
  ])
}

/* Feed cards ------------------------------------------------------------- */

const W = 1.05
const H = 1.35

function cardOutline(r: Rand): [number, number] {
  const perimeter = 2 * (W + H)
  const d = r() * perimeter * 2
  if (d < 2 * W) return [-W + d, H]
  if (d < 4 * W) return [-W + (d - 2 * W), -H]
  if (d < 4 * W + 2 * H) return [-W, -H + (d - 4 * W)]
  return [W, -H + (d - 4 * W - 2 * H)]
}

const cardLocal: Sampler = (r) => {
  const [x, y] = pick<() => [number, number]>(r, [
    [0.34, () => cardOutline(r)],
    [0.06, () => {
      const a = r() * Math.PI * 2
      const d = 0.17 * Math.sqrt(r())
      return [-0.75 + Math.cos(a) * d, 1.05 + Math.sin(a) * d]
    }],
    [0.05, () => [-0.45 + r() * 0.85, 1.08 + jitter(r, 0.02)]],
    [0.33, () => [-0.9 + r() * 1.8, -0.35 + r() * 1.15]],
    [0.13, () => {
      const line = r() < 0.5
      return [-0.9 + r() * (line ? 1.8 : 1.2), (line ? -0.6 : -0.8) + jitter(r, 0.02)]
    }],
    [0.09, () => {
      const a = r() * Math.PI * 2
      const d = 0.07 * Math.sqrt(r())
      const slot = Math.floor(r() * 3)
      return [-0.7 + slot * 0.5 + Math.cos(a) * d, -1.1 + Math.sin(a) * d]
    }],
  ])()
  return [x, y, jitter(r, 0.015)]
}

export function cardsShape(count: number) {
  return sample(count, 41, [
    [1, (r) => {
      const k = Math.floor(r() * 3) - 1
      const [x, y, z] = cardLocal(r)
      const p: Vec3 = [x + k * 0.5, y - k * 0.32, z + k * 0.85]
      return rotateX(rotateY(p, -0.5), 0.18)
    }],
  ])
}

/* Sprout ----------------------------------------------------------------- */

const stemTop: Vec3 = [0.15 * Math.sin(Math.PI * 1.2), 0.55, 0]

function sproutLeaf(r: Rand, angle: number, size: number): Vec3 {
  const [x, y, z] = leafLocal(r)
  const p = rotateZ([(x + 1) * size, y * size, z * size], angle)
  return [p[0] + stemTop[0], p[1] + stemTop[1], p[2]]
}

export function sproutShape(count: number) {
  return sample(count, 53, [
    [0.2, (r) => {
      const t = r()
      return [
        0.15 * Math.sin(t * Math.PI * 1.2) + jitter(r, 0.03),
        -1.7 + t * 2.25,
        jitter(r, 0.03),
      ]
    }],
    [0.28, (r) => rotateY(sproutLeaf(r, 2.55, 0.95), 0.3)],
    [0.28, (r) => rotateY(sproutLeaf(r, 0.5, 0.8), -0.3)],
    [0.24, (r) => {
      const a = r() * Math.PI * 2
      const d = 1.9 * Math.sqrt(r())
      return [Math.cos(a) * d, -1.7 + jitter(r, 0.04) * (1 - d / 2), Math.sin(a) * d * 0.9]
    }],
  ])
}
