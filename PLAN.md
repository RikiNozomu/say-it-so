# Say-It-So — Racehorse 2D Match Engine: Project Plan

## Overview

A React-based web application and reusable library for visualising racehorse results as an animated 2D match replay. Single-page app. Users can draw a track, place horses, set keyframes for every horse at any point in time, and play back the race with measurement and analysis tools.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | React 18 + Vite | Fast DX, first-class TS |
| 2D Graphics | **react-konva** (Konva.js) | High-performance canvas, rich shape API, hit-testing, drag-drop |
| State | **useContext + useReducer** | Zero extra deps, one root reducer, React-native |
| Styling | **Tailwind CSS** | Utility-first, no CSS file sprawl |
| Colour Picker | **react-colorful** | Tiny, accessible |
| File I/O | Native `FileReader` / `Blob` | No dependency needed |
| Units | Custom hook `useUnit` | Centralised metric ↔ imperial conversion |
| Keyframe interpolation | Custom easing interpolator in `packages/core` | Cubic-bezier tween, no dep |

---

## Project Structure

```
say-it-so/
├── packages/
│   └── core/                        # Reusable lib: types, interpolation, measurement
│       ├── src/
│       │   ├── types.ts
│       │   ├── interpolate.ts
│       │   ├── measurement.ts
│       │   └── index.ts
│       └── package.json
└── apps/
    └── web/                         # Single-page Vite + React app
        ├── src/
        │   ├── context/
        │   │   ├── AppContext.tsx    # root context + dispatch export
        │   │   ├── reducer.ts        # single root useReducer
        │   │   └── actions.ts        # action type constants + creators
        │   ├── components/
        │   │   ├── canvas/
        │   │   │   ├── TrackCanvas.tsx       # Konva Stage, zoom/pan
        │   │   │   ├── RefImageLayer.tsx     # semi-transparent ref images
        │   │   │   ├── TrackLayer.tsx        # drawn track shapes
        │   │   │   ├── HorseLayer.tsx        # animated horse markers
        │   │   │   └── MeasurementLayer.tsx  # ruler overlay
        │   │   ├── panels/
        │   │   │   ├── HorsePanel.tsx        # add/edit/remove horses
        │   │   │   ├── TrackPanel.tsx        # drawing tools + ref image upload
        │   │   │   └── SettingsPanel.tsx     # units, zoom, autosave
        │   │   ├── timeline/
        │   │   │   ├── Timeline.tsx          # scrubber + keyframe rows
        │   │   │   ├── KeyframeMarker.tsx
        │   │   │   └── PlaybackControls.tsx
        │   │   ├── modals/
        │   │   │   └── HorseModal.tsx        # add / edit horse form
        │   │   └── toolbar/
        │   │       └── Toolbar.tsx           # top bar, save/load, unit toggle
        │   ├── hooks/
        │   │   ├── useUnit.ts
        │   │   ├── usePlayback.ts
        │   │   └── useMeasurement.ts
        │   ├── App.tsx
        │   └── main.tsx
        ├── index.html
        ├── vite.config.ts
        ├── tailwind.config.ts
        └── package.json
```

---

## Data Model (JSON schema saved to file)

```ts
// packages/core/src/types.ts

type UnitSystem = 'metric' | 'imperial';

type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'cubic-bezier';

interface Keyframe {
  time: number;           // seconds
  x: number;             // canvas-space pixels
  y: number;
  easing: EasingType;
  cubicBezier?: { x1: number; y1: number; x2: number; y2: number };
}

type StripePattern =
  | 'solid' | 'halved-h' | 'halved-v'
  | 'diagonal-left' | 'diagonal-right'
  | 'chevron-up' | 'chevron-down'
  | 'hoops' | 'quartered' | 'cross-sash'
  | 'dots' | 'stripes-h' | 'stripes-v' | 'stripes-diagonal'
  | 'panel-front' | 'panel-back' | 'sleeves-contrast'
  | 'star' | 'diamond'
  | 'seabiscuit' | 'royal' | 'emerald' | 'sunset' | 'monochrome';
  // 25 patterns total

interface Horse {
  id: string;
  number: number;         // 1–24, shown on marker
  name: string;
  jockey: string;
  stable: string;
  breeder: string;
  baseColor: string;     // hex
  stripeColor: string;   // hex
  pattern: StripePattern;
  keyframes: Keyframe[];
}

interface TrackShape {
  id: string;
  type: 'line' | 'bezier' | 'rect' | 'ellipse' | 'polygon';
  points: number[];
  stroke: string;
  strokeWidth: number;
  fill: string;
  closed: boolean;
  order: number;
}

interface RefImage {
  id: string;
  dataUrl: string;       // base64
  x: number; y: number;
  width: number; height: number;
  opacity: number;       // 0–1
  order: number;
  locked: boolean;
}

interface ProjectFile {
  version: '1';
  name: string;
  units: UnitSystem;
  duration: number;      // total race seconds
  canvasWidth: number;
  canvasHeight: number;
  trackScale: number;    // pixels per metre
  horses: Horse[];       // max 24
  trackShapes: TrackShape[];
  refImages: RefImage[];
}
```

---

## App State Shape (AppContext)

