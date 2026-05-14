# Say It So — Racehorse Animation Tool

A browser-based tool for choreographing and replaying racehorse movements on a custom track. Draw the track, add horses, set keyframes on a timeline, and play back the race in real time.

**Version:** 0.7 · **Owner:** Riki · rikinozomu2022@gmail.com · [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Features

---

### Track Editor

Design the race track using a full suite of vector drawing tools.

**Drawing tools**
- **Pen** — Photoshop-style bezier pen: click for corner anchors, click+drag for smooth curves, Alt+drag to break handle symmetry, double-click to finish.
- **Track Race** — Variable-width bezier race corridor. Choose turf or dirt surface texture, adjust track width and border per anchor point, and add horse-length tick markers. Supports px, metres, and miles.
- **Ruler** — Measure curved distances along any path. Configurable unit (px / m / mi / fur), interval markers, font size, and label colours.
- **Shapes** — Rectangle, Ellipse, and Polygon (3–32 sides) with stroke, fill, and opacity controls.

**Editing**
- **Edit mode** — Double-click any shape to enter vertex editing: move, add, or delete anchors; drag bezier handles; drag endpoints together to close a path.
- **Shift constraint** — Snap pen angles to 15° increments; constrain rect/ellipse to square/circle.
- **Undo / Redo** — Up to 50 steps (Ctrl+Z / Ctrl+Y). Disabled while mid-draw.

**Layers & assets**
- **Reference images** — Upload background images (track maps, diagrams); set opacity, rotation, and lock state.
- **Layer panel** — Reorder, lock, hide, duplicate, rename, and delete any layer.

---

### Race Editor

Place horses on the track, choreograph their paths, and play back the race.

**Horses**
- Add up to **24 horses**, each with a number (1–24), name, and custom colours.
- **JRA palette** — 8 official Japan Racing Association bracket colours (White, Black, Red, Blue, Yellow, Green, Orange, Pink). Sets the marker colour only.
- **RBSC palette** — 14 Royal Bangkok Sports Club fixed number+colour pairs (No.1 Red through No.14 Violet). Selecting a preset sets **both** the horse number and marker colour simultaneously.
- **Custom colour** — Full hex colour picker for marker background and number text.
- Drag a horse on the canvas → auto-inserts a keyframe at the current time.
- Edit or delete horses at any time; deletion removes all associated keyframes.

**Motion paths**
- Per-horse bezier motion path shown on the canvas.
- Toggle path visibility per horse via the eye icon in the timeline.
- Editable handles: drag cpIn/cpOut (Alt = independent), drag anchor (Ctrl/Cmd = curve mode).
- Keyframe navigation (◄ ◇ ►) per horse lane.

**Timeline & playback**
- Keyframe diamonds per horse lane — drag to reposition in time; snap-to-keyframe toggle.
- Right-click a keyframe to delete it. Zoom the timeline with Ctrl+wheel.
- Playback speed: **0.5×, 1×, 2×** presets + fine slider (**0.25×–4×**).
- Transport controls: play, pause, stop, rewind, skip ±5 s, fast-forward.
- Real-time progress bar scrubbing — updates every animation frame.

### Project
- **Save / Load** `.sayitso.json` — full project, track-only, or race-only.
- **Auto-save** to `localStorage` on every change (1 s debounce).
- Metric or imperial units.
- Configurable canvas size, track scale (px/m), and race duration.
- Speed calculator in Settings (average speed of selected horse over keyframe range).

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Delete` / `Backspace` | Delete selected layer or anchor |
| `Esc` | Cancel drawing / exit edit mode |
| `Shift` | Snap angle to 15° · constrain to square/circle |
| `Alt` | Break bezier handle symmetry |
| `Ctrl/Cmd` (on anchor drag) | Pull bezier handles instead of moving anchor |
| `Ctrl+wheel` | Zoom canvas / zoom timeline |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Canvas | Konva / react-konva |
| Styling | Tailwind CSS |
| Build | Vite |
| Monorepo | pnpm workspaces |
| Packages | `packages/core` (shared types + interpolation + measurement), `apps/web` (UI) |

---

## Project Structure

```
say-it-so/
├── scripts/
│   └── bump-version.sh        # code version bump (minor / major / --set X.Y)
├── packages/
│   └── core/                  # shared types, keyframe interpolation, measurement utils
└── apps/
    └── web/src/
        ├── context/            # AppContext, reducer, actions
        ├── hooks/              # usePlayback, useSaveLoad
        ├── utils/              # pen geometry helpers
        └── components/
            ├── canvas/         # TrackCanvas, UnifiedLayer, EditOverlay, HorseLayer, MotionPathLayer, MeasurementLayer
            ├── panels/         # TrackPanel, HorsePanel, LayersPanel, SettingsPanel
            ├── timeline/       # Timeline, PlaybackControls
            ├── modals/         # HorseModal
            └── toolbar/        # Toolbar
```

---

## Live Demo

**https://rikinozomu.github.io/say-it-so/**

Deployed automatically to GitHub Pages on every push to `master` via `.github/workflows/deploy.yml`.

---

## Running Locally

**Prerequisites:** Node.js 20+ · pnpm 9 (`npm install -g pnpm@9`)

```bash
# Clone and install
git clone https://github.com/RikiNozomu/say-it-so
cd say-it-so
pnpm install

# Start dev server — http://localhost:5173
pnpm dev
```

## Production Build

```bash
pnpm build
# Output: apps/web/dist/
```

Preview the build locally:

```bash
pnpm --filter web exec vite preview
```

## Docker (self-hosted)

```bash
# Production (port 3000)
docker compose up --build

# Dev server with hot-reload (port 5173)
docker compose --profile dev up
```

---

## File Format & Versioning

Save files use `.sayitso.json`. Three variants:

| File | Contents |
|---|---|
| Full project | track shapes + reference images + horses + keyframes |
| Track-only | track shapes + reference images (no horses) |
| Race-only | horses + keyframes (no track) |

Files include a `version` integer for forward-compatible loading. Older files without a version field are treated as version 1.
