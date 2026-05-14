# Styling Guide

**Use this when:** you need default Keboola styling, brand customization, or to pick a frontend stack for visual presentation.

## Lightweight default (dashboarding default)

The preferred stack for single-Node + static frontend apps. Tailwind via CDN, Chart.js via CDN, vanilla HTML + minimal JS modules. No bundler, no build step.

Keboola palette:

- Primary: `#1F8FFF`
- Background: `#FFFFFF`
- Secondary background: `#E6F2FF`
- Text: `#222529`
- Font: sans serif (system default)

Minimal `<head>` snippet:

```html
<head>
  <meta charset="utf-8" />
  <title>Keboola App</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
</head>
```

Reference app: [`keboola-rnd/kai-pricing-calculator-app` on `nodejs-pricing-simulator`](https://github.com/keboola-rnd/kai-pricing-calculator-app/tree/nodejs-pricing-simulator).

## Heavier framework option

Vite/Next.js + React + shadcn/ui. Reach for this when the UI complexity justifies a bundler and a component library — for example, intricate forms, drag-and-drop, multi-step wizards, or a custom design system.

Conventions (from FI app and profitline-js-app):

- **Fonts:** Plus Jakarta Sans (`--font-sans`), JetBrains Mono (`--font-mono`) for code blocks.
- **Colors:** Single `COLORS` constant in `lib/constants.ts`; mirrored as CSS variables in `app/globals.css` (`@theme` block for Tailwind 4).
- **Formatters:** Number / currency / percent formatters in the same `lib/constants.ts` (or `lib/formatters.ts`). Use them everywhere — never `.toFixed()` inline.
- **No emoji in UI elements** (FI/profitline convention).

References:

- FI app: `keboola-rnd/keboola-financial-intelligence-app` (note: deployed on Vercel, not Keboola; conventions still useful).
- profitline-js-app: `keboola/profitline-js-app` (Keboola-deployed dual-server).

## Streamlit

Set the theme via either:

**(a) Theming UI** in the Keboola app configuration. Preferred for simple cases — pick a predefined theme (Keboola, Light Red, Light Purple, Light Blue, Dark Green, Dark Amber, Dark Orange) or set custom colors via the color pickers.

**(b) Repository-committed `.streamlit/config.toml`** for git-deployed apps:

```toml
[theme]
font = "sans serif"
textColor = "#222529"
backgroundColor = "#FFFFFF"
secondaryBackgroundColor = "#E6F2FF"
primaryColor = "#1F8FFF"
```

For Code-deployed Streamlit apps that can't commit a `config.toml`, set `parameters.dataApp.streamlit.config.toml` as a string in the JSON config editor:

```json
{
  "parameters": {
    "dataApp": {
      "streamlit": {
        "config.toml": "[theme]\nprimaryColor = \"#1F8FFF\"\n[server]\nmaxUploadSize = 500"
      }
    }
  }
}
```

**General Design Guide extras** (for Streamlit, from `help.keboola.com/data-apps/general-design-guide/`):

- **Logo:** store a PNG in `static/`, display with:

  ```python
  LOGO_IMAGE_PATH = os.path.join(os.path.dirname(__file__), 'static/keboola.png')
  st.image(LOGO_IMAGE_PATH)
  # Hide the fullscreen-view button on the logo
  st.markdown('<style>button[title="View fullscreen"]{visibility:hidden;}</style>', unsafe_allow_html=True)
  ```

- **Hide auto-generated anchor links** on headers:

  ```python
  st.markdown(
      "<style>h1>a,h2>a,h3>a,h4>a,h5>a,h6>a{display:none!important;}</style>",
      unsafe_allow_html=True,
  )
  ```

- **Footer pattern:** custom HTML/CSS injected via `st.markdown` with a flex container, copyright on the left, version on the right.

## Brand customization

When a customer has a brand kit, override the defaults via:

- **CDN Tailwind (lightweight stack):** add an inline `<script>` config in `<head>`:

  ```html
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: { primary: '#FF5D5D', accent: '#FFE6E6' },
          },
        },
      },
    };
  </script>
  ```

- **Bundled Tailwind (heavier stack):** edit `tailwind.config.ts` and `app/globals.css`:

  ```ts
  // tailwind.config.ts
  export default {
    theme: {
      extend: {
        colors: {
          brand: { primary: '#FF5D5D', accent: '#FFE6E6' },
        },
      },
    },
  };
  ```

- **Streamlit:** edit `[theme]` in `.streamlit/config.toml` or the JSON config string.

## Hook for a company-styling skill

If a separate "company-styling" or `theme-factory` skill exists in the user's setup, that's where customer-brand defaults should live. This reference covers the platform-default look (Keboola palette) only — it does NOT bake in customer-specific colors / fonts / logos. Brand customization belongs in a dedicated skill or a project-level config file.
