# Styling — React + Vite (bundled toolchain)

**Use this when:** the user has explicitly chosen a bundled React stack (Vite + shadcn/ui + ECharts). For the default Keboola palette and the lighter CDN-Tailwind / Streamlit paths, see [styling-guide.md](styling-guide.md) first.

## Contents
- When to reach for this
- Recommended stack
- CSS-variable token system
- Project structure
- ErrorBoundary is required
- Typography
- Tabular numerals
- Charts: read tokens at runtime
- Loading / error / empty states

## When to reach for this

The lightweight default (CDN Tailwind + vanilla JS — see [styling-guide.md](styling-guide.md)) is enough for most dashboarding apps. Reach for a bundled React stack when:

- **UI complexity outgrows vanilla JS.** Multi-page navigation with shared layout, intricate forms with conditional fields, drag-and-drop, multi-step wizards, modal/drawer stacks. State management with `useReducer` / TanStack Query becomes cleaner than ad-hoc DOM updates.
- **You need a component library.** shadcn/ui (Radix primitives + Tailwind) gives you accessible Dialog / Select / Popover / Combobox / Toast / Tooltip primitives that are tedious to hand-roll correctly.
- **You're rendering thousands of interactive elements.** A React reconciler + virtualisation (e.g. TanStack Virtual) outperforms manual DOM patching past a certain table size.
- **The team is already a React shop** and bundler tooling is in their muscle memory.

**Stay with the lightweight stack when** the app is "a few charts and a table" — a bundler adds cold-start time, build complexity, and a larger surface to maintain for limited UI gain.

**Important:** React does not require Python on the backend. A single Express server serving both Vite-built static assets and `/api/*` endpoints covers most React data apps. The combined Python+Node template applies only when you genuinely need a Python backend (existing Python codebase, ML model in Python, FastAPI services).

## Recommended stack

| Layer | Choice |
|---|---|
| Build / dev server | Vite |
| Language | TypeScript |
| UI framework | React 18 |
| Styling | Tailwind CSS (with `darkMode: "class"`) |
| Component primitives | shadcn/ui (Radix UI + `class-variance-authority` + `clsx` + `tailwind-merge`) |
| Charts | ECharts via `echarts-for-react` (better axis/tooltip customisation than Chart.js; native dark-mode theming) |
| Server state | TanStack Query |
| Routing | React Router |
| Icons | Lucide React |
| Toasts | Sonner |
| Animation | Framer Motion (only if needed — no entrance animations on KPIs by default) |
| Backend | Express on a single Node process; serves the Vite build output as static and routes `/api/*` to handlers |

## CSS-variable token system

Drive the Keboola palette from HSL CSS variables rather than literal hex in `tailwind.config.ts`. HSL is what shadcn assumes, dark-mode swap is one CSS rule, and chart libraries can read tokens dynamically.

`src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Keboola brand */
    --keboola-blue: 210 100% 56%;   /* #1F8FFF in HSL */
    --keboola-light: 210 100% 95%;  /* #E6F2FF */
    --keboola-text: 218 11% 15%;    /* #222529 */

    /* Semantic tokens */
    --background: 0 0% 100%;
    --foreground: 218 11% 15%;
    --card: 0 0% 100%;
    --card-foreground: 218 11% 15%;
    --primary: 210 100% 56%;
    --primary-foreground: 0 0% 100%;
    --secondary: 210 100% 95%;
    --secondary-foreground: 218 11% 15%;
    --muted: 210 40% 96%;
    --muted-foreground: 215 16% 47%;
    --accent: 210 100% 95%;
    --accent-foreground: 210 100% 30%;
    --border: 220 13% 91%;
    --input: 220 13% 89%;
    --ring: 210 100% 56%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 100%;
    --success: 152 69% 31%;
    --success-foreground: 0 0% 100%;
    --warning: 38 92% 50%;
    --warning-foreground: 0 0% 100%;

    /* Chart palette — primary + 7 distinguishable companions */
    --chart-1: 210 100% 56%;
    --chart-2: 152 69% 31%;
    --chart-3: 262 52% 47%;
    --chart-4: 38 92% 50%;
    --chart-5: 215 20% 50%;
    --chart-6: 199 89% 48%;
    --chart-7: 346 77% 50%;
    --chart-8: 142 71% 45%;

    --radius: 0.5rem;
  }

  .dark {
    --background: 230 25% 7%;
    --foreground: 220 14% 96%;
    --card: 230 25% 11%;
    --card-foreground: 220 14% 96%;
    --primary: 210 100% 62%;
    --primary-foreground: 0 0% 100%;
    --secondary: 230 20% 18%;
    --secondary-foreground: 220 14% 96%;
    --muted: 230 20% 16%;
    --muted-foreground: 215 12% 58%;
    --border: 230 20% 22%;
    --input: 230 20% 22%;
    --ring: 210 100% 62%;
    /* destructive / success / warning typically stay close to light values */
  }
}
```

