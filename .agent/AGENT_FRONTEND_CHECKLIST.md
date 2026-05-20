# Front-end style checklist (all agents)

**Portable instructions:** canonical copy lives in **`.agent/`** (this file) and is linked from root [`AGENTS.md`](../AGENTS.md). Any assistant can read it without Cursor-specific paths. Full narrative, rationale, and ESLint examples: [`CODESTYLEGUIDE.md`](./CODESTYLEGUIDE.md) (same folder).

Apply the following to **all new and changed** front-end code (TypeScript, TSX, JavaScript, JSX).

## Formatting (match Prettier)

| Setting                | Value         |
| ---------------------- | ------------- |
| trailingComma          | `"none"`      |
| singleQuote            | `false`       |
| semi                   | `false`       |
| printWidth             | `120`         |
| singleAttributePerLine | `true`        |
| arrowParens            | `"avoid"`     |
| bracketSpacing         | `true`        |
| useTabs                | `false`       |
| tabWidth               | `2`           |
| endOfLine              | `"lf"`        |
| quoteProps             | `"as-needed"` |

- Double quotes; **no** semicolons; **no** trailing commas; **one JSX attribute per line** when multiline; arrow parens **avoid** for single param; spaces inside object braces.
- Run the project formatter before finishing (`pnpm format` or equivalent in `package.json`).

## TypeScript & JavaScript

- Prefer `Boolean(x)` over `!!x`. Prefer `??` over `||` for defaults. Use optional chaining.
- Naming: components **PascalCase**, hooks **`use*`**, booleans **`is*`** / **`has*`** / **`can*`**. Prefer string literal unions over enums unless justified.
- Do not mutate React state; use functional updates / spread.
- Import order: built-ins → external → internal (absolute) → relative; side-effect imports first with a blank line after.

```ts
const hasItems = Boolean(items?.length);
const pageSize = incomingPageSize ?? 20;
const name = user?.profile?.name;
setItems((prev) => [...prev, next]);
```

## React & JSX

- **Component shape (app components):** under `src/app/components/` but **not** in `ui/` or `figma/`, use **`export const Name = (props) => { ... }`** for components (arrow + `const`). Do not use `export function Name` for those components. See `CODESTYLEGUIDE.md` (React → Component declarations). Hooks and non-JSX utilities are exempt.
- Conditional UI: **ternaries** or explicit `? … : null` — **not** bare `&&` (avoids rendering `0` / `""`).
- Boolean props: real booleans, never string `"true"` / `"false"`.
- **Stable, unique** `key`s — not index when order/content changes; not unstable duplicates (e.g. name).
- Prefer `<></>`; avoid extra wrapper `div`s when unnecessary.
- Prop order: required → optional → handlers → `className` → `data-*` → test ids.
- Conditional classes: **`clsx`** (or project equivalent), not string concat or filter/join arrays.
- **Structured `Dialog` modals:** prefer **`StandardDialog`** from `src/components/common/StandardDialog.tsx` for header + body + footer flows; use **`AlertDialog`** for true alert confirmations; use raw **`ui/dialog`** only for bespoke layouts. See [`CODESTYLEGUIDE.md`](./CODESTYLEGUIDE.md) → **Dialogs and modals**.

```tsx
{
  isLoading ? <Spinner /> : null;
}
{
  count > 0 ? <Badge>{count}</Badge> : null;
}
<Button disabled={isBusy} />;
items.map((item) => <Row key={item.id} item={item} />);
import clsx from "clsx";
<div className={clsx("base", isActive && "active")} />;
```

## Hooks

- Hooks only at top level of components or custom hooks; not conditional/loops.
- Extract non-trivial reusable logic to **`use*`** hooks; do not extract one-off trivia.
- `useEffect`: sync with outside world only — **not** for derived render state (derive in render). Minimal effects, full dependency lists, fix exhaustive-deps properly (no casual disable). Clean up subscriptions/timers. Avoid stale closures; use functional state updates where needed.
- `useMemo` / `useCallback`: only when expensive or referential stability matters.
- `useRef`: imperative/DOM/non-re-render mutables — not derived UI state.
- Prefer a consistent data-fetching pattern; handle loading/error/empty; cancel on unmount.

## Accessibility, i18n, testing

- a11y: keyboard access, correct `aria-*` and labels, meaningful `alt` (empty for decorative), no `div`/`span` as buttons/links.
- i18n: no hardcoded user-facing strings; static keys; use library plurals/formatting; default `en` unless project says otherwise.
- Tests: behavioral, user-visible outcomes; mock network boundaries; test pure functions.

## Files, errors, git

- **One `export const` React component per file** (under `src/app/components/` except `ui/` + `figma/`); extra **`export type`** in the same file is OK. For several related components, use a **subfolder** + optional **`index.ts`** re-exports—do not put multiple component `const`s in one `.tsx`. Co-locate tests/helpers in that folder. Prefer **named exports** unless default export is required. Split when **~200+** lines or multiple responsibilities.

```
src/components/SomeComponent/
  SomeComponent.tsx
  SomeComponent.spec.ts
  someComponentFunc.ts
  someComponentFunc.spec.ts
```

- **Next.js route modules** (`src/app/**/page.tsx`, `layout.tsx`, and other App Router entry files in route segments): assign the component to a **`const` arrow function**, then **`export default` that name** at the bottom. Do **not** use `export default function Name() { ... }` or `export default () => {}`. Use this under route groups such as `src/app/(dashboard)/`. Full notes: [`CODESTYLEGUIDE.md`](./CODESTYLEGUIDE.md) (Next.js App Router).

```tsx
const HomePage = () => {
  return <Overview />;
};

export default HomePage;
```

- Fail fast with clear UX; error boundaries where appropriate; logger for unexpected cases — avoid `console.log` in committed code.
- Commits: small, focused; branches `feat/`, `fix/`, `chore/`. PRs: what/why; screenshots for UI. Run format + lint before push.

## Lint mindset

Align with ESLint: React, hooks, jsx-a11y, import order, unused imports, no `any` without justification. See [`CODESTYLEGUIDE.md`](./CODESTYLEGUIDE.md) for suggested rule set.

## Review quick pass

- [ ] Formatting matches Prettier settings above
- [ ] No bare `&&` for conditional elements
- [ ] Keys stable and unique
- [ ] `Boolean()` / `??` / optional chaining used appropriately
- [ ] Hooks rules and effect deps respected
- [ ] a11y for interactive controls and images
- [ ] No stray `console.log`; errors handled meaningfully
