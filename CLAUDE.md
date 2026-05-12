# CLAUDE.md — Say It So · Racehorse Match Engine

Agent context file. Read this before touching any code.

---

## Project Overview

Browser-based 2D racehorse animation tool. Users draw a track, add horses with custom silk patterns, set keyframes on a timeline, and play back the race. Single-page app, no backend.

**Owner:** Riki · rikinozomu2022@gmail.com  
**Repo:** https://github.com/RikiNozomu/say-it-so  
**Stack:** React 18 + TypeScript · Konva/react-konva · Tailwind CSS · Vite · pnpm workspaces

---

## Monorepo Structure

```
say-it-so/
├── packages/core/          # Shared types only (no logic)
│   └── src/types.ts
└── apps/web/src/
    ├── context/
    │   ├── AppContext.tsx   # useReducer + undo/redo + localStorage autosave
    │   ├── reducer.ts       # single root reducer, all AppState
    │   └── actions.ts       # Action union type, ActiveTool type
    ├── components/
    │   ├── canvas/
    │   │   ├── TrackCanvas.tsx      # Konva Stage, all drawing interactions
    │   │   ├── UnifiedLayer.tsx     # renders shapes + ref images in z-order
    │   │   ├── EditOverlay.tsx      # pen path vertex editing layer
    │   │   ├── HorseLayer.tsx       # animated horse markers
    │   │   └── MeasurementLayer.tsx # ruler overlay
    │   ├── panels/
    │   │   ├── TrackPanel.tsx       # draw tools + shape/image properties
    │   │   ├── HorsePanel.tsx       # horse CRUD + silk picker
    │   │   ├── LayersPanel.tsx      # layer list: reorder/lock/hide/delete
    │   │   └── SettingsPanel.tsx    # units, canvas size, duration
    │   ├── timeline/
    │   │   ├── Timeline.tsx         # scrubber + keyframe lanes + playhead
    │   │   └── PlaybackControls.tsx # transport buttons + speed controls
    │   └── toolbar/
    │       └── Toolbar.tsx          # top bar, save/load, panel switcher
    ├── hooks/
    │   └── usePlayback.ts   # rAF loop, multiplies dt by playbackSpeed
    └── utils/
        └── pen.ts           # anchorsToPath(), shapeToPenAnchors()
```

---

## AppState (reducer.ts)

```ts
interface AppState {
  // project
  projectName: string; units: 'metric'|'imperial'
  canvasWidth: number; canvasHeight: number
  trackScale: number; duration: number

  // view
  zoom: number; panX: number; panY: number
  activeTool: ActiveTool   // 'select'|'pen'|'rect'|'ellipse'|'polygon'|'measure'|'image'
  activePanel: 'horses'|'track'

  // data
  horses: Horse[]; trackShapes: TrackShape[]; refImages: RefImage[]

  // selection
  selectedHorseId: string|null; selectedShapeId: string|null
  selectedRefImageId: string|null; editingShapeId: string|null
  polygonSides: number   // 3–32

  // playback
  currentTime: number; playbackState: 'idle'|'playing'|'paused'
  playbackSpeed: number  // default 1, applied as dt multiplier in rAF
}
```

---

## Key Patterns

### Event flow — canvas interactions
- All mouse events are on the Konva `<Stage>` in `TrackCanvas.tsx`
- `handleMouseDown` returns early if `state.editingShapeId` is set — all events go to `EditOverlay` instead
- `EditOverlay` has a full-coverage transparent `<Rect x={-100000} y={-100000} width={200000} height={200000}>` as first child — required so Konva hit-detection bubbles events up to the Layer's handlers (Konva only fires Layer events when a child node is hit)

### Pen tool — drawing mode (TrackCanvas)
- `PenDrawState { anchors: PenAnchor[], continuationShapeId?, continuationEnd? }`
- Click → place corner anchor; click+hold+drag → pull symmetric bezier handles; Alt+drag → one-sided handle (break symmetry)
- `penDragRef = useRef(false)` tracks mouse-held state for handle drag; checked in `handleMouseMove`
- Shift held → `snapAngle()` snaps placement to nearest 15° from previous anchor
- Double-click → finish open path; click near first anchor (within 16/zoom px) → close path
- Green ring indicator shows when cursor is in close range

### Pen tool — edit mode (EditOverlay)
- Enter via double-click on any shape (`activeTool === 'select'` or `activeTool === 'pen'` and not mid-draw)
- Non-pen shapes are converted via `shapeToPenAnchors()` on double-click, type updated to `'pen'`
- `anchorsRef = useRef<PenAnchor[]>([])` synced synchronously each render (avoids stale closures)
- `dragRef = useRef<DragState|null>(null)` — never useState for drag (no re-render overhead)
- All rendered elements have `listening={false}`; Layer-level handlers do manual hit detection
- Alt+drag handle → break symmetry (only move dragged handle)
- Drag endpoint near other endpoint (within SNAP*1.5) → auto-close path + set fillAlpha to 0.3 if zero
- `closingHint` state drives the green snap ring indicator

