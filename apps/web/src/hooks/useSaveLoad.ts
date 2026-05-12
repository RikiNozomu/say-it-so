import { useApp } from '../context/AppContext'
import type { ProjectFile } from '@say-it-so/core'

export function useSaveLoad() {
  const { state, dispatch } = useApp()

  function save() {
    const file: ProjectFile = {
      version: '1',
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
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${state.projectName.replace(/\s+/g, '_')}.sayitso.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function load() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,.sayitso.json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const payload = JSON.parse(e.target?.result as string) as ProjectFile
          dispatch({ type: 'LOAD_PROJECT', payload })
        } catch {
          alert('Invalid project file')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  return { save, load }
}