`tailwind.config.ts` consumes the variables (no hex literals here):

```ts
import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        success: { DEFAULT: 'hsl(var(--success))', foreground: 'hsl(var(--success-foreground))' },
        warning: { DEFAULT: 'hsl(var(--warning))', foreground: 'hsl(var(--warning-foreground))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        keboola: {
          blue: 'hsl(var(--keboola-blue))',
          light: 'hsl(var(--keboola-light))',
          text: 'hsl(var(--keboola-text))',
        },
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
          '6': 'hsl(var(--chart-6))',
          '7': 'hsl(var(--chart-7))',
          '8': 'hsl(var(--chart-8))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
```

The result: every component reaches for `bg-primary` / `text-foreground` / `border-border`. Dark mode is one `<html class="dark">` toggle. Charts read `var(--chart-1)` through `var(--chart-8)` at runtime so axis text, gridlines, and series colours respect the active theme.

## Project structure

```
src/
  components/          # shadcn primitives + your composed components
    ui/                # generated shadcn components (button, card, dialog, ...)
    layout/            # MainLayout, SideNav, Header
    charts/            # ReactECharts wrappers reading CSS-var tokens
  pages/               # route page components
  hooks/               # TanStack Query hooks, useTheme, useDebounce
  lib/
    api.ts             # fetch wrappers around /api/*
    formatters.ts      # formatCurrency / formatPercent / formatCount
    utils.ts           # cn() helper from shadcn (clsx + tailwind-merge)
  contexts/            # ThemeProvider, etc.
  App.tsx              # router + providers + ErrorBoundary at the root
  main.tsx             # ReactDOM.createRoot + window.error handlers
  index.css            # CSS variables + @tailwind directives
```

## ErrorBoundary is required

A React render-time crash unmounts every component above the failure. Without a boundary the user sees a blank white page — no error visible in the UI. Always wrap:

1. **The app root** in an `<ErrorBoundary>` so any uncaught render error is shown to the user, not silently swallowed.
2. **Each chart card / data widget** in its own boundary so one failing chart doesn't take the whole dashboard down.

Add `window.addEventListener('error', ...)` and `window.addEventListener('unhandledrejection', ...)` in `main.tsx` so async errors at least surface in the browser console.

The React Docs cover the class-component pattern (`getDerivedStateFromError` + `componentDidCatch`); there are also a few small library options (`react-error-boundary`). Either is fine — what matters is that something catches.

## Typography

Default to the system sans-serif stack (`system-ui, sans-serif`). It's fast, consistent across OSes, and avoids a remote font load. If the design needs a specific feel, **Inter** is a sensible, free Google Font that pairs well with shadcn defaults. Don't pick a brand-specific typeface (e.g. Plus Jakarta Sans) unless the user explicitly asks for it — that's a brand override, not a default.

## Tabular numerals

Always use `font-variant-numeric: tabular-nums` (or Tailwind `tabular-nums`) on KPI tiles, table columns of numbers, anything where digit alignment matters. Without it, proportional digits make right-aligned numbers visually jagged.

## Charts: read tokens at runtime

ECharts (and Recharts to a lesser degree) accept colour values per-series. Read the CSS variable at the moment you build the chart option so dark-mode swap propagates without re-renders or hardcoded re-themes:

```tsx
function tok(name: string): string {
  return `hsl(${getComputedStyle(document.documentElement).getPropertyValue(name).trim()})`;
}

const option = {
  textStyle: { color: tok('--foreground') },
  xAxis: { axisLine: { lineStyle: { color: tok('--border') } } },
  series: [{ type: 'line', data, lineStyle: { color: tok('--chart-1') } }],
};
```

## Loading / error / empty states

Same rule as in [dashboard-patterns.md](dashboard-patterns.md): every data-fetching component handles `isLoading`, `isError`, and empty-data explicitly. With TanStack Query that's just `query.isPending` / `query.isError` branches. Skeletons from shadcn (`<Skeleton className="h-32 w-full" />`) match the eventual content dimensions so there's no layout shift on resolve.