### Shape rendering (UnifiedLayer)
- Shapes and ref images sorted by `order` and rendered in one unified layer
- `interactive = !state.editingShapeId` — applied to Group `listening` and `draggable` props
- During editing, UnifiedLayer goes fully non-interactive so EditOverlay gets all events
- `bakeTransform()` called on dragEnd and transformEnd — bakes Konva Group transform back into shape data
- Transformer `boundBoxFunc` checks `shiftRef.current` → enforces aspect ratio when Shift held
- `shiftRef` is populated by keydown/keyup listeners added only when `selected === true`

### Shape creation (TrackCanvas)
- `DRAG_TOOLS = Set(['rect', 'ellipse', 'polygon'])` — commit on mouseUp
- Pen commits on double-click (open) or clicking near first anchor (closed)
- Shift while drawing rect → square; Shift while drawing ellipse → circle
- `autoName(type)` counts existing shapes of same type → "Pen 1", "Rect 2", etc.
- All new shapes created with `strokeAlpha: 1, fillAlpha: 0`

### Fill visibility rule
- Fill controls only shown when `selectedShape.type !== 'pen' || selectedShape.closed`
- Open pen paths hide fill; rect/ellipse/polygon always show fill

### Playback
- `usePlayback` hook lives in `PlaybackControls`, drives rAF loop
- `speedRef` keeps latest `playbackSpeed` in sync — `next = currentTime + dt * speedRef.current`
- Switching to `activePanel === 'track'` stops playback and resets to 0 (in reducer `SET_ACTIVE_PANEL`)
- All playback controls disabled (`opacity-30 pointer-events-none`) when `activePanel === 'track'`
- Space bar shortcut blocked when `activePanel === 'track'`
- Progress bar has NO `transition` CSS — updates each rAF frame without lag

### Undo/Redo (AppContext)
- `past` and `future` are `useRef<AppState[]>` arrays (not state — no re-render cost)
- `SNAPSHOT` action pushes current state to `past` without changing state
- `UPDATE_SHAPE_LIVE` / `UPDATE_REF_IMAGE_LIVE` are NOT in `UNDOABLE` set — used for slider drags
- Pattern: dispatch `SNAPSHOT` on mouseDown, then `_LIVE` on every move, `UPDATE_SHAPE` on commit

### Active tool types (actions.ts)
```ts
type ActiveTool = 'select' | 'pen' | 'rect' | 'ellipse' | 'polygon' | 'measure' | 'image'
```
`'line'` was removed — use pen tool for lines instead.

### Shape types (core/types.ts)
```ts
type TrackShapeType = 'bezier' | 'rect' | 'ellipse' | 'polygon' | 'pen'
```
`'line'` was removed from the type.

---

## Important Conventions

- **No `transition` on canvas-synced elements** — anything driven by rAF must not have CSS transitions
- **`listening={false}` on all EditOverlay children** — hit detection is manual, not Konva's
- **Full-coverage Rect required in EditOverlay** — without it, mouse events fall through to Stage
- **Refs for drag state, state for visual indicators** — `dragRef`/`penDragRef`/`anchorsRef` are refs; `closingHint`/`preview` are state
- **`shapeToPenAnchors()` in `utils/pen.ts`** — converts rect/polygon/bezier to PenAnchor[]; returns null for ellipse
- **Fill hidden for open pen paths** — condition: `type !== 'pen' || closed`
- **Auto-save** — debounced 1s to localStorage key `say-it-so-autosave`
- **Never add `'line'` back** — line tool was intentionally removed; pen tool handles straight lines

---

## What Was Built (Implementation History)

### Track editor
- Photoshop-style pen tool: click=corner, click+drag=smooth handles, Alt=break symmetry
- Edit mode via double-click: move/add/remove anchors, drag handles, drag endpoints to close
- Shape tools: rect, ellipse, polygon (N-sided, drag to create)
- Shift snapping: 15° angle snap for pen/line, square/circle constraint for rect/ellipse
- Unified layer: shapes + ref images in single z-ordered layer
- Transformer with Shift=keep-ratio via `boundBoxFunc`
- Auto-naming shapes on creation
- Delete/Backspace shortcut to remove selected layer
- Reference image upload, opacity, lock, reorder
- Layer panel with visibility toggle, lock, reorder, rename, delete

### Horses
- Add/edit horses: number, name, jockey, stable, breeder
- 25+ silk patterns rendered procedurally via Konva
- Custom base + stripe colour per horse
- Drag horse on canvas → auto-upserts keyframe at currentTime

### Timeline
- Keyframe diamonds per horse lane, draggable
- Right-click context menu: delete, change easing (linear/ease-in/ease-out/ease-in-out/cubic-bezier)
- Playhead line draggable
- Playback speed: 0.5×/1×/2× preset buttons + slider (0.25×–4×)
- Progress bar updates every rAF frame (no CSS transition)

### Project
- Save/Load `.sayitso.json`
- Auto-save to localStorage
- Undo/redo (Ctrl+Z / Ctrl+Y)
- Settings: units, canvas size, track scale, duration

---

## Running the Project

```bash
pnpm install
pnpm dev          # http://localhost:5173

pnpm build        # production build → apps/web/dist/

docker compose up --build              # production, port 3000
docker compose --profile dev up        # dev server, port 5173
```
