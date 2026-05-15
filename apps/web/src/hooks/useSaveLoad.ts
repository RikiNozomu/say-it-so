import { useApp } from '../context/AppContext'
import { JSON_FILE_VERSION } from '@say-it-so/core'
import type { ProjectFile, TrackFile, RaceFile } from '@say-it-so/core'

function normalizeVersion(raw: unknown): number {
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string') return parseInt(raw, 10) || 1
  return 1  // missing version → treat as version 1
}

async function writeFile(filename: string, data: object): Promise<void> {
  const json = JSON.stringify(data, null, 2)

  if ('showSaveFilePicker' in window) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'Say It So file', accept: { 'application/json': ['.json'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(json)
      await writable.close()
      return
    } catch (e: unknown) {
      if ((e as { name?: string }).name === 'AbortError') return
      // fall through to anchor download
    }
  }

  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function readFile(): Promise<string | null> {
  if ('showOpenFilePicker' in window) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [handle] = await (window as any).showOpenFilePicker({
        types: [{ description: 'Say It So file', accept: { 'application/json': ['.json'] } }],
        multiple: false,
      })
      const file = await handle.getFile()
      return await file.text()
    } catch (e: unknown) {
      if ((e as { name?: string }).name === 'AbortError') return null
      // fall through to input fallback
    }
  }

  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) { resolve(null); return }
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result as string ?? null)
      reader.readAsText(file)
    }
    input.click()
  })
}

function slug(name: string) {
  return name.trim().replace(/\s+/g, '_') || 'Project'
}

export function useSaveLoad() {
  const { state, dispatch } = useApp()

  async function saveAll() {
    const file: ProjectFile = {
      version: JSON_FILE_VERSION,
      name: state.projectName,
      units: state.units,
      duration: state.duration,
      canvasWidth: state.canvasWidth,
      canvasHeight: state.canvasHeight,
      trackScale: state.trackScale,
      horses: state.horses,
      trackShapes: state.trackShapes,
      refImages: state.refImages,
    }
    await writeFile(`${slug(state.projectName)}.sayitso.json`, file)
  }

  async function saveTrack() {
    const file: TrackFile = {
      version: JSON_FILE_VERSION,
      fileType: 'track',
      name: state.projectName,
      units: state.units,
      duration: state.duration,
      canvasWidth: state.canvasWidth,
      canvasHeight: state.canvasHeight,
      trackScale: state.trackScale,
      trackShapes: state.trackShapes,
      refImages: state.refImages,
    }
    await writeFile(`${slug(state.projectName)}_track.sayitso.json`, file)
  }

  async function saveRace() {
    const file: RaceFile = {
      version: JSON_FILE_VERSION,
      fileType: 'race',
      name: state.projectName,
      horses: state.horses,
    }
    await writeFile(`${slug(state.projectName)}_race.sayitso.json`, file)
  }

  async function loadAll() {
    const text = await readFile()
    if (!text) return
    try {
      const raw = JSON.parse(text)
      if (raw.fileType === 'track') {
        alert('This is a track-only file. Use "Load → Track only" instead.')
        return
      }
      if (raw.fileType === 'race') {
        alert('This is a race-only file. Use "Load → Race only" instead.')
        return
      }
      const payload: ProjectFile = {
        ...raw,
        version: normalizeVersion(raw.version),
        horses: raw.horses ?? [],
        trackShapes: raw.trackShapes ?? [],
        refImages: raw.refImages ?? [],
      }
      dispatch({ type: 'LOAD_PROJECT', payload })
    } catch {
      alert('Invalid project file')
    }
  }

  async function loadTrack() {
    const text = await readFile()
    if (!text) return
    try {
      const raw = JSON.parse(text)
      if (raw.fileType !== 'track') {
        if (!raw.fileType) {
          alert('This is a full project file. Use "Load → All" instead.')
        } else {
          alert('This is a race-only file. Use "Load → Race only" instead.')
        }
        return
      }
      const payload: TrackFile = {
        ...raw,
        version: normalizeVersion(raw.version),
        trackShapes: raw.trackShapes ?? [],
        refImages: raw.refImages ?? [],
      }
      dispatch({ type: 'LOAD_TRACK', payload })
    } catch {
      alert('Invalid track file')
    }
  }

  async function loadRace() {
    const text = await readFile()
    if (!text) return
    try {
      const raw = JSON.parse(text)
      if (raw.fileType !== 'race') {
        if (!raw.fileType) {
          alert('This is a full project file. Use "Load → All" instead.')
        } else {
          alert('This is a track-only file. Use "Load → Track only" instead.')
        }
        return
      }
      const payload: RaceFile = {
        ...raw,
        version: normalizeVersion(raw.version),
        horses: raw.horses ?? [],
      }
      dispatch({ type: 'LOAD_RACE', payload })
    } catch {
      alert('Invalid race file')
    }
  }

  return { saveAll, saveTrack, saveRace, loadAll, loadTrack, loadRace }
}
