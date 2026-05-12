import type { Keyframe } from './types'
import { interpolatePosition } from './interpolate'

export interface DistanceResult {
  metres: number
  pixels: number
}

export interface SpeedResult {
  metresPerSecond: number
  kmPerHour: number
  milesPerHour: number
}

export function pixelDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
}

export function measureDistance(
  x1: number, y1: number,
  x2: number, y2: number,
  pixelsPerMetre: number,
): DistanceResult {
  const pixels = pixelDistance(x1, y1, x2, y2)
  return { pixels, metres: pixels / pixelsPerMetre }
}

export function measureTrackLength(
  points: { x: number; y: number }[],
  pixelsPerMetre: number,
): DistanceResult {
  let pixels = 0
  for (let i = 1; i < points.length; i++) {
    pixels += pixelDistance(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y)
  }
  return { pixels, metres: pixels / pixelsPerMetre }
}

export function measureHorseSpeed(
  keyframes: Keyframe[],
  t1: number,
  t2: number,
  pixelsPerMetre: number,
): SpeedResult {
  const dt = Math.abs(t2 - t1)
  if (dt === 0) return { metresPerSecond: 0, kmPerHour: 0, milesPerHour: 0 }

  const p1 = interpolatePosition(keyframes, Math.min(t1, t2))
  const p2 = interpolatePosition(keyframes, Math.max(t1, t2))
  const metres = pixelDistance(p1.x, p1.y, p2.x, p2.y) / pixelsPerMetre
  const mps = metres / dt

  return {
    metresPerSecond: mps,
    kmPerHour: mps * 3.6,
    milesPerHour: mps * 2.23694,
  }
}

export function metresToFeet(m: number): number { return m * 3.28084 }
export function metresToMiles(m: number): number { return m / 1609.344 }
export function feetToMetres(ft: number): number { return ft / 3.28084 }
