import type { PenAnchor, TrackShape } from '@say-it-so/core'

export type { PenAnchor }

/** Convert any non-ellipse shape to pen anchors for editing. Returns null for ellipse. */
export function shapeToPenAnchors(shape: TrackShape): PenAnchor[] | null {
  if (shape.type === 'ellipse') return null
  if (shape.type === 'pen') return shape.penAnchors ?? null
  const pts = shape.points
  if (shape.type === 'rect' && pts.length >= 4) {
    const [x, y, w, h] = pts
    return [
      { x, y,         cpIn: { x, y },         cpOut: { x, y } },
      { x: x+w, y,    cpIn: { x: x+w, y },    cpOut: { x: x+w, y } },
      { x: x+w, y:y+h, cpIn: { x: x+w, y:y+h }, cpOut: { x: x+w, y:y+h } },
      { x, y:y+h,     cpIn: { x, y:y+h },     cpOut: { x, y:y+h } },
    ]
  }
  // line, bezier, polygon — flat [x0,y0,x1,y1,…]
  const anchors: PenAnchor[] = []
  for (let i = 0; i + 1 < pts.length; i += 2) {
    const ax = pts[i], ay = pts[i+1]
    anchors.push({ x: ax, y: ay, cpIn: { x: ax, y: ay }, cpOut: { x: ax, y: ay } })
  }
  return anchors.length >= 2 ? anchors : null
}

// When cpOut is degenerate (retracted to anchor) but cpIn is not, reflect cpIn
// to get the natural outgoing tangent direction.
function effectiveCpOut(a: PenAnchor): { x: number; y: number } {
  if (a.cpOut.x === a.x && a.cpOut.y === a.y && (a.cpIn.x !== a.x || a.cpIn.y !== a.y)) {
    return { x: 2 * a.x - a.cpIn.x, y: 2 * a.y - a.cpIn.y }
  }
  return a.cpOut
}

export function anchorsToPath(anchors: PenAnchor[], closed: boolean): string {
  if (anchors.length < 2) return ''
  let d = `M ${anchors[0].x} ${anchors[0].y}`
  for (let i = 1; i < anchors.length; i++) {
    const prev = anchors[i - 1]
    const curr = anchors[i]
    const cp1 = effectiveCpOut(prev)
    d += ` C ${cp1.x} ${cp1.y} ${curr.cpIn.x} ${curr.cpIn.y} ${curr.x} ${curr.y}`
  }
  if (closed) {
    const prev = anchors[anchors.length - 1]
    const first = anchors[0]
    const cp1 = effectiveCpOut(prev)
    d += ` C ${cp1.x} ${cp1.y} ${first.cpIn.x} ${first.cpIn.y} ${first.x} ${first.y} Z`
  }
  return d
}
