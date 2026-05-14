import { useState } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { Toolbar } from './components/toolbar/Toolbar'
import { TrackCanvas } from './components/canvas/TrackCanvas'
import { HorsePanel } from './components/panels/HorsePanel'
import { TrackPanel } from './components/panels/TrackPanel'
import { SettingsPanel } from './components/panels/SettingsPanel'
import { LayersPanel } from './components/panels/LayersPanel'
import { Timeline } from './components/timeline/Timeline'
import { PlaybackControls } from './components/timeline/PlaybackControls'

function Layout() {
  const { state } = useApp()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const panels = {
    race: <HorsePanel />,
    track: <TrackPanel />,
    settings: <SettingsPanel />, // kept in map so reducer switch still compiles
  }

  const isTrack = state.activePanel === 'track'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top toolbar */}
      <Toolbar onSettingsClick={() => setSettingsOpen(true)} />

      {/* Middle: side panel + canvas */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <aside className="w-56 shrink-0 bg-panel border-r border-border flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto min-h-0">
            {panels[state.activePanel]}
          </div>
          {isTrack && <LayersPanel />}
        </aside>
        <TrackCanvas />
      </div>

      {/* Bottom: playback + timeline — hidden during track editing */}
      {!isTrack && (
        <div className="shrink-0 flex flex-col bg-panel border-t border-border" style={{ height: 200 }}>
          <PlaybackControls />
          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 px-4">
            <Timeline />
          </div>
        </div>
      )}

      {/* Settings modal */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setSettingsOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" />

          {/* Panel */}
          <div
            className="relative z-10 w-96 max-h-[80vh] overflow-y-auto bg-panel border border-border rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-white">Settings</span>
              <button
                onClick={() => setSettingsOpen(false)}
                className="text-zinc-400 hover:text-white transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>
            <SettingsPanel />
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Layout />
    </AppProvider>
  )
}
