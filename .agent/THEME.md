# Observe the theme

Latex remaps common Tailwind colors in `src/app/globals.css` under `[data-theme]`. Dark and styled themes invert several “black/white” classes. **Do not treat `bg-black` / `text-white` as a dark overlay.**

The Figma Make terminal look is the **`dark`** theme. Implement chrome with CSS variables and `.term-*` utilities — never hard-code Make hex (`#00ff41`, `#030507`, `#ff2d78`, etc.) in components.

## Tokens (every theme must define these)

| Token | Role |
| --- | --- |
| `--theme-bg` / `--theme-panel` / `--theme-card` / `--theme-card-2` | Page and nested surfaces |
| `--theme-text` / `--theme-text-muted` / `--theme-text-soft` | Copy hierarchy |
| `--theme-border` / `--theme-border-strong` | Hairline / hover borders |
| `--theme-accent` / `--theme-accent-2` / `--theme-accent-danger` | Primary, secondary, danger |
| `--theme-button-bg` / `--theme-button-text` / `--theme-button-border` | Primary control |
| `--theme-input-bg` / `--theme-input-border` | Fields |
| `--theme-radius` | Max corner rounding |
| `--theme-scanline-opacity` / `--theme-vignette-opacity` / `--theme-flicker-play` | CRT overlays |
| `--theme-font-ui` / `--theme-font-display` | Body vs headings |
| `--theme-nav-height` | Sticky app nav |
| `--theme-overlay` | Modal/drop scrim (not `bg-black/90`) |
| `--theme-glow` / `--theme-heading-glow` / `--theme-focus` | Neon / focus |

## What remaps

| Class | Becomes |
| --- | --- |
| `bg-black` + `text-white` (together, especially on `button`) | Primary control: `--theme-button-bg` / `--theme-button-text` |
| `text-white` alone | `--theme-button-text` (often **dark** on dark themes) |
| `bg-black` alone | `--theme-button-bg` (often **light** / neon on dark themes) |
| `border-neutral-200`, `text-neutral-500`, `bg-neutral-50`, `text-neutral-700` | Theme border / muted text / panel mix |

Opacity variants are **not** remapped: `text-white/65`, `border-white/15`, `bg-black/90` stay literal white or black. Mixing a remapped surface with a literal `/N` color is how you get white-on-white or black-on-black.

## Safe patterns

- Page and overlay chrome: `bg-[var(--theme-bg)]`, `bg-[var(--theme-panel)]`, `text-[var(--theme-text)]`, `border-neutral-200`, `modal-overlay`, `modal-panel`.
- Controls: `TermButton`, `TermInput`, `term-btn`, `term-input`.
- Muted copy: `text-neutral-500` or `text-neutral-600`.
- Primary actions: `bg-black text-white` as a pair, or `term-btn primary`.
- Secondary actions: `border-neutral-200` or `term-btn`.
- Photo wells / canvases may stay a real dark (`bg-neutral-950`) so the image is visible; labels around them still use theme tokens.

## Do not

- Hard-code Make palette hex in TSX.
- Build fullscreen dialogs with `bg-black text-white` plus `text-white/N` or `border-white/N`.
- Put remapped `text-white` on a literal `bg-black/90` lightbox (close controls disappear on dark themes).
- Hard-code `#fff` / `#000` for app chrome.
