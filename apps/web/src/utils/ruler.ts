import type { PenAnchor } from './pen'
import type { RulerUnit } from '@say-it-so/core'

export type { RulerUnit }

const SAMPLES = 50

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

export function penPathLengthPx(anchors: PenAnchor[], closed = false): number {
  if (anchors.length < 2) return 0
  const segCount = closed ? anchors.length : anchors.length - 1
  let total = 0
  for (let i = 0; i < segCount; i++) {
    const a = anchors[i]
    const b = anchors[(i + 1) % anchors.length]
    let prev = { x: a.x, y: a.y }
    for (let j = 1; j <= SAMPLES; j++) {
      const pt = bezierPt(j / SAMPLES, a.x, a.y, a.cpOut.x, a.cpOut.y, b.cpIn.x, b.cpIn.y, b.x, b.y)
      total += Math.hypot(pt.x - prev.x, pt.y - prev.y)
      prev = pt
    }
  }
  return total
}

export function samplePathAtRatio(anchors: PenAnchor[], ratio: number, closed = false): { x: number; y: number } {
  if (anchors.length === 0) return { x: 0, y: 0 }
  if (anchors.length === 1) return { x: anchors[0].x, y: anchors[0].y }

  const totalLen = penPathLengthPx(anchors, closed)
  const target = totalLen * Math.max(0, Math.min(1, ratio))
  const segCount = closed ? anchors.length : anchors.length - 1
  let accumulated = 0

  for (let i = 0; i < segCount; i++) {
    const a = anchors[i]
    const b = anchors[(i + 1) % anchors.length]
    let prev = { x: a.x, y: a.y }
    for (let j = 1; j <= SAMPLES; j++) {
      const pt = bezierPt(j / SAMPLES, a.x, a.y, a.cpOut.x, a.cpOut.y, b.cpIn.x, b.cpIn.y, b.x, b.y)
      const segLen = Math.hypot(pt.x - prev.x, pt.y - prev.y)
      if (accumulated + segLen >= target) {
        const t = segLen > 0 ? (target - accumulated) / segLen : 0
        return { x: prev.x + (pt.x - prev.x) * t, y: prev.y + (pt.y - prev.y) * t }
      }
      accumulated += segLen
      prev = pt
    }
  }

  const last = anchors[anchors.length - 1]
  return { x: last.x, y: last.y }
}

export function intervalToPx(interval: number, unit: RulerUnit, pixelsPerMetre: number): number {
  switch (unit) {
    case 'px':  return interval
    case 'm':   return interval * pixelsPerMetre
    case 'mi':  return interval * 1609.344 * pixelsPerMetre
    case 'fur': return interval * 201.168  * pixelsPerMetre
  }
}

export function formatRulerLength(pixels: number, unit: RulerUnit, pixelsPerMetre: number): string {
  switch (unit) {
    case 'px':  return `${Math.round(pixels)} px`
    case 'm':   return `${(pixels / pixelsPerMetre).toFixed(1)} m`
    case 'mi':  return `${(pixels / pixelsPerMetre / 1609.344).toFixed(3)} mi`
    case 'fur': return `${(pixels / pixelsPerMetre / 201.168).toFixed(2)} fur`
  }
}
