import type { PenAnchor } from './pen'
import type { TrackUnit } from '@say-it-so/core'

export type { TrackUnit }

const SAMPLES_PER_SEG = 60

interface SamplePoint {
  x: number
  y: number
  tx: number  // tangent x (normalised)
  ty: number  // tangent y (normalised)
  t: number   // global t in [0,1] along the path
}

function bezierPt(
  t: number,
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
  dx: number, dy: number,
): { x: number; y: number } {
  const mt = 1 - t
  return {
    x: mt * mt * mt * ax + 3 * mt * mt * t * bx + 3 * mt * t * t * cx + t * t * t * dx,
    y: mt * mt * mt * ay + 3 * mt * mt * t * by + 3 * mt * t * t * cy + t * t * t * dy,
  }
}

function bezierTangent(
  t: number,
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
  dx: number, dy: number,
): { x: number; y: number } {
  const mt = 1 - t
  const tx = 3 * mt * mt * (bx - ax) + 6 * mt * t * (cx - bx) + 3 * t * t * (dx - cx)
  const ty = 3 * mt * mt * (by - ay) + 6 * mt * t * (cy - by) + 3 * t * t * (dy - cy)
  const len = Math.hypot(tx, ty) || 1
  return { x: tx / len, y: ty / len }
}

function effectiveCpOut(a: PenAnchor): { x: number; y: number } {
  if (a.cpOut.x === a.x && a.cpOut.y === a.y && (a.cpIn.x !== a.x || a.cpIn.y !== a.y)) {
    return { x: 2 * a.x - a.cpIn.x, y: 2 * a.y - a.cpIn.y }
  }
  return a.cpOut
}

export function sampleTrackPath(anchors: PenAnchor[]): SamplePoint[] {
  if (anchors.length < 2) return []
  const points: SamplePoint[] = []
  const segCount = anchors.length - 1
  let totalLen = 0

  interface RawPt { x: number; y: number; tx: number; ty: number; cum: number }
  const raw: RawPt[] = []

  for (let si = 0; si < segCount; si++) {
    const a = anchors[si]
    const b = anchors[si + 1]
    const cp1 = effectiveCpOut(a)
    const cp2 = b.cpIn
    for (let j = 0; j <= SAMPLES_PER_SEG; j++) {
      const t = j / SAMPLES_PER_SEG
      const pt = bezierPt(t, a.x, a.y, cp1.x, cp1.y, cp2.x, cp2.y, b.x, b.y)
      const tan = bezierTangent(t, a.x, a.y, cp1.x, cp1.y, cp2.x, cp2.y, b.x, b.y)
      if (si > 0 && j === 0) continue
      const prev = raw[raw.length - 1]
      const segLen = prev ? Math.hypot(pt.x - prev.x, pt.y - prev.y) : 0
      totalLen += segLen
      raw.push({ x: pt.x, y: pt.y, tx: tan.x, ty: tan.y, cum: totalLen })
    }
  }

  for (const r of raw) {
    points.push({ x: r.x, y: r.y, tx: r.tx, ty: r.ty, t: totalLen > 0 ? r.cum / totalLen : 0 })
  }
  return points
}

// Binary-search samples (sorted by s.t arc-length ratio) to get the tangent at a given ratio.
// This is correct even on sharp curves where bezier-parameter samples are non-uniformly spaced.
export function tangentAtRatio(samples: SamplePoint[], ratio: number): { tx: number; ty: number } {
  if (samples.length === 0) return { tx: 1, ty: 0 }
  let lo = 0, hi = samples.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (samples[mid].t < ratio) lo = mid + 1
    else hi = mid
  }
  return { tx: samples[lo].tx, ty: samples[lo].ty }
}

export function interpolateWidth(t: number, widths: number[], anchorCount: number): number {
  if (!widths || widths.length === 0) return 20
  if (widths.length === 1) return widths[0]
  const segCount = anchorCount - 1
  if (segCount <= 0) return widths[0]
  const pos = t * segCount
  const lo = Math.min(Math.floor(pos), segCount - 1)
  const hi = Math.min(lo + 1, widths.length - 1)
  const frac = pos - lo
  return (widths[lo] ?? widths[widths.length - 1]) * (1 - frac) + (widths[hi] ?? widths[widths.length - 1]) * frac
}

export function buildTrackPolygon(
  samples: SamplePoint[],
  widths: number[],
  anchorCount: number,
  side: 'fill' | 'left' | 'right',
  borderExtra = 0,
): string {
  if (samples.length < 2) return ''

  const left: { x: number; y: number }[] = []
  const right: { x: number; y: number }[] = []

  for (const s of samples) {
    const hw = interpolateWidth(s.t, widths, anchorCount) / 2 + borderExtra
    const nx = -s.ty
    const ny = s.tx
    left.push({ x: s.x + nx * hw, y: s.y + ny * hw })
    right.push({ x: s.x - nx * hw, y: s.y - ny * hw })
  }

  if (side === 'left') {
    return left.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  }
  if (side === 'right') {
    return right.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  }
  const pts = [
    ...left.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`),
    ...[...right].reverse().map(p => `L ${p.x} ${p.y}`),
    'Z',
  ]
  return pts.join(' ')
}

// Width of track at each intermediate anchor, used to size junction discs
export function anchorHalfWidths(
  anchors: PenAnchor[],
  widths: number[],
  borderExtra: number,
): { x: number; y: number; hw: number }[] {
  const result: { x: number; y: number; hw: number }[] = []
  const count = anchors.length
  // Only interior anchors (not start/end) need gap-filling discs
  for (let i = 1; i < count - 1; i++) {
    const t = i / (count - 1)
    const hw = interpolateWidth(t, widths, count) / 2 + borderExtra
    result.push({ x: anchors[i].x, y: anchors[i].y, hw })
  }
  return result
}

export function trackWidthToPx(value: number, unit: TrackUnit, pixelsPerMetre: number): number {
  switch (unit) {
    case 'px': return value
    case 'm':  return value * pixelsPerMetre
    case 'mi': return value * 1609.344 * pixelsPerMetre
  }
}

export function pxToTrackWidth(px: number, unit: TrackUnit, pixelsPerMetre: number): number {
  switch (unit) {
    case 'px': return px
    case 'm':  return px / pixelsPerMetre
    case 'mi': return px / 1609.344 / pixelsPerMetre
  }
}

export function formatTrackWidth(px: number, unit: TrackUnit, pixelsPerMetre: number): string {
  switch (unit) {
    case 'px': return `${Math.round(px)} px`
    case 'm':  return `${(px / pixelsPerMetre).toFixed(1)} m`
    case 'mi': return `${(px / pixelsPerMetre / 1609.344).toFixed(3)} mi`
  }
}
