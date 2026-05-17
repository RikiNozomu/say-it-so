import type { EaseType, Keyframe } from './types'

export interface Position {
  x: number
  y: number
}

// Evaluate a cubic bezier at parameter t in [0,1].
// P0 = start, P1 = cpOut of start keyframe, P2 = cpIn of end keyframe, P3 = end
function cubicBezierPos(
  t: number,
  p0x: number, p0y: number,
  p1x: number, p1y: number,
  p2x: number, p2y: number,
  p3x: number, p3y: number,
): Position {
  const mt = 1 - t
  return {
    x: mt**3*p0x + 3*mt**2*t*p1x + 3*mt*t**2*p2x + t**3*p3x,
    y: mt**3*p0y + 3*mt**2*t*p1y + 3*mt*t**2*p2y + t**3*p3y,
  }
}

// Temporal easing — remaps t in [0,1] based on ease type
function applyEase(t: number, ease: EaseType | undefined): number {
  switch (ease) {
    case 'ease-in':     return t * t * t
    case 'ease-out':    return 1 - (1 - t) ** 3
    case 'ease-in-out': return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
    default:            return t  // linear
  }
}

function hasSpatialCurve(before: Keyframe, after: Keyframe): boolean {
  const outLive = !!before.cpOut && (before.cpOut.x !== before.x || before.cpOut.y !== before.y)
  const inLive  = !!after.cpIn   && (after.cpIn.x   !== after.x  || after.cpIn.y   !== after.y)
  return outLive && inLive
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
  let after  = sorted[1]
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].time <= time && sorted[i + 1].time >= time) {
      before = sorted[i]
      after  = sorted[i + 1]
      break
    }
  }

  const span = after.time - before.time
  if (span === 0) return { x: after.x, y: after.y }

  const tRaw = (time - before.time) / span
  const t = applyEase(tRaw, before.ease)

  if (hasSpatialCurve(before, after)) {
    const p1 = before.cpOut ?? { x: before.x, y: before.y }
    const p2 = after.cpIn   ?? { x: after.x,  y: after.y  }
    return cubicBezierPos(t, before.x, before.y, p1.x, p1.y, p2.x, p2.y, after.x, after.y)
  }

  // Linear spatial interpolation
  return {
    x: before.x + (after.x - before.x) * t,
    y: before.y + (after.y - before.y) * t,
  }
}
