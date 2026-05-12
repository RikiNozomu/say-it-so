import { useApp } from '../context/AppContext'
import { metresToFeet, metresToMiles } from '@say-it-so/core'

export function useUnit() {
  const { state } = useApp()
  const imperial = state.units === 'imperial'

  return {
    distanceLabel: imperial ? 'ft' : 'm',
    longDistanceLabel: imperial ? 'mi' : 'km',
    speedLabel: imperial ? 'mph' : 'km/h',

    toDisplayDistance(metres: number): number {
      return imperial ? metresToFeet(metres) : metres
    },
    toDisplayLongDistance(metres: number): number {
      return imperial ? metresToMiles(metres) : metres / 1000
    },
    toDisplaySpeed(mps: number): number {
      return imperial ? mps * 2.23694 : mps * 3.6
    },
    formatDistance(metres: number, decimals = 1): string {
      const v = imperial ? metresToFeet(metres) : metres
      return `${v.toFixed(decimals)} ${imperial ? 'ft' : 'm'}`
    },
    formatSpeed(mps: number, decimals = 1): string {
      const v = imperial ? mps * 2.23694 : mps * 3.6
      return `${v.toFixed(decimals)} ${imperial ? 'mph' : 'km/h'}`
    },
  }
}
