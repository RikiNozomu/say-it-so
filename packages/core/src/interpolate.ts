import type { Keyframe } from './types'

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

function cpOut(kf: Keyframe): { x: number; y: number } {
  return kf.cpOut ?? { x: kf.x, y: kf.y }
}

function cpIn(kf: Keyframe): { x: number; y: number } {
  return kf.cpIn ?? { x: kf.x, y: kf.y }
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

  const t = (time - before.time) / span

  const p1 = cpOut(before)
  const p2 = cpIn(after)

  return cubicBezierPos(t, before.x, before.y, p1.x, p1.y, p2.x, p2.y, after.x, after.y)
}
