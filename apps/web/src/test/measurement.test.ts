import { describe, it, expect } from 'vitest'
import { pixelDistance, measureDistance, measureTrackLength, metresToFeet, metresToMiles, feetToMetres } from '@say-it-so/core'

describe('pixelDistance', () => {
  it('returns 0 for same point', () => {
    expect(pixelDistance(3, 4, 3, 4)).toBe(0)
  })

  it('returns 5 for a 3-4-5 right triangle', () => {
    expect(pixelDistance(0, 0, 3, 4)).toBe(5)
  })

  it('is symmetric', () => {
    expect(pixelDistance(1, 2, 5, 6)).toBeCloseTo(pixelDistance(5, 6, 1, 2))
  })
})

describe('measureDistance', () => {
  it('converts pixel distance to metres using scale', () => {
    const result = measureDistance(0, 0, 100, 0, 10)
    expect(result.pixels).toBe(100)
    expect(result.metres).toBe(10)
  })
})

describe('measureTrackLength', () => {
  it('returns 0 for a single point', () => {
    const result = measureTrackLength([{ x: 0, y: 0 }], 10)
    expect(result.pixels).toBe(0)
  })

  it('sums segment lengths', () => {
    const pts = [{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 6, y: 8 }]
    const result = measureTrackLength(pts, 5)
    expect(result.pixels).toBeCloseTo(10)
    expect(result.metres).toBeCloseTo(2)
  })
})

describe('unit conversions', () => {
  it('metresToFeet', () => expect(metresToFeet(1)).toBeCloseTo(3.28084))
  it('metresToMiles', () => expect(metresToMiles(1609.344)).toBeCloseTo(1))
  it('feetToMetres', () => expect(feetToMetres(3.28084)).toBeCloseTo(1))
  it('metresToFeet and feetToMetres are inverses', () => {
    expect(feetToMetres(metresToFeet(42))).toBeCloseTo(42)
  })
})
