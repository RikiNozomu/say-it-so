# Say It So — Racehorse Match Engine

A browser-based animation tool for planning and visualising racehorse movements on a track. Draw the track, place horses, set keyframes, and play back the race in real time.

---

## Owner

**Riki** · rikinozomu2022@gmail.com

---

## Objective

Say It So lets trainers, analysts, and racing enthusiasts choreograph horse races visually — without writing code. You draw the track layout, add horses with custom silks, then animate their paths by dragging keyframes on a timeline. The result is a shareable, frame-accurate race replay.

---

## Features

### Track Editor
- **Pen tool** — Photoshop-style bezier pen: click for corner anchors, click+drag for smooth curves, Alt+drag to break handle symmetry
- **Shape tools** — Rectangle, Ellipse, Polygon (N-sided), all with stroke/fill/opacity controls
- **Shift constraint** — Hold Shift while drawing to snap angles to 15° increments; constrains rect/ellipse to square/circle
- **Edit mode** — Double-click any shape to enter vertex editing: move anchors, add/remove points, drag endpoints together to close a path
- **Close/Open path** — Drag one endpoint onto the other, or use the "Close Path" button; fill is enabled automatically
- **Reference images** — Upload background images (track maps, diagrams) and adjust opacity/position
- **Layer management** — Reorder, lock, hide, rename, and delete layers from the sidebar
- **Undo / Redo** — Full history with Ctrl+Z / Ctrl+Y

### Horse Panel
- Add horses with number, name, jockey, stable, and breeder
- 20+ silk patterns (solid, halved, diagonal, chevron, dots, stripes, star, diamond, and more)
- Custom base colour and stripe colour per horse

### Timeline & Playback
- Drag keyframes on the timeline to set horse positions at any point in time
- Easing per keyframe: linear, ease-in, ease-out, ease-in-out, cubic-bezier
- Playback speed: 0.5×, 1×, 2× preset buttons plus a fine-control slider (0.25×–4×)
- Real-time scrubbing — click or drag on the progress bar
- Keyboard shortcuts: Space = play/pause, ← / → = step 1 s, Esc = cancel drawing

### Project
- Auto-save to localStorage on every change
- Save / Load `.json` project files
- Metric or imperial units
- Configurable canvas size, track scale, and race duration

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Canvas | Konva / react-konva |
| Styling | Tailwind CSS |
| Build | Vite |
| Monorepo | pnpm workspaces |
| Packages | `packages/core` (shared types), `apps/web` (UI) |

---

## Running Locally

### Prerequisites
- Node.js 20+
- pnpm 9 — `npm install -g pnpm@9`

### Steps

```bash
# 1. Clone
git clone <repo-url>
cd say-it-so

# 2. Install dependencies
pnpm install

# 3. Start dev server (hot-reload on http://localhost:5173)
pnpm dev
```

---

## Production Build

```bash
pnpm build
# Output: apps/web/dist/
```

Preview the production build locally:

```bash
pnpm --filter web exec vite preview
```

---

## Deploy with Docker

### Build & run (production)

```bash
docker compose up --build
# App available at http://localhost:3000
```

### Dev server with hot-reload

```bash
docker compose --profile dev up
# App available at http://localhost:5173
```

### Manual Docker build

```bash
docker build -t say-it-so .
docker run -p 3000:80 say-it-so
```

---

## Project Structure

```
say-it-so/
├── apps/
│   └── web/                  # React application
│       └── src/
│           ├── components/   # Canvas, panels, timeline, toolbar
│           ├── context/      # Global state (reducer + actions)
│           ├── hooks/        # usePlayback
│           └── utils/        # Pen tool geometry helpers
└── packages/
    └── core/                 # Shared TypeScript types (Horse, TrackShape, …)
```

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `←` / `→` | Step timeline ±1 s |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Delete` / `Backspace` | Delete selected layer |
| `Esc` | Cancel drawing / exit edit mode |
| `Shift` | Snap angle to 15° · constrain to square/circle |
| `Alt` | Break bezier handle symmetry |
| `P` | *(planned)* Pen tool shortcut |
