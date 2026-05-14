import { describe, it, expect } from 'vitest'
import { interpolatePosition } from '@say-it-so/core'

describe('interpolatePosition', () => {
  it('returns origin when no keyframes', () => {
    expect(interpolatePosition([], 0)).toEqual({ x: 0, y: 0 })
  })

  it('returns the only keyframe position for any time', () => {
    const kfs = [{ time: 1, x: 10, y: 20 }]
    expect(interpolatePosition(kfs, 0)).toEqual({ x: 10, y: 20 })
    expect(interpolatePosition(kfs, 5)).toEqual({ x: 10, y: 20 })
  })

  it('clamps to first keyframe before its time', () => {
    const kfs = [{ time: 2, x: 5, y: 5 }, { time: 4, x: 10, y: 10 }]
    expect(interpolatePosition(kfs, 0)).toEqual({ x: 5, y: 5 })
  })

  it('clamps to last keyframe after its time', () => {
    const kfs = [{ time: 2, x: 5, y: 5 }, { time: 4, x: 10, y: 10 }]
    expect(interpolatePosition(kfs, 10)).toEqual({ x: 10, y: 10 })
  })

  it('linearly interpolates midpoint without control points', () => {
    const kfs = [{ time: 0, x: 0, y: 0 }, { time: 2, x: 10, y: 20 }]
    const mid = interpolatePosition(kfs, 1)
    // Without cpOut/cpIn, control points collapse to the anchor → linear
    expect(mid.x).toBeCloseTo(5)
    expect(mid.y).toBeCloseTo(10)
  })

  it('handles unsorted keyframes', () => {
    const kfs = [{ time: 4, x: 10, y: 10 }, { time: 0, x: 0, y: 0 }]
    const mid = interpolatePosition(kfs, 2)
    expect(mid.x).toBeCloseTo(5)
    expect(mid.y).toBeCloseTo(5)
  })
})
