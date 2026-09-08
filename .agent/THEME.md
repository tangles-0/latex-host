# Observe the theme

Latex remaps common Tailwind colors in `src/app/globals.css` under `[data-theme]`. Dark and styled themes invert several “black/white” classes. **Do not treat `bg-black` / `text-white` as a dark overlay.**

## What remaps

| Class | Becomes |
| --- | --- |
| `bg-black` + `text-white` (together, especially on `button`) | Primary control: `--theme-button-bg` / `--theme-button-text` |
| `text-white` alone | `--theme-button-text` (often **dark** on dark themes) |
| `bg-black` alone | `--theme-button-bg` (often **light** on dark themes) |
| `border-neutral-200`, `text-neutral-500`, `bg-neutral-50`, `text-neutral-700` | Theme border / muted text / panel mix |

Opacity variants are **not** remapped: `text-white/65`, `border-white/15`, `bg-black/90` stay literal white or black. Mixing a remapped surface with a literal `/N` color is how you get white-on-white or black-on-black.

## Safe patterns

- Page and overlay chrome: `bg-[var(--theme-bg)]`, `bg-[var(--theme-panel)]`, `text-[var(--theme-text)]`, `border-neutral-200`.
- Muted copy: `text-neutral-500` or `text-neutral-600`.
- Primary actions: `bg-black text-white` as a pair.
- Secondary actions: `border-neutral-200`.
- Photo wells / canvases may stay a real dark (`bg-neutral-950`) so the image is visible; labels around them still use theme tokens.

## Do not

- Build fullscreen dialogs with `bg-black text-white` plus `text-white/N` or `border-white/N`.
- Put remapped `text-white` on a literal `bg-black/90` lightbox (close controls disappear on dark themes).
- Hard-code `#fff` / `#000` for app chrome.
