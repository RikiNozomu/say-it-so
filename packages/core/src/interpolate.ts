import type { Keyframe, EasingType, CubicBezierParams } from './types'

function cubicBezier(params: CubicBezierParams, t: number): number {
  const { x1, y1, x2, y2 } = params
  // Newton-Raphson approximation for CSS cubic-bezier
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t
  const derivX = (t: number) => (3 * ax * t + 2 * bx) * t + cx

  // solve for t given x
  let u = t
  for (let i = 0; i < 8; i++) {
    const x = sampleX(u) - t
    const d = derivX(u)
    if (Math.abs(d) < 1e-6) break
    u -= x / d
  }
  return sampleY(u)
}

function applyEasing(t: number, easing: EasingType, cbParams?: CubicBezierParams): number {
  switch (easing) {
    case 'linear': return t
    case 'ease-in': return t * t * t
    case 'ease-out': return 1 - Math.pow(1 - t, 3)
    case 'ease-in-out': return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    case 'cubic-bezier':
      return cbParams ? cubicBezier(cbParams, t) : t
    default: return t
  }
}

export interface Position {
  x: number
  y: number
}

export function interpolatePosition(keyframes: Keyframe[], time: number): Position {
  if (keyframes.length === 0) return { x: 0, y: 0 }

  const sorted = [...keyframes].sort((a, b) => a.time - b.time)

  if (time <= sorted[0].time) return { x: sorted[0].x, y: sorted[0].y }
  if (time >= sorted[sorted.length - 1].time) {
    const last = sorted[sorted.length - 1]
    return { x: last.x, y: last.y }
  }

  let before = sorted[0]
  let after = sorted[1]
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].time <= time && sorted[i + 1].time >= time) {
      before = sorted[i]
      after = sorted[i + 1]
      break
    }
  }

  const span = after.time - before.time
  if (span === 0) return { x: after.x, y: after.y }

  const rawT = (time - before.time) / span
  const easedT = applyEasing(rawT, before.easing, before.cubicBezier)

  return {
    x: before.x + (after.x - before.x) * easedT,
    y: before.y + (after.y - before.y) * easedT,
  }
}
