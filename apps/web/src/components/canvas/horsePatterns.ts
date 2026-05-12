import type { StripePattern } from '@say-it-so/core'

export interface PatternDef {
  id: StripePattern
  label: string
  draw: (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, base: string, stripe: string) => void
}

// Utility: clip draw calls to circular horse badge
function withCircleClip(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  fn: () => void,
) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  fn()
  ctx.restore()
}

function fillCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
}

export const PATTERNS: PatternDef[] = [
  {
    id: 'solid',
    label: 'Solid',
    draw(ctx, cx, cy, r, base) {
      fillCircle(ctx, cx, cy, r, base)
    },
  },
  {
    id: 'halved-h',
    label: 'Halved (H)',
    draw(ctx, cx, cy, r, base, stripe) {
      fillCircle(ctx, cx, cy, r, base)
      withCircleClip(ctx, cx, cy, r, () => {
        ctx.fillStyle = stripe
        ctx.fillRect(cx - r, cy, r * 2, r)
      })
    },
  },
  {
    id: 'halved-v',
    label: 'Halved (V)',
    draw(ctx, cx, cy, r, base, stripe) {
      fillCircle(ctx, cx, cy, r, base)
      withCircleClip(ctx, cx, cy, r, () => {
        ctx.fillStyle = stripe
        ctx.fillRect(cx, cy - r, r, r * 2)
      })
    },
  },
  {
    id: 'diagonal-left',
    label: 'Diagonal /',
    draw(ctx, cx, cy, r, base, stripe) {
      fillCircle(ctx, cx, cy, r, base)
      withCircleClip(ctx, cx, cy, r, () => {
        ctx.fillStyle = stripe
        ctx.beginPath()
        ctx.moveTo(cx - r, cy + r)
        ctx.lineTo(cx + r, cy - r)
        ctx.lineTo(cx + r, cy + r)
        ctx.closePath()
        ctx.fill()
      })
    },
  },
  {
    id: 'diagonal-right',
    label: 'Diagonal \\',
    draw(ctx, cx, cy, r, base, stripe) {
      fillCircle(ctx, cx, cy, r, base)
      withCircleClip(ctx, cx, cy, r, () => {
        ctx.fillStyle = stripe
        ctx.beginPath()
        ctx.moveTo(cx - r, cy - r)
        ctx.lineTo(cx + r, cy + r)
        ctx.lineTo(cx - r, cy + r)
        ctx.closePath()
        ctx.fill()
      })
    },
  },
  {
    id: 'chevron-up',
    label: 'Chevron ∧',
    draw(ctx, cx, cy, r, base, stripe) {
      fillCircle(ctx, cx, cy, r, base)
      withCircleClip(ctx, cx, cy, r, () => {
        ctx.strokeStyle = stripe
        ctx.lineWidth = r * 0.35
        ctx.beginPath()
        ctx.moveTo(cx - r * 0.7, cy + r * 0.2)
        ctx.lineTo(cx, cy - r * 0.4)
        ctx.lineTo(cx + r * 0.7, cy + r * 0.2)
        ctx.stroke()
      })
    },
  },
  {
    id: 'chevron-down',
    label: 'Chevron ∨',
    draw(ctx, cx, cy, r, base, stripe) {
      fillCircle(ctx, cx, cy, r, base)
      withCircleClip(ctx, cx, cy, r, () => {
        ctx.strokeStyle = stripe
        ctx.lineWidth = r * 0.35
        ctx.beginPath()
        ctx.moveTo(cx - r * 0.7, cy - r * 0.2)
        ctx.lineTo(cx, cy + r * 0.4)
        ctx.lineTo(cx + r * 0.7, cy - r * 0.2)
        ctx.stroke()
      })
    },
  },
  {
    id: 'hoops',
    label: 'Hoops',
    draw(ctx, cx, cy, r, base, stripe) {
      fillCircle(ctx, cx, cy, r, base)
      withCircleClip(ctx, cx, cy, r, () => {
        const h = r * 0.3
        for (let i = -1; i <= 1; i++) {
          ctx.fillStyle = i % 2 === 0 ? stripe : base
          ctx.fillRect(cx - r, cy + i * h * 2 - h / 2, r * 2, h)
        }
      })
    },
  },
  {
    id: 'quartered',
    label: 'Quartered',
    draw(ctx, cx, cy, r, base, stripe) {
      fillCircle(ctx, cx, cy, r, base)
      withCircleClip(ctx, cx, cy, r, () => {
        ctx.fillStyle = stripe
        // top-right and bottom-left quarters
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, r, -Math.PI / 2, 0)
        ctx.closePath()
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, r, Math.PI / 2, Math.PI)
        ctx.closePath()
        ctx.fill()
      })
    },
  },
  {
    id: 'cross-sash',
    label: 'Cross Sash',
    draw(ctx, cx, cy, r, base, stripe) {
      fillCircle(ctx, cx, cy, r, base)
      withCircleClip(ctx, cx, cy, r, () => {
        ctx.strokeStyle = stripe
        ctx.lineWidth = r * 0.35
        ctx.beginPath()
        ctx.moveTo(cx - r, cy - r)
        ctx.lineTo(cx + r, cy + r)
        ctx.moveTo(cx + r, cy - r)
        ctx.lineTo(cx - r, cy + r)
        ctx.stroke()
      })
    },
  },
  {
    id: 'dots',
    label: 'Dots',
    draw(ctx, cx, cy, r, base, stripe) {
      fillCircle(ctx, cx, cy, r, base)
      withCircleClip(ctx, cx, cy, r, () => {
        const dr = r * 0.2
        const positions = [
          [0, -r * 0.45], [-r * 0.45, 0], [r * 0.45, 0], [0, r * 0.45],
        ]
        ctx.fillStyle = stripe
        for (const [dx, dy] of positions) {
          ctx.beginPath()
          ctx.arc(cx + dx, cy + dy, dr, 0, Math.PI * 2)
          ctx.fill()
        }
      })
    },
  },
  {
    id: 'stripes-h',
    label: 'Stripes H',
    draw(ctx, cx, cy, r, base, stripe) {
      fillCircle(ctx, cx, cy, r, base)
      withCircleClip(ctx, cx, cy, r, () => {
        const stripeH = r * 0.28
        ctx.fillStyle = stripe
        ctx.fillRect(cx - r, cy - r, r * 2, stripeH)
        ctx.fillRect(cx - r, cy + stripeH * 0.5, r * 2, stripeH)
      })
    },
  },
  {
    id: 'stripes-v',
    label: 'Stripes V',
    draw(ctx, cx, cy, r, base, stripe) {
      fillCircle(ctx, cx, cy, r, base)
      withCircleClip(ctx, cx, cy, r, () => {
        const sw = r * 0.28
        ctx.fillStyle = stripe
        ctx.fillRect(cx - r, cy - r, sw, r * 2)
        ctx.fillRect(cx + sw * 0.5, cy - r, sw, r * 2)
      })
    },
  },
  {
    id: 'stripes-diagonal',
    label: 'Stripes Diag',
    draw(ctx, cx, cy, r, base, stripe) {
      fillCircle(ctx, cx, cy, r, base)
      withCircleClip(ctx, cx, cy, r, () => {
        ctx.strokeStyle = stripe
        ctx.lineWidth = r * 0.28
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath()
          ctx.moveTo(cx - r + i * r * 0.6, cy - r)
          ctx.lineTo(cx + r + i * r * 0.6, cy + r)
          ctx.stroke()
        }
      })
    },
  },
  {
    id: 'panel-front',
    label: 'Panel Front',
    draw(ctx, cx, cy, r, base, stripe) {
      fillCircle(ctx, cx, cy, r, base)
      withCircleClip(ctx, cx, cy, r, () => {
        ctx.fillStyle = stripe
        ctx.fillRect(cx - r * 0.4, cy - r, r * 0.8, r * 2)
      })
    },
  },
  {
    id: 'panel-back',
    label: 'Panel Back',
    draw(ctx, cx, cy, r, base, stripe) {
      fillCircle(ctx, cx, cy, r, stripe)
      withCircleClip(ctx, cx, cy, r, () => {
        ctx.fillStyle = base
        ctx.fillRect(cx - r * 0.4, cy - r, r * 0.8, r * 2)
      })
    },
  },
  {
    id: 'sleeves-contrast',
    label: 'Sleeves',
    draw(ctx, cx, cy, r, base, stripe) {
      fillCircle(ctx, cx, cy, r, base)
      withCircleClip(ctx, cx, cy, r, () => {
        ctx.fillStyle = stripe
        ctx.fillRect(cx - r, cy - r, r * 0.45, r * 2)
        ctx.fillRect(cx + r * 0.55, cy - r, r * 0.45, r * 2)
      })
    },
  },
  {
    id: 'star',
    label: 'Star',
    draw(ctx, cx, cy, r, base, stripe) {
      fillCircle(ctx, cx, cy, r, base)
      withCircleClip(ctx, cx, cy, r, () => {
        ctx.fillStyle = stripe
        const spikes = 5
        const outer = r * 0.6
        const inner = r * 0.25
        ctx.beginPath()
        for (let i = 0; i < spikes * 2; i++) {
          const angle = (i * Math.PI) / spikes - Math.PI / 2
          const rad = i % 2 === 0 ? outer : inner
          if (i === 0) ctx.moveTo(cx + Math.cos(angle) * rad, cy + Math.sin(angle) * rad)
          else ctx.lineTo(cx + Math.cos(angle) * rad, cy + Math.sin(angle) * rad)
        }
        ctx.closePath()
        ctx.fill()
      })
    },
  },
  {
    id: 'diamond',
    label: 'Diamond',
    draw(ctx, cx, cy, r, base, stripe) {
      fillCircle(ctx, cx, cy, r, base)
      withCircleClip(ctx, cx, cy, r, () => {
        ctx.fillStyle = stripe
        ctx.beginPath()
        ctx.moveTo(cx, cy - r * 0.6)
        ctx.lineTo(cx + r * 0.55, cy)
        ctx.lineTo(cx, cy + r * 0.6)
        ctx.lineTo(cx - r * 0.55, cy)
        ctx.closePath()
        ctx.fill()
      })
    },
  },
  {
    id: 'seabiscuit',
    label: 'Seabiscuit',
    draw(ctx, cx, cy, r, _base, _stripe) {
      fillCircle(ctx, cx, cy, r, '#7B3F00')
      withCircleClip(ctx, cx, cy, r, () => {
        ctx.fillStyle = '#C0392B'
        ctx.fillRect(cx - r, cy - r * 0.3, r * 2, r * 0.6)
      })
    },
  },
  {
    id: 'royal',
    label: 'Royal',
    draw(ctx, cx, cy, r, _base, _stripe) {
      fillCircle(ctx, cx, cy, r, '#1A237E')
      withCircleClip(ctx, cx, cy, r, () => {
        ctx.fillStyle = '#FFD700'
        ctx.fillRect(cx - r * 0.2, cy - r, r * 0.4, r * 2)
        ctx.fillRect(cx - r, cy - r * 0.2, r * 2, r * 0.4)
      })
    },
  },
  {
    id: 'emerald',
    label: 'Emerald',
    draw(ctx, cx, cy, r, _base, _stripe) {
      fillCircle(ctx, cx, cy, r, '#1B5E20')
      withCircleClip(ctx, cx, cy, r, () => {
        ctx.fillStyle = '#FFFFFF'
        const sw = r * 0.22
        ctx.fillRect(cx - r, cy - r, sw, r * 2)
        ctx.fillRect(cx + r - sw, cy - r, sw, r * 2)
        ctx.fillRect(cx - r, cy - sw / 2, r * 2, sw)
      })
    },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    draw(ctx, cx, cy, r, _base, _stripe) {
      withCircleClip(ctx, cx, cy, r, () => {
        const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r)
        g.addColorStop(0, '#FF6B35')
        g.addColorStop(1, '#7B2D8B')
        ctx.fillStyle = g
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
      })
    },
  },
  {
    id: 'monochrome',
    label: 'Monochrome',
    draw(ctx, cx, cy, r, _base, _stripe) {
      fillCircle(ctx, cx, cy, r, '#FFFFFF')
      withCircleClip(ctx, cx, cy, r, () => {
        const sw = r * 0.28
        ctx.fillStyle = '#000000'
        for (let i = -3; i <= 3; i += 2) {
          ctx.fillRect(cx - r + (i + 3) * sw, cy - r, sw, r * 2)
        }
      })
    },
  },
]

export const PATTERN_MAP = new Map(PATTERNS.map((p) => [p.id, p]))

export function getPatternDef(id: StripePattern): PatternDef {
  return PATTERN_MAP.get(id) ?? PATTERNS[0]
}
