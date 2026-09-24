"use client"

import { useEffect, useRef, type RefObject } from "react"
import * as THREE from "three"

import {
  cardsShape,
  globeShape,
  heartShape,
  leafShape,
  sproutShape,
} from "@/features/landing/lib/shapes"
import type { Soundscape } from "@/features/landing/lib/soundscape"

/** Where the cloud sits for each story stage, in fractions of the viewport. */
type Stage = { x: number; y: number; scale: number; opacity: number }

const DESKTOP_STAGES: Stage[] = [
  { x: 0.42, y: 0, scale: 1, opacity: 1 }, // leaf, beside the hero copy
  { x: 0.44, y: 0, scale: 1, opacity: 1 }, // heart, beside chapter 01
  { x: -0.44, y: 0, scale: 1.05, opacity: 1 }, // globe, beside chapter 02
  { x: 0.05, y: 0, scale: 1.3, opacity: 0.3 }, // cards, behind the carousel
  { x: 0, y: 0.4, scale: 0.72, opacity: 1 }, // sprout, clear above the CTA
]

// On phones the cloud can't sit beside the copy, so it only takes the stage in
// the hero and the closing, and stays a faint backdrop behind the chapters.
const MOBILE_STAGES: Stage[] = [
  { x: 0, y: 0.5, scale: 0.54, opacity: 1 },
  { x: 0, y: 0.3, scale: 0.6, opacity: 0.14 },
  { x: 0, y: 0.3, scale: 0.6, opacity: 0.14 },
  { x: 0, y: 0.1, scale: 0.8, opacity: 0.1 },
  { x: 0, y: 0.4, scale: 0.55, opacity: 1 },
]

/**
 * Per-stage colors: brand greens throughout, with an accent share that tells
 * the chapter (tomato flecks in the heart, ocean in the globe, soil in the
 * sprout).
 */
type Palette = { a: string; b: string; accent: string; ratio: number }

const PALETTES: Record<"light" | "dark", Palette[]> = {
  light: [
    { a: "#006045", b: "#00bc7d", accent: "#e1731a", ratio: 0.07 },
    { a: "#006045", b: "#00a36c", accent: "#e0433a", ratio: 0.38 },
    { a: "#0b5563", b: "#00bc7d", accent: "#2f7fc1", ratio: 0.3 },
    { a: "#006045", b: "#00bc7d", accent: "#e1731a", ratio: 0.05 },
    { a: "#006045", b: "#2fbf71", accent: "#a86a1c", ratio: 0.16 },
  ],
  dark: [
    { a: "#009966", b: "#5ee9b5", accent: "#fbbf24", ratio: 0.07 },
    { a: "#009966", b: "#5ee9b5", accent: "#ff6b5b", ratio: 0.38 },
    { a: "#0e8f8f", b: "#5ee9b5", accent: "#60a5fa", ratio: 0.3 },
    { a: "#009966", b: "#5ee9b5", accent: "#fbbf24", ratio: 0.05 },
    { a: "#009966", b: "#86efac", accent: "#d6a15a", ratio: 0.16 },
  ],
}

// Ashima 3D simplex noise (MIT), used for the flow field between shapes.
const noise = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0)) +
      i.y + vec4(0.0, i1.y, i2.y, 1.0)) +
      i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  vec3 flow(vec3 p) {
    return vec3(
      snoise(p),
      snoise(p + vec3(17.1, 3.7, 9.2)),
      snoise(p + vec3(-8.3, 21.4, 4.6))
    );
  }
