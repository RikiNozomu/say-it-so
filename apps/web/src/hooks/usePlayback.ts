import { useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'

export function usePlayback() {
  const { state, dispatch } = useApp()

  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number | null>(null)

  // Keep refs in sync so the rAF loop always reads the latest values
  // without depending on the closure captured at effect-start time.
  const currentTimeRef = useRef(state.currentTime)
  const durationRef = useRef(state.duration)
  const speedRef = useRef(state.playbackSpeed)
  useEffect(() => { currentTimeRef.current = state.currentTime }, [state.currentTime])
  useEffect(() => { durationRef.current = state.duration }, [state.duration])
  useEffect(() => { speedRef.current = state.playbackSpeed }, [state.playbackSpeed])

  useEffect(() => {
    if (state.playbackState !== 'playing') {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
        lastTimeRef.current = null
      }
      return
    }

    const tick = (now: number) => {
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      const dt = (now - lastTimeRef.current) / 1000
      lastTimeRef.current = now

      const next = currentTimeRef.current + dt * speedRef.current

      if (next >= durationRef.current) {
        dispatch({ type: 'SET_CURRENT_TIME', time: durationRef.current })
        dispatch({ type: 'SET_PLAYBACK_STATE', state: 'idle' })
        return
      }

      dispatch({ type: 'SET_CURRENT_TIME', time: next })
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
        lastTimeRef.current = null
      }
    }
  }, [state.playbackState, dispatch])

  return {
    play:        () => dispatch({ type: 'SET_PLAYBACK_STATE', state: 'playing' }),
    pause:       () => dispatch({ type: 'SET_PLAYBACK_STATE', state: 'paused' }),
    stop:        () => {
      dispatch({ type: 'SET_PLAYBACK_STATE', state: 'idle' })
      dispatch({ type: 'SET_CURRENT_TIME', time: 0 })
    },
    rewind:      () => dispatch({ type: 'SET_CURRENT_TIME', time: 0 }),
    fastForward: () => dispatch({ type: 'SET_CURRENT_TIME', time: durationRef.current }),
    skipBack:    () => dispatch({ type: 'SET_CURRENT_TIME', time: Math.max(0, currentTimeRef.current - 5) }),
    skipForward: () => dispatch({ type: 'SET_CURRENT_TIME', time: Math.min(durationRef.current, currentTimeRef.current + 5) }),
  }
}