```ts
interface AppState {
  // project meta
  projectName: string;
  units: UnitSystem;
  canvasWidth: number;
  canvasHeight: number;
  trackScale: number;
  duration: number;

  // canvas
  zoom: number;
  panX: number;
  panY: number;
  activeTool: 'select' | 'line' | 'bezier' | 'rect' | 'ellipse' | 'polygon' | 'measure' | 'ruler';

  // data
  horses: Horse[];
  trackShapes: TrackShape[];
  refImages: RefImage[];

  // timeline
  currentTime: number;
  playbackState: 'idle' | 'playing' | 'paused';

  // UI
  selectedHorseId: string | null;
  selectedShapeId: string | null;
  activePanel: 'horses' | 'track' | 'settings';
}
```

One root `reducer.ts` handles all action types. `AppContext` provides `{ state, dispatch }`.

---

## Feature Breakdown

### 1. Canvas Editor (TrackCanvas)
- Konva `Stage` with zoom/pan via `scaleX/scaleY` and `x/y` offset
- Zoom: mouse-wheel + toolbar +/- buttons (0.1× – 10×), fit-to-window, 100%
- Layers (bottom → top):
  1. `RefImageLayer` — uploaded images with opacity & z-order
  2. `TrackLayer` — drawn shapes
  3. `HorseLayer` — animated horse markers at `currentTime`
  4. `MeasurementLayer` — ruler overlay

### 2. Horse Markers (HorseLayer)
- Each horse rendered as a **Konva Group**: circular badge + number text + stripe pattern
- **25 stripe pattern templates** drawn procedurally with Konva shapes (no image assets)
- User picks `baseColor`, `stripeColor`, and `pattern` independently
- Draggable when `playbackState !== 'playing'` → auto-inserts/updates keyframe at `currentTime`

### 3. Horse Manager (HorsePanel + HorseModal)
- Sidebar list of all horses (max 24)
- Add button → `HorseModal` form: number, name, jockey, stable, breeder, baseColor, stripeColor, pattern
- Click horse row → edit modal
- Delete icon → confirm then remove horse + all its keyframes
- Pattern picker: grid of 25 small canvas previews

### 4. Track Drawing (TrackPanel)
- Tool palette: Select | Line | Bezier | Rect | Ellipse | Polygon
- Ref image upload: drag-drop or file picker → base64, stored in state
- Per-image controls: opacity slider, order (up/down), x/y/w/h inputs, lock toggle
- Track shapes: stroke colour, stroke width, fill, order buttons, delete

### 5. Timeline & Keyframes
- Horizontal scrubber bar (0 → `duration`)
- One lane per horse with diamond ◆ keyframe markers
- Click on scrubber → seek `currentTime`
- Drag keyframe marker left/right → change its `time`
- Right-click keyframe → context menu: Delete / Change Easing
- Easing picker: linear, ease-in, ease-out, ease-in-out, cubic-bezier (with 4-handle editor)

### 6. Playback Controls
| Button | Action |
|---|---|
| ⏮ Rewind | `currentTime = 0` |
| ◀◀ Back | `currentTime -= 5s` |
| ▶ Play | start rAF loop |
| ⏸ Pause | stop loop, keep time |
| ▶▶ Forward | `currentTime += 5s` |
| ⏹ Stop | stop loop + `currentTime = 0` |

### 7. Measurement Tool
- **Ruler mode**: click two canvas points → shows distance in current unit
- **Speed mode**: select horse + drag time range on timeline → shows avg speed
- Measurements persist as an overlay layer until cleared
- Units: m / km / km·h⁻¹ (metric) or ft / mi / mph (imperial)

### 8. Save / Load JSON
- **Save**: serialise `AppState` → `ProjectFile` → `Blob` → download `<name>.sayitso.json`
- **Load**: file picker → `FileReader` → parse → `dispatch({ type: 'LOAD_PROJECT', payload })`
- **Auto-save**: debounced write to `localStorage` on every state change

### 9. Unit System
- All internal values stored in **metres** and **seconds**
- `useUnit` hook: `toDisplay(m)`, `fromDisplay(v)`, `speedLabel`, `distLabel`
- Toggle in toolbar, persisted in project file

### 10. Zoom
- Stage scale 0.1× – 10×
- Mouse-wheel: zoom toward cursor (transforms pointer → stage coords)
- Toolbar: +, −, Fit, 100%

---

## Implementation Phases

| Phase | Work |
|---|---|
| 1 | Scaffold monorepo, packages/core types + interpolation + measurement |
| 2 | AppContext/reducer, Vite+React+Tailwind app shell, basic layout |
| 3 | TrackCanvas: Konva Stage, zoom/pan, RefImageLayer, TrackLayer drawing tools |
| 4 | HorseLayer: 25 stripe patterns rendered procedurally, draggable |
| 5 | HorsePanel + HorseModal: full CRUD, pattern picker |
| 6 | Timeline: scrubber, keyframe lanes, drag markers, easing editor |
| 7 | Playback: rAF loop, all controls |
| 8 | Measurement: ruler tool, speed calculator |
| 9 | Save/Load JSON, unit switcher, auto-save |
| 10 | Polish: keyboard shortcuts, responsive, accessibility |

---

## Design Decisions (confirmed)
1. Track is always **fully visible** — no reveal animation.
2. Horse markers: **numbered circle + stripe pattern**. 25 built-in templates, user picks base + stripe colour independently.
3. Full easing: linear, ease-in, ease-out, ease-in-out, cubic-bezier.
4. Maximum **24 horses** per project.
5. State via **useContext + useReducer** — no Zustand or other state lib.
6. **Single-page app** inside a monorepo (packages/core + apps/web).
