# CLAUDE.md — Say It So · Racehorse Animation Tool

Agent context file. Read this before touching any code.

---

## Agent Working Rules

These rules apply to every code change, no exceptions:

1. **DRY** — Before writing new logic, search for existing helpers, hooks, or components that already do it.
2. **Reuse first** — Prefer extending an existing component over creating a new file.
3. **Merge duplicates** — If two components do the same thing, merge them. Note it in the PR description.
4. **Backward compatibility** — Never break existing `.sayitso.json` files. Files with no `version` field are treated as JSON version 1. New required fields must have safe defaults on load.
5. **Version before push** — Run `bash scripts/bump-version.sh` before pushing (minor bump by default). Exception: when the caller explicitly sets a version.
6. **Update docs after every change** — After completing any code change, update both `CLAUDE.md` and `README.md` to reflect the new behaviour. CLAUDE.md gets the technical detail; README.md gets the user-facing description. Never leave the docs behind.

---

## Version System

### Code version (`X.Y`)
Stored in **all three** `package.json` files: root, `apps/web`, `packages/core`.

| Action | Example |
|---|---|
| Default (new feature / fix) | `0.5` → `0.6` |
| Major (breaking change) | `0.5` → `1.0` |
| Set explicit | `bash scripts/bump-version.sh --set 1.3` |

```bash
bash scripts/bump-version.sh           # minor bump (default)
bash scripts/bump-version.sh --major   # major bump
bash scripts/bump-version.sh --set X.Y # set explicit version
```

Current code version: **0.11** (stored as `0.11.0` in package.json — pnpm 11 requires full semver)

### JSON file version (integer)
- Authoritative constant: `JSON_FILE_VERSION` in `packages/core/src/types.ts`
- Saved as `"version": <integer>` in every `.sayitso.json`
- Files without a `version` field → treated as version **1**
- Only increment when the schema changes in a way that needs migration logic
- Migration helpers live in `apps/web/src/hooks/useSaveLoad.ts` (`normalizeVersion()`)

Current JSON file version: **1**

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
├── scripts/
│   └── bump-version.sh         # code version bump script
├── packages/core/              # Shared types + pure utils (no React)
│   └── src/
│       ├── index.ts            # re-exports types + interpolate + measurement
│       ├── types.ts            # all shared interfaces + JSON_FILE_VERSION
│       ├── interpolate.ts      # keyframe interpolation helpers
│       └── measurement.ts      # measureDistance(), unit conversion
└── apps/web/src/
    ├── context/
    │   ├── AppContext.tsx       # useReducer + undo/redo + localStorage autosave
    │   ├── reducer.ts          # single root reducer, all AppState mutations
    │   └── actions.ts          # Action union type + ActiveTool type
    ├── hooks/
    │   ├── usePlayback.ts      # rAF loop, drive currentTime
    │   └── useSaveLoad.ts      # save/load project/track/race JSON files
    ├── utils/
    │   └── pen.ts              # anchorsToPath(), shapeToPenAnchors(), effectiveCpOut()
    └── components/
        ├── canvas/
        │   ├── TrackCanvas.tsx       # Konva Stage + all drawing interactions
        │   ├── UnifiedLayer.tsx      # shapes + ref images rendered in z-order
        │   ├── EditOverlay.tsx       # pen/ruler/trackrace anchor edit layer
        │   ├── HorseLayer.tsx        # animated horse markers (race panel only)
        │   ├── MotionPathLayer.tsx   # bezier motion paths + handle editing (race panel only)
        │   ├── MeasurementLayer.tsx  # click+drag ruler overlay (measure tool only)
        ├── panels/
        │   ├── TrackPanel.tsx        # draw tools + shape/image properties + ruler/trackrace config
        │   ├── HorsePanel.tsx        # horse CRUD + silk picker
        │   ├── PreviewPanel.tsx      # preview mode: horse list + live speed + name toggles + countdown config + Start Race
        │   ├── LayersPanel.tsx       # layer list: reorder/lock/hide/delete/duplicate
        │   └── SettingsPanel.tsx     # units, canvas size, duration, speed calculator
        ├── timeline/
        │   ├── Timeline.tsx          # scrubber + keyframe diamonds + playhead + zoom
        │   └── PlaybackControls.tsx  # transport buttons + speed controls + progress bar
        ├── modals/
        │   └── HorseModal.tsx        # add/edit horse (number, name, JRA/RBSC palette, custom color)
        └── toolbar/
            └── Toolbar.tsx           # top bar: project name, panel tabs, save/load, undo/redo