`

const vertexShader = /* glsl */ `
  attribute vec3 aP1;
  attribute vec3 aP2;
  attribute vec3 aP3;
  attribute vec3 aP4;
  attribute float aRand;

  uniform float uProgress;
  uniform float uTime;
  uniform float uMotion;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uVelocity;
  uniform vec3 uPointer;
  uniform float uPointerStrength;

  varying float vRand;
  varying float vDepth;
  varying float vGlow;

  ${noise}

  float ease(float t) { return t * t * (3.0 - 2.0 * t); }

  // Staggered 0..1 for the morph out of shape k.
  float stage(float k) {
    return ease(clamp((uProgress - k) * 1.4 - aRand * 0.4, 0.0, 1.0));
  }

  vec3 rotateY(vec3 p, float a) {
    float c = cos(a);
    float s = sin(a);
    return vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
  }

  void main() {
    // Heart: a double "lub-dub" every beat.
    float phase = fract(uTime * 0.85);
    float beat = exp(-phase * 16.0) * 0.07 + exp(-abs(phase - 0.2) * 22.0) * 0.045;
    vec3 heart = aP1 * (1.0 + beat * uMotion);

    // Globe: slow spin on its axis.
    vec3 globe = rotateY(aP2, uTime * 0.22 * uMotion);

    // Cards: each layer bobs on its own phase.
    vec3 cards = aP3 + vec3(0.0, sin(uTime * 0.9 + aP3.z * 2.2) * 0.06 * uMotion, 0.0);

    // Sprout: grows from the soil up, so the leaves unfold last.
    float height = clamp((aP4.y + 1.75) / 3.6, 0.0, 1.0);
    float grow = ease(clamp((uProgress - 3.0) * 2.0 - height * 0.8 - aRand * 0.2, 0.0, 1.0));

    float t1 = stage(0.0);
    float t2 = stage(1.0);
    float t3 = stage(2.0);

    vec3 pos = position;
    pos = mix(pos, heart, t1);
    pos = mix(pos, globe, t2);
    pos = mix(pos, cards, t3);
    pos = mix(pos, aP4, grow);

    // Particles in flight ride a noise field instead of flying straight.
    float flight = max(max(sin(t1 * 3.14159), sin(t2 * 3.14159)),
                       max(sin(t3 * 3.14159), sin(grow * 3.14159)));
    vec3 field = flow(pos * 0.45 + vec3(0.0, uTime * 0.15, uProgress * 0.8));
    pos += field * (flight * 1.1 + uVelocity * 0.45 + 0.035 * uMotion);

    // Push particles away from the cursor.
    vec3 away = pos - uPointer;
    float reach = smoothstep(1.1, 0.0, length(away.xy));
    pos += normalize(away + vec3(0.0001)) * reach * uPointerStrength * 0.55;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float near = smoothstep(-11.0, -6.0, mv.z);
    gl_PointSize = uSize * uPixelRatio * (0.55 + aRand * 0.9) * (0.8 + near * 0.5) / -mv.z;

    vRand = aRand;
    vDepth = mv.z;
    vGlow = flight + reach * uPointerStrength;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uAccent;
  uniform float uAccentRatio;
  uniform float uOpacity;

  varying float vRand;
  varying float vDepth;
  varying float vGlow;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;

    vec3 color = vRand > 1.0 - uAccentRatio ? uAccent : mix(uColorA, uColorB, vRand);
    color = mix(color, uColorB, clamp(vGlow, 0.0, 1.0) * 0.35);
    float near = smoothstep(-11.0, -6.5, vDepth);
    gl_FragColor = vec4(color, smoothstep(0.5, 0.1, d) * uOpacity * (0.4 + 0.6 * near));
  }
