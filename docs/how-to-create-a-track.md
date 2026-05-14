# How to Create a Track (Agent Guide)

Quick reference for creating a `trackrace` shape and loading it into the app — no codebase exploration needed.

---

## Workflow

1. Build a `ProjectFile` JSON (see schema below)
2. Inject into `localStorage` via AppleScript + base64
3. Reload the Chrome tab

```python
import subprocess, json, base64

data = { ...project_file... }

b64 = base64.b64encode(json.dumps(data).encode()).decode()
js  = f"localStorage.setItem('say-it-so-autosave', atob('{b64}')); 'stored'"

applescript = f"""tell application "Google Chrome"
  set theTab to active tab of window 1
  execute theTab javascript "{js}"
end tell"""

subprocess.run(['osascript', '-e', applescript], timeout=15)
subprocess.run(['osascript', '-e',
  'tell application "Google Chrome" to reload active tab of window 1'])
```

> **Why base64?** JSON contains `"` and `\` which break AppleScript string literals.  
> **Why split set + reload?** `location.reload()` inside `execute javascript` times out; reload separately instead.

---

## ProjectFile Schema

```json
{
  "version": "1",
  "name": "My Race",
  "units": "metric",
  "duration": 120,
  "canvasWidth": 1400,
  "canvasHeight": 820,
  "trackScale": 1.4779,
  "horses": [],
  "trackShapes": [ ...one or more TrackShape objects... ],
  "refImages": []
}
```

AppState extras (needed for localStorage format — merged with defaults on load):

```json
{
  "zoom": 0.55,
  "panX": -20,
  "panY": 30,
  "activeTool": "select",
  "activePanel": "track"
}
```

---

## TrackShape (trackrace type)

```json
{
  "id": "unique-string",
  "type": "trackrace",
  "name": "Track Name",
  "points": [],
  "closed": false,
  "visible": true,
  "locked": false,
  "order": 0,
  "opacity": 1,
  "stroke": "#ffffff",
  "strokeWidth": 2,
  "strokeAlpha": 1,
  "fill": "#3a8c2f",
  "fillAlpha": 1,

  "penAnchors": [ ...PenAnchor[] ... ],

  "trackUnit": "m",
  "trackSurface": "turf",
  "trackWidths": [ 23, 23, 23 ],
  "trackBorderWidths": [ 4, 4, 4 ],
  "trackBorderColor": "#ffffff",
  "trackBorderOpacity": 1,

  "trackHorseInterval": 0,
  "trackTickColor": "#ffffff",
  "trackTickFontSize": 10,
  "trackTickLineWidth": 2
}
```

### Key fields

| Field | Unit | Notes |
|---|---|---|
| `trackSurface` | — | `"turf"` (green) or `"dirt"` (brown) |
| `trackWidths` | px | **Half**-width at each anchor. One value per anchor. |
| `trackBorderWidths` | px | Rail border half-width. One value per anchor. |
| `trackHorseInterval` | trackUnit | Distance tick interval. `0` = off (clean look). |
| `trackScale` | px/m | Pixels per metre. Calibrate so path reads the right distance. |

### trackWidths sizing guide

```
half-width px = (track_metres / 2) × trackScale
```

Example: 30 m wide track, scale 1.5 px/m → `trackWidths` = `[22, 22, ...]`

---

## PenAnchor

Each anchor is a point on the centreline with incoming/outgoing Bézier handles.

```json
{
  "x": 280, "y": 185,
  "cpIn":  { "x": 710, "y": 185 },
  "cpOut": { "x": 189, "y": 185 }
}
```

- **Straight segment**: `cpIn`/`cpOut` lie on the same horizontal or vertical line as the anchor. Magnitude = ~half the distance to the next anchor.
- **Curve apex**: tangent is perpendicular to the straight. Use Bézier circle approximation: `k = 0.552 × radius`.

---

## Calibrating trackScale for Exact Distance

The app measures path length in pixels and divides by `trackScale` for the displayed distance.

1. Build the path with a round scale (e.g. `1.5`).
2. Load and check the end-marker label (e.g. `1576.4 m`).
3. Compute: `new_scale = measured_m × old_scale / target_m`
   ```
   new_scale = 1576.4 × 1.5 / 1600 = 1.4779
   ```
4. Update `trackScale` and reload.

---

## Tokyo Racecourse 1600m Turf — Reference

Counter-clockwise: Start (top-right) → back straight → far turn (left) → home straight → Finish (bottom-right).

**Canvas**: 1400 × 820, `trackScale`: 1.4779

```json
"penAnchors": [
  { "x":1150,"y":185, "cpIn":{"x":1150,"y":185}, "cpOut":{"x":720,"y":185} },
  { "x": 280,"y":185, "cpIn":{"x": 710,"y":185}, "cpOut":{"x":189,"y":185} },
  { "x": 115,"y":415, "cpIn":{"x": 115,"y":288}, "cpOut":{"x":115,"y":542} },
  { "x": 280,"y":645, "cpIn":{"x": 189,"y":645}, "cpOut":{"x":710,"y":645} },
  { "x":1150,"y":645, "cpIn":{"x": 720,"y":645}, "cpOut":{"x":1150,"y":645} }
],
"trackWidths": [23,23,23,23,23],
"trackBorderWidths": [4,4,4,4,4]
```

Segment breakdown:
- 0–600 m: back straight (anchors 0→1)
- 600–1000 m: far turn (anchors 1→2→3)
- 1000–1600 m: home straight (anchors 3→4)