```

---

## AppState (`context/reducer.ts`)

```ts
interface AppState {
  // project meta
  projectName: string
  units: 'metric' | 'imperial'
  canvasWidth: number; canvasHeight: number
  trackScale: number    // pixels per metre
  duration: number      // seconds

  // view
  zoom: number; panX: number; panY: number
  activeTool: ActiveTool
  activePanel: 'race' | 'track' | 'preview'

  // data
  horses: Horse[]
  trackShapes: TrackShape[]
  refImages: RefImage[]

  // selection
  selectedHorseId: string | null
  selectedShapeId: string | null
  selectedRefImageId: string | null
  editingShapeId: string | null     // set → EditOverlay owns all events
  selectedAnchorIdx: number | null  // anchor index within editingShapeId
  polygonSides: number              // 3–32

  // playback
  currentTime: number
  playbackState: 'idle' | 'playing' | 'paused'
  playbackSpeed: number             // multiplied by dt in rAF

  // motion paths
  motionPathHorseIds: string[]      // which horses show motion path overlay

  // preview mode
  preRaceTime: number               // countdown seconds before playback starts (0 = instant)
  previewHorseNameIds: string[]     // horse IDs showing name label on canvas in preview
}
```

**Context extras (AppContext.tsx):**
```ts
penDrawing: boolean        // true while mid-draw (pen/ruler/trackrace); blocks undo
setPenDrawing: (v) => void
canUndo: boolean
canRedo: boolean
```

---

## Key Patterns

### Event flow — canvas interactions
- All mouse events start on the Konva `<Stage>` in `TrackCanvas.tsx`
- When `editingShapeId` is set, `TrackCanvas` stops handling events; `EditOverlay` takes over
- `EditOverlay` has a full-coverage transparent `<Rect x={-100000} y={-100000} width={200000} height={200000}>` as first child — required so Konva hit-detection bubbles events up to the Layer's handlers (Konva only fires Layer events when a child node is hit)
- `MeasurementLayer` activates only when `activeTool === 'measure'`
- `HorseLayer` and `MotionPathLayer` are only rendered when `activePanel === 'horses'`

### Pen / Ruler / Trackrace drawing (TrackCanvas)
- `PenDrawState { anchors: PenAnchor[], continuationShapeId?, continuationEnd? }`
- Click → place corner anchor; click+hold+drag → pull symmetric bezier handles; Alt+drag → one-sided handle (break symmetry)
- Shift held → `snapAngle()` snaps to nearest 15° from previous anchor
- `penDragRef = useRef(false)` tracks mouse-held state for handle drag
- **Pen only:** Double-click → finish open path; click near first anchor (within 16/zoom px) → close path; green ring indicator shows close range
- **Ruler / Trackrace:** Same anchor-based flow; no close-path (always open)
- `penDrawing` flag is set while drawing; prevents undo/new-shape creation

### Pen tool — edit mode (EditOverlay)
- Enter via double-click on any shape (any active tool)
- Non-pen shapes are converted via `shapeToPenAnchors()` on enter; type updated to `'pen'`
- `anchorsRef = useRef<PenAnchor[]>([])` synced each render (avoids stale closures in RAF)
- `dragRef = useRef<DragState|null>(null)` — never useState for drag (no re-render overhead)
- All rendered elements have `listening={false}`; Layer-level handlers do manual hit detection
- Hit priority (order): cpOut/cpIn handles → anchor squares → segments (click = insert anchor)
- Alt+drag handle → break symmetry (only move dragged handle)
- Ctrl+click anchor → toggle corner↔smooth
- Drag endpoint near other endpoint (within SNAP×1.5) → auto-close path + set fillAlpha to 0.3 if zero
- Delete key removes selected anchor (min 2 anchors)
- **Trackrace** anchor insert also extends `trackWidths` and `trackBorderWidths` arrays

### Motion path editing (MotionPathLayer)
- Visible only when `activePanel === 'horses'`
- Eye toggle per horse lane in Timeline controls `motionPathHorseIds[]`
- When `selectedHorseId` is set, shows editable bezier handles on that horse's path
- Anchor drag → `UPDATE_KEYFRAME_XY_LIVE` → `UPDATE_KEYFRAME_XY` on mouseup
- Handle drag → `UPDATE_KEYFRAME_CP_LIVE` → `UPDATE_KEYFRAME_CP` on mouseup (symmetric by default, Alt = independent)
- Ctrl/Cmd+drag anchor = pull bezier handles instead of move
- Window-level drag listeners attached on mousedown, removed on mouseup

### Shape rendering (UnifiedLayer)
- Shapes and ref images sorted by `order` and rendered in one unified layer
- `interactive = !state.editingShapeId` — applied to Group `listening` and `draggable`
- During editing, UnifiedLayer goes fully non-interactive so EditOverlay gets all events
- `bakeTransform()` called on dragEnd and transformEnd — bakes Konva Group transform back into shape data
- Transformer `boundBoxFunc` enforces aspect ratio when Shift held (`shiftRef.current`)
- `shiftRef` populated by keydown/keyup listeners, added only when shape is selected

### Shape rendering types in UnifiedLayer
- **ShapeItem** — generic pen/rect/ellipse/polygon with transformer
- **RulerItem** — dashed path + endpoint circles + sequence marker dots + start/end distance labels
- **TrackRaceItem** — two-polygon (border outer + surface inner), border discs at anchors, horse-length tick marks, SVG texture (turf.svg / dirt.svg)
- **ImageItem** — Konva image with transformer

### Shape creation (TrackCanvas)
- `DRAG_TOOLS = Set(['rect', 'ellipse', 'polygon'])` — live preview on mousemove, commit on mouseUp
- Pen/Ruler/Trackrace commit on double-click (open) or near-first-anchor click (closed, pen only)
- Shift while drawing rect → square; Shift while drawing ellipse → circle
- `autoName(type)` counts existing shapes of same type → "Pen 1", "Rect 2", "Track Race 1", etc.
- All new shapes created with `strokeAlpha: 1, fillAlpha: 0`

### Fill visibility rule
- Fill controls only shown when `selectedShape.type !== 'pen' || selectedShape.closed`
- Open pen paths always hide fill; `ruler` and `trackrace` never show fill controls

### Preview mode
- Activated via the **Preview** tab in Toolbar. Tab is `disabled` (pointer-events-none, dimmed) when `state.horses.length === 0`.
- Removing the last horse while in preview automatically sets `activePanel` back to `'race'` (handled in `REMOVE_HORSE` reducer case).
- **Layout in preview:** Timeline is hidden; PlaybackControls still visible. Sidebar is collapsible (chevron toggle). `App.tsx` holds `previewMinimized` boolean state for the sidebar.
- **PreviewPanel** (`components/panels/PreviewPanel.tsx`):
  - Sorted horse list with colored number circle, name, and live instantaneous speed.
  - Speed computed by sampling `interpolatePosition` at `currentTime` and `currentTime + 0.05s`, converting px/s → m/s → km/h or mph via `trackScale`.
  - Eye toggle per horse dispatches `TOGGLE_PREVIEW_HORSE_NAME` → adds/removes from `previewHorseNameIds`.
  - Countdown input dispatches `SET_PRE_RACE_TIME` (clamped ≥ 0 in reducer).
  - "Start Race" calls `onStartRace()` prop in `App.tsx`.
- **Countdown flow (App.tsx):** `handleStartRace` resets `currentTime` to 0, then:
  - If `preRaceTime === 0`: dispatches `SET_PLAYBACK_STATE playing` immediately.
  - Else: sets `countdown` state to `preRaceTime`. A `useEffect` ticks it down 1/s via `setTimeout`. When it reaches 0, dispatches `SET_PLAYBACK_STATE playing` and clears countdown.
- **CountdownOverlay:** Absolute-positioned `pointer-events-none` div over the canvas area, shows current countdown number or "GO!" at value 0.
- **Horse name label (HorseLayer):** When `activePanel === 'preview'` and `horse.id` is in `previewHorseNameIds`, a `<Text>` node renders below the horse circle (`y = RADIUS + BORDER + 4`, centered with `x = -60` + `width = 120`).

### Playback
- `usePlayback` hook lives in `PlaybackControls.tsx`, drives rAF loop
- `speedRef` keeps latest `playbackSpeed` in sync — `next = currentTime + dt * speedRef.current`
- Switching to `activePanel === 'track'` stops playback and resets to 0 (in reducer `SET_ACTIVE_PANEL`)
- All playback controls disabled (`opacity-30 pointer-events-none`) when `activePanel === 'track'`
- Space bar shortcut blocked when `activePanel === 'track'`
- Progress bar has NO `transition` CSS — updates each rAF frame without lag

### Undo/Redo (AppContext)
- `past` and `future` are `useRef<AppState[]>` arrays (not state — no re-render cost)
- `MAX_HISTORY = 50`
- `SNAPSHOT` action pushes current state to `past` without changing state
- `UPDATE_SHAPE_LIVE` / `UPDATE_REF_IMAGE_LIVE` / `UPDATE_KEYFRAME_XY_LIVE` / `UPDATE_KEYFRAME_CP_LIVE` are NOT in `UNDOABLE` set — used for slider/drag live updates
- Pattern: dispatch `SNAPSHOT` on mouseDown, then `_LIVE` on every move, committing action on mouseUp
- `RESTORE_STATE` preserves: `activeTool, activePanel, zoom, panX, panY, selectedIds, playbackState, currentTime, playbackSpeed` — these do not revert on undo

### Timeline (Timeline.tsx)
- Fixed label column (200px) + scrollable track area
- Label column: zoom ±/× display, snap toggle, per-horse ◄ ◇ ► keyframe navigation, add/delete keyframe button, motion path eye toggle
- Keyframe diamond: draggable to time (snaps to other KFs if snap enabled), right-click → delete, pink = curved, grey = corner
- Playhead: vertical red line at `currentTime`, draggable diamond at top
- `Ctrl+wheel` zooms timeline around `currentTime` anchor

### Save/Load (useSaveLoad.ts)
- File I/O: prefers File System Access API (`showSaveFilePicker`/`showOpenFilePicker`), falls back to `<input type="file">` / anchor download
- Three file types: `ProjectFile` (full), `TrackFile` (shapes + images), `RaceFile` (horses only)
- Autosave: 1s debounce to `localStorage` key `say-it-so-autosave`
- `normalizeVersion(raw)` converts string `"1"`, missing field, or number `1` → always returns number
- Always write `version: JSON_FILE_VERSION` when saving (never hardcode)

---

## Active Tool Types (`actions.ts`)

```ts
type ActiveTool = 'select' | 'pen' | 'rect' | 'ellipse' | 'polygon' | 'measure' | 'image' | 'ruler' | 'trackrace'
```

---

## Shape Types (`core/types.ts`)

```ts
type TrackShapeType = 'bezier' | 'rect' | 'ellipse' | 'polygon' | 'pen' | 'ruler' | 'trackrace'
```

`'line'` was removed — pen tool handles straight lines.

---

## Important Conventions

- **No `transition` on rAF-driven elements** — anything updated every frame must not have CSS transitions
- **`listening={false}` on all EditOverlay children** — hit detection is manual via Layer handlers
- **Full-coverage Rect required in EditOverlay** — without it, mouse events fall through to Stage
- **Refs for drag state, state for visual indicators** — `dragRef`, `penDragRef`, `anchorsRef` are refs; `closingHint`, `preview` are state
- **`shapeToPenAnchors()` in `utils/pen.ts`** — converts rect/polygon/bezier to `PenAnchor[]`; returns null for ellipse
- **Fill hidden for open pen paths** — condition: `type !== 'pen' || closed`
- **Auto-save** — debounced 1s to localStorage key `say-it-so-autosave`
- **Never add `'line'` back** — intentionally removed; pen tool handles straight lines

---

## Running the Project

```bash
pnpm install
pnpm dev          # http://localhost:5173