`

const smoothstep = (t: number) => t * t * (3 - 2 * t)

// The sprout's soil sits at y = -1.7 and its leaves reach about 1.9 above it.
const SPROUT_SOIL = -1.7
const SPROUT_HEIGHT = 3.6
// Space kept clear between the soil and the closing copy, and under the
// header, as fractions of the viewport height.
const SPROUT_GAP = 0.08
const SPROUT_CEILING = 0.12

/** Index and eased fraction between the two stages around `progress`. */
function between(progress: number, count: number) {
  const clamped = Math.min(Math.max(progress, 0), count - 1)
  const i = Math.min(Math.floor(clamped), count - 2)
  return { i, e: smoothstep(clamped - i) }
}

function lerpStage(stages: Stage[], progress: number): Stage {
  const { i, e } = between(progress, stages.length)
  const a = stages[i]
  const b = stages[i + 1]
  return {
    x: a.x + (b.x - a.x) * e,
    y: a.y + (b.y - a.y) * e,
    scale: a.scale + (b.scale - a.scale) * e,
    opacity: a.opacity + (b.opacity - a.opacity) * e,
  }
}

/**
 * Full-screen particle cloud that morphs leaf → heart → globe → feed cards →
 * sprout. `progress` (0–4) is written by the page's ScrollTriggers; the scene
 * eases toward it every frame.
 */
export function ParticleScene({
  progress,
  anchor,
  sound,
}: {
  progress: RefObject<number>
  /** The closing copy: the sprout is planted just above it, fit to the room left. */
  anchor?: RefObject<HTMLElement | null>
  /** Driven from this render loop so audio stays in step with the visuals. */
  sound?: RefObject<Soundscape | null>
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
    } catch {
      return // No WebGL: the story still reads without the scene.
    }

    const isSmall = () => window.innerWidth < 768
    // Phones get fewer, lower-resolution particles to spare the GPU and battery.
    const count = isSmall() ? 3500 : 9000
    const pixelRatio = Math.min(window.devicePixelRatio, isSmall() ? 1.5 : 2)
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)")

    renderer.setPixelRatio(pixelRatio)
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50)
    camera.position.z = 9

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute("position", new THREE.BufferAttribute(leafShape(count), 3))
    geometry.setAttribute("aP1", new THREE.BufferAttribute(heartShape(count), 3))
    geometry.setAttribute("aP2", new THREE.BufferAttribute(globeShape(count), 3))
    geometry.setAttribute("aP3", new THREE.BufferAttribute(cardsShape(count), 3))
    geometry.setAttribute("aP4", new THREE.BufferAttribute(sproutShape(count), 3))
    const rands = new Float32Array(count)
    for (let i = 0; i < count; i++) rands[i] = Math.random()
    geometry.setAttribute("aRand", new THREE.BufferAttribute(rands, 1))
    // Particles drift off their shapes, so never cull by the leaf's bounds.
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100)

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uMotion: { value: reduceMotion.matches ? 0 : 1 },
        uSize: { value: 30 },
        uPixelRatio: { value: pixelRatio },
        uVelocity: { value: 0 },
        uPointer: { value: new THREE.Vector3(99, 99, 0) },
        uPointerStrength: { value: 0 },
        uOpacity: { value: 1 },
        uColorA: { value: new THREE.Color() },
        uColorB: { value: new THREE.Color() },
        uAccent: { value: new THREE.Color() },
        uAccentRatio: { value: 0.07 },
      },
    })

    const group = new THREE.Group()
    group.add(new THREE.Points(geometry, material))
    scene.add(group)

    // Glow additively on dark surfaces, blend normally on light ones.
    let palettes = PALETTES.light
    const applyTheme = () => {
      const dark = document.documentElement.classList.contains("dark")
      palettes = dark ? PALETTES.dark : PALETTES.light
      material.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending
      material.needsUpdate = true
    }
    applyTheme()
    const themeObserver = new MutationObserver(applyTheme)
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    const from = new THREE.Color()
    const to = new THREE.Color()
    const blendPalette = (at: number) => {
      const { i, e } = between(at, palettes.length)
      const a = palettes[i]
      const b = palettes[i + 1]
      const u = material.uniforms
      u.uColorA.value.copy(from.set(a.a)).lerp(to.set(b.a), e)
      u.uColorB.value.copy(from.set(a.b)).lerp(to.set(b.b), e)
      u.uAccent.value.copy(from.set(a.accent)).lerp(to.set(b.accent), e)
      u.uAccentRatio.value = a.ratio + (b.ratio - a.ratio) * e
    }

    let halfW = 1
    let halfH = 1
    let size = ""
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = container
      // Mobile browsers fire resize as the toolbar hides; skip no-op resizes.
      if (`${w}x${h}` === size) return
      size = `${w}x${h}`
      renderer.setSize(w, h, false)
      renderer.domElement.style.width = "100%"
      renderer.domElement.style.height = "100%"
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z
      halfW = halfH * camera.aspect
    }
    resize()
    window.addEventListener("resize", resize)

    const pointer = { x: 0, y: 0, active: false }
    const onPointerMove = (event: PointerEvent) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1
      pointer.active = event.pointerType === "mouse"
    }
    const onPointerLeave = () => {
      pointer.active = false
    }
    window.addEventListener("pointermove", onPointerMove)
    document.documentElement.addEventListener("pointerleave", onPointerLeave)

    const raycaster = new THREE.Raycaster()
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    const ndc = new THREE.Vector2()
    const hit = new THREE.Vector3()

    const timer = new THREE.Timer()
    let current = 0
    let velocity = 0
    let lastScroll = window.scrollY
    let frame = 0

    const tick = (time: number) => {
      frame = requestAnimationFrame(tick)
      timer.update(time)
      const dt = Math.min(timer.getDelta(), 0.1)
      const elapsed = timer.getElapsed()
      const motion = reduceMotion.matches ? 0 : 1
      const u = material.uniforms

      // Ease toward the scroll position so scrubbing never feels jumpy.
      current += (progress.current - current) * (1 - Math.exp(-dt * 5))

      // Fast scrolling stirs the cloud; it settles once scrolling stops.
      const scrollY = window.scrollY
      const speed = dt > 0 ? Math.abs(scrollY - lastScroll) / dt : 0
      lastScroll = scrollY
      velocity += (Math.min(speed / 2500, 1) - velocity) * (1 - Math.exp(-dt * 4))

      const stage = lerpStage(isSmall() ? MOBILE_STAGES : DESKTOP_STAGES, current)
      const fit = Math.min(1, camera.aspect / 1.3, halfH / 2.6)
      let y = stage.y * halfH
      let opacity = stage.opacity
      let scale = stage.scale * Math.max(fit, 0.6)

      // Plant the sprout relative to the closing copy rather than the viewport,
      // so the gap holds on any screen height.
      const landing = smoothstep(Math.min(Math.max(current - 3, 0), 1))
      if (landing > 0 && anchor?.current) {
        const h = container.clientHeight
        const toWorld = (px: number) => halfH - (px / h) * 2 * halfH
        const soil = toWorld(anchor.current.getBoundingClientRect().top) + SPROUT_GAP * 2 * halfH
        const room = toWorld(h * SPROUT_CEILING) - soil
        const fits = room / SPROUT_HEIGHT
        const planted = Math.max(Math.min(scale, fits), 0.3)
        y += (soil - SPROUT_SOIL * planted - y) * landing
        scale += (planted - scale) * landing
        // Too little room to show it whole: fade it rather than crowd the header.
        opacity *= 1 - landing * (1 - Math.min(Math.max(fits / 0.3, 0), 1))
      }
      group.position.set(stage.x * halfW, y, 0)
      group.scale.setScalar(scale)
      group.rotation.y +=
        (Math.sin(elapsed * 0.3) * 0.35 * motion + pointer.x * 0.35 - group.rotation.y) *
        (1 - Math.exp(-dt * 3))
      group.rotation.x += (pointer.y * 0.18 - group.rotation.x) * (1 - Math.exp(-dt * 3))
      group.updateMatrixWorld()

      // Cursor position on the cloud's plane, in the cloud's own space.
      ndc.set(pointer.x, -pointer.y)
      raycaster.setFromCamera(ndc, camera)
      if (raycaster.ray.intersectPlane(plane, hit)) {
        u.uPointer.value.copy(group.worldToLocal(hit))
      }
      const push = pointer.active ? motion : 0
      u.uPointerStrength.value += (push - u.uPointerStrength.value) * (1 - Math.exp(-dt * 4))

      blendPalette(current)
      u.uProgress.value = current
      u.uTime.value = elapsed
      u.uMotion.value = motion
      u.uVelocity.value = velocity * motion
      u.uOpacity.value = opacity

      renderer.render(scene, camera)

      sound?.current?.update({
        progress: current,
        velocity: velocity * motion,
        time: elapsed,
        motion,
      })
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      themeObserver.disconnect()
      window.removeEventListener("resize", resize)
      window.removeEventListener("pointermove", onPointerMove)
      document.documentElement.removeEventListener("pointerleave", onPointerLeave)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [progress, anchor, sound])

  return <div ref={containerRef} aria-hidden className="size-full" />
}
