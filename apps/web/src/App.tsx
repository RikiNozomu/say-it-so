import { useState, useCallback } from 'react'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import { AppProvider, useApp } from './context/AppContext'
import { Toolbar } from './components/toolbar/Toolbar'
import { TrackCanvas } from './components/canvas/TrackCanvas'
import { HorsePanel } from './components/panels/HorsePanel'
import { TrackPanel } from './components/panels/TrackPanel'
import { PreviewPanel } from './components/panels/PreviewPanel'
import { SettingsPanel } from './components/panels/SettingsPanel'
import { LayersPanel } from './components/panels/LayersPanel'
import { Timeline } from './components/timeline/Timeline'
import { PlaybackControls } from './components/timeline/PlaybackControls'

function Layout() {
  const { state, dispatch } = useApp()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [previewMinimized, setPreviewMinimized] = useState(false)

  const isTrack = state.activePanel === 'track'
  const isPreview = state.activePanel === 'preview'

  const handleStartRace = useCallback(() => {
    dispatch({ type: 'SET_PLAYBACK_STATE', state: 'idle' })
    dispatch({ type: 'SET_CURRENT_TIME', time: -state.preRaceTime })
    dispatch({ type: 'SET_PLAYBACK_STATE', state: 'playing' })
  }, [dispatch, state.preRaceTime])

  const sidePanelContent = isPreview
    ? <PreviewPanel onStartRace={handleStartRace} />
    : isTrack
    ? <TrackPanel />
    : <HorsePanel />

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Toolbar onSettingsClick={() => setSettingsOpen(true)} />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar — collapsible in preview mode */}
        {isPreview ? (
          previewMinimized ? (
            <div className="shrink-0 w-8 bg-panel border-r border-border flex flex-col items-center pt-2">
              <button
                onClick={() => setPreviewMinimized(false)}
                className="text-zinc-400 hover:text-white transition-colors"
                title="Expand panel"
              >
                <FiChevronRight size={16} />
              </button>
            </div>
          ) : (
            <aside className="w-56 shrink-0 bg-panel border-r border-border flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-2 py-1 border-b border-border shrink-0">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Preview</span>
                <button
                  onClick={() => setPreviewMinimized(true)}
                  className="text-zinc-400 hover:text-white transition-colors"
                  title="Minimize panel"
                >
                  <FiChevronLeft size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden min-h-0">
                {sidePanelContent}
              </div>
            </aside>
          )
        ) : (
          <aside className="w-56 shrink-0 bg-panel border-r border-border flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto min-h-0">
              {sidePanelContent}
            </div>
            {isTrack && <LayersPanel />}
          </aside>
        )}

        <div className="flex-1 relative overflow-hidden">
          <TrackCanvas />
        </div>
      </div>

      {/* Bottom: playback + timeline */}
      {!isTrack && (
        <div
          className="shrink-0 flex flex-col bg-panel border-t border-border"
          style={{ height: isPreview ? 'auto' : 200 }}
        >
          <PlaybackControls />
          {!isPreview && (
            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 px-4">
              <Timeline />
            </div>
          )}
        </div>
      )}

      {/* Settings modal */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setSettingsOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60" />
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
