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

// When cpOut is degenerate but cpIn is not, reflect cpIn for natural outgoing tangent
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
      if (si > 0 && j === 0) continue // skip duplicate junction point
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

// Linearly interpolate width at a given t along the path (anchors are evenly spaced in t)
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

// Intersection of two infinite lines: line1 through p in direction d, line2 through q in direction e
function lineLine(
  p: { x: number; y: number }, d: { x: number; y: number },
  q: { x: number; y: number }, e: { x: number; y: number },
): { x: number; y: number } | null {
  const denom = d.x * e.y - d.y * e.x
  if (Math.abs(denom) < 1e-8) return null
  const t = ((q.x - p.x) * e.y - (q.y - p.y) * e.x) / denom
  return { x: p.x + t * d.x, y: p.y + t * d.y }
}

// Threshold: cos of ~14° — only triggers at sharp segment junctions, not within smooth bezier segments
const CORNER_DOT = 0.97
const MITER_LIMIT = 8  // max miter distance as multiple of track half-width at the corner

// Post-process an offset edge array to produce proper miter joins at sharp corners.
// leftSide=true means this is the left (nx=-ty, ny=tx) offset edge.
function fixEdgeCorners(
  pts: { x: number; y: number }[],
  samples: SamplePoint[],
  widths: number[],
  anchorCount: number,
  leftSide: boolean,
): { x: number; y: number }[] {
  const result: { x: number; y: number }[] = []
  let skipNext = false

  for (let k = 0; k < pts.length; k++) {
    if (skipNext) { skipNext = false; continue }

    if (k < pts.length - 1) {
      // Normal vectors at k and k+1
      const n1x = -samples[k].ty,     n1y = samples[k].tx
      const n2x = -samples[k + 1].ty, n2y = samples[k + 1].tx
      const dot = n1x * n2x + n1y * n2y

      if (dot < CORNER_DOT) {
        // Cross product of tangents: positive = turning left (in screen coords: turning CW)
        const cross = samples[k].tx * samples[k + 1].ty - samples[k].ty * samples[k + 1].tx
        // left side is outside when cross > 0; right side is outside when cross < 0
        const isOutside = leftSide ? (cross > 0) : (cross < 0)

        const miter = lineLine(
          pts[k],     { x: samples[k].tx,     y: samples[k].ty },
          pts[k + 1], { x: samples[k + 1].tx, y: samples[k + 1].ty },
        )

        if (miter) {
          // Miter limit check: reject if too far from junction
          const anchorX = (samples[k].x + samples[k + 1].x) / 2
          const anchorY = (samples[k].y + samples[k + 1].y) / 2
          const hw = interpolateWidth(samples[k].t, widths, anchorCount) / 2
          const miterDist = Math.hypot(miter.x - anchorX, miter.y - anchorY)

          if (miterDist <= hw * MITER_LIMIT) {
            if (isOutside) {
              // Outside corner: insert miter point between k and k+1
              result.push(pts[k])
              result.push(miter)
            } else {
              // Inside corner: replace k and k+1 with single miter point
              result.push(miter)
              skipNext = true
            }
            continue
          }
        }
      }
    }

    result.push(pts[k])
  }

  return result
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

  // Apply miter joins at sharp corners (segment junctions)
  const fixedLeft  = fixEdgeCorners(left,  samples, widths, anchorCount, true)
  const fixedRight = fixEdgeCorners(right, samples, widths, anchorCount, false)

  if (side === 'left') {
    return fixedLeft.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  }
  if (side === 'right') {
    return fixedRight.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  }
  // fill: left forward + right backward = closed polygon
  const pts = [
    ...fixedLeft.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`),
    ...[...fixedRight].reverse().map(p => `L ${p.x} ${p.y}`),
    'Z',
  ]
  return pts.join(' ')
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
