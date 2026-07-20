# DESIGN_SYSTEM.md — Tirak Chat

> มาตรฐาน Design System ระดับองค์กร
> AI ใช้ไฟล์นี้เวลาสร้าง UI — ห้ามใช้ arbitrary values

---

## 1. Typography Scale

ห้ามใช้ `text-[13px]`, `text-[11.5px]`, `text-[14.5px]` ฯลฯ
ให้ใช้ค่าต่อไปนี้แทน:

| Token | Tailwind Class | Size | Weight | Usage |
|---|---|---|---|---|
| micro | `text-[10px]` | 10px | | Badge count, bubble timestamp |
| caption | `text-xs` | 12px | | Secondary labels, metadata |
| body-sm | `text-sm` | 14px | | Body text, list items |
| body | `text-base` | 16px | | Default text |
| body-lg | `text-lg` | 18px | | Large body |
| heading-sm | `text-xl` | 20px | semibold | Card titles, modal headers |
| heading | `text-2xl` | 24px | bold | Screen titles |
| heading-lg | `text-3xl` | 30px | bold | Hero/display text |

**Font Families:**
- UI: `Prompt`, `Inter`, ui-sans-serif, system-ui, sans-serif
- Display: `Prompt`, `Poppins`, 'Inter', ui-sans-serif, system-ui, sans-serif (`.font-display`)

---

## 2. Radius Scale

ห้ามใช้ `rounded-[20px]`, `rounded-[22px]`, `rounded-[24px]` ฯลฯ

| Token | Tailwind Class | Value | Usage |
|---|---|---|---|
| xs | `rounded-[4px]` | 4px | Checkbox, small elements |
| sm | `rounded-[6px]` | 6px | Tags, small cards |
| md | `rounded-lg` | 8px | Buttons, inputs |
| lg | `rounded-xl` | 12px | Cards, dialogs |
| xl | `rounded-2xl` | 16px | Sheets, modals |
| 2xl | `rounded-3xl` | 24px | Bottom sheets, story cards |
| full | `rounded-full` | 9999px | Pills, avatars, badges |

---

## 3. Spacing Scale

ห้ามใช้ `gap-[2.5px]`, `w-[380px]`, `h-[...]` โดยไม่จำเป็น

ใช้ Tailwind default scale:
`p-0.5` (2px), `p-1` (4px), `p-1.5` (6px), `p-2` (8px), `p-2.5` (10px),
`p-3` (12px), `p-3.5` (14px), `p-4` (16px), `p-5` (20px), `p-6` (24px) ฯลฯ

**Container Tokens:**
| Component | Width | Class |
|---|---|---|
| Chat List Sidebar | 320px | `w-80` |
| Dialog | 512px | `max-w-lg` |
| Sheet | 384px | `max-w-sm` |
| Message Bubble (mine) | 80% | `max-w-[80%]` |
| Message Bubble (desktop) | 70% | `sm:max-w-[70%]` |

---

## 4. Color System

คง CSS custom properties ใน `index.css` ตามเดิม

| Variable | Value | Usage |
|---|---|---|
| `--navy` | 224 47% 19% | Primary dark (Deep Navy #1A2648) |
| `--coral` | 359 100% 70% | Brand accent (Coral Orange #FF686B) |
| `--offwhite` | 240 11% 96% | Background (#F5F5F7) |
| `--charcoal` | 0 0% 20% | Text (#333333) |
| `--background` | hsl(var(--offwhite)) | Canvas |
| `--foreground` | hsl(var(--navy)) | Text |
| `--card` | 0 0% 100% | Surface |
| `--border` | 224 20% 88% | Borders |
| `--muted` | 224 20% 92% | Muted background |
| `--muted-foreground` | 224 15% 45% | Muted text |
| `--online` | 145 65% 45% | Online status |

ห้ามใช้ hex/rgba โดยตรง ให้ใช้ `hsl(var(--token))` เสมอ

---

## 5. Component Specifications

### Button
- Sizes: `sm` (h-8), `default` (h-9), `lg` (h-10), `icon` (size-9)
- Radius: `rounded-lg` (8px)
- Transition: `transition-all duration-150`

### Input / Textarea
- Height: `h-12` (48px, mobile-friendly)
- Radius: `rounded-xl` (12px)
- Padding: `px-4 py-3`

### Dialog
- Radius: `rounded-2xl` (16px) หรือใช้ `.apple-sheet`
- Padding: `p-6`
- Max-width: `max-w-lg`

### Card (Chat List Item)
- Radius: `rounded-2xl` (16px)
- Padding: `px-3.5 py-3`
- Border: `border-border/50`

### Message Bubble
- Mine: gradient `bubble-mine` (custom utility), radius `rounded-2xl` (16px)
- Theirs: `bubble-theirs` (custom utility), radius `rounded-2xl` (16px)
- Padding: `px-3.5 py-2.5`
- Max-width: `max-w-[80%]`

### Sheet (Bottom / Side)
- Blur: `bg-card/88 backdrop-blur-2xl`
- Radius (bottom): `rounded-t-3xl` (24px)
- Width (side): `max-w-sm`

---

## 6. Apple HIG Utilities (คงของเดิม)

```
.apple-sheet           — blur(32px) + rounded-2xl + shadow
.apple-card-inset      — blur(20px) + rounded-xl + border
.apple-btn-tactile     — scale(0.97) on active
.apple-glass-header    — blur(20px) + safe area padding
```

---

## 7. Icon Policy

ใช้เฉพาะ `lucide-react` เท่านั้น
ห้ามใช้: `iconoir-react`, emoji, unicode symbols, ASCII icons

Icon sizes: 16px, 18px, 20px, 24px
Stroke width: 1.5 หรือ 2

---

## 8. Animation Tokens

| Token | Duration | Easing | Usage |
|---|---|---|---|
| fast | 150ms | ease-out | Button press, hover |
| normal | 200ms | ease-out | Transitions |
| slow | 300ms | ease-out | Sheet, dialog |
| spring | `cubic-bezier(0.16, 1, 0.3, 1)` | Apple-like | Tactile feedback |

Keyframes ที่มีอยู่แล้ว: `msg-in`, `fade-in`, `slide-up`, `typing-bounce`, `pulse-ring`, `splash-logo`, `wave-bar`, `story-progress`, `lock-shake`