pnpm build        # production build → apps/web/dist/
pnpm lint         # ESLint (0 warnings allowed)
pnpm test         # Vitest (Jest-compatible API)
pnpm test:coverage  # coverage report via v8

docker compose up --build              # production, port 3000
docker compose --profile dev up        # dev server, port 5173
```

### Lint & Test details
- ESLint config: `apps/web/.eslintrc.cjs` — TypeScript + react-hooks + react-refresh rules, 0 max warnings
- Test runner: **Vitest** (not Jest) — identical API (`describe/it/expect`), native Vite + ESM support
- Test setup: `apps/web/src/test/setup.ts` — imports `@testing-library/jest-dom`
- Tests live in `apps/web/src/test/` — pure utility functions in `packages/core` are the primary targets; React component tests use `@testing-library/react` + `jsdom`
- CI runs lint → test → build → deploy in that order (all must pass before deploy)

### GitHub Pages (production)
- Live URL: **https://rikinozomu.github.io/say-it-so/**
- Auto-deploys on every push to `master` via `.github/workflows/deploy.yml`
- Vite `base` is set to `/say-it-so/` in `apps/web/vite.config.ts`
- Public asset paths (textures etc.) must use `import.meta.env.BASE_URL` prefix, not absolute `/` paths

---

## What Is Built

### Track editor
- Photoshop-style pen tool: click = corner, click+drag = smooth handles, Alt = break symmetry
- Edit mode (double-click any shape): move/add/remove anchors, drag handles, close by dragging endpoints
- Shape tools: rect, ellipse, polygon (N-sided, drag to create)
- Shift snapping: 15° angle snap for pen/ruler/trackrace; square/circle constraint for rect/ellipse
- Unified layer: shapes + ref images in single z-ordered layer with drag-to-reorder
- Transformer with Shift = keep-ratio via `boundBoxFunc`
- Auto-naming shapes on creation ("Pen 1", "Track Race 2", etc.)
- Delete/Backspace shortcut to remove selected layer
- Reference image upload, opacity, lock, reorder, rotate
- Layer panel: visibility toggle, lock, reorder, rename, duplicate, delete

### Ruler tool
- Anchor-based path same as pen (always open)
- Configurable unit (px / m / mi / fur)
- Start/end distance labels, configurable font size + colors
- Sequence markers: dots at regular intervals with labels

### Track Race tool
- Variable-width race track along any bezier path
- Per-anchor width control (trackWidths array)
- Border width + color per anchor (trackBorderWidths)
- Surface: turf (green SVG texture) or dirt (brown SVG texture)
- Horse-length tick marks with labels
- TrackPanel shows full config (unit, surface, width, border, ticks) for selected trackrace shape

### Horses
- Add/edit horses: number (1–24), name, color
- **JRA palette** — 8 official bracket colours (White, Black, Red, Blue, Yellow, Green, Orange, Pink). Sets marker colour only; number is unchanged.
- **RBSC palette** — 14 fixed number+colour pairs (No.1–14). Clicking a preset sets **both** `form.number` and `form.color` (plus an auto text colour). Defined in `RBSC_PRESETS` in `HorseModal.tsx`.
- Custom base + text colour per horse via `HexColorPicker`
- Drag horse on canvas → auto-upserts keyframe at `currentTime`
- Duplicate horse button in HorsePanel — deep-copies horse (including all keyframes + bezier handles), appends name with " copy", inserts immediately after source in list, selects the copy; disabled when at 24-horse limit
- Max 24 horses

### Motion paths
- Per-horse bezier path visible in race panel
- Toggle visibility per horse via eye icon in timeline label
- Editable handles: drag cpIn/cpOut (Alt = independent), drag anchor (Ctrl/Cmd = curve mode)
- Keyframe nav buttons (◄ ◇ ►) per horse lane in timeline

### Timeline
- Keyframe diamonds per horse lane, draggable to new time
- Snap-to-keyframe toggle
- Right-click context menu: delete keyframe
- Playhead draggable; zoom with Ctrl+wheel
- Playback speed: 0.5×/1×/2× preset buttons + fine slider (0.25×–4×)
- Transport controls: play/pause/stop/rewind/skip±5s/fast-forward
- Progress bar updates every rAF frame (no CSS transition)

### Preview mode
- Dedicated tab (disabled when no horses exist)
- Playback-only view: Timeline hidden; PlaybackControls visible
- Side panel with horse list: number circle, name, live instantaneous speed (km/h or mph)
- Per-horse name toggle: shows name label below horse marker on canvas
- Sidebar minimize/expand to maximize canvas viewport
- Countdown timer: configurable pre-race delay (default 15 s); "GO!" flash at 0
- "Start Race" button: resets to t=0, counts down, then starts playback

### Project
- Save/Load `.sayitso.json` (full project, track-only, or race-only)
- Auto-save to localStorage (1s debounce)
- Undo/redo (Ctrl+Z / Ctrl+Y, max 50 steps)
- Settings: units, canvas size, track scale, duration, speed calculator
