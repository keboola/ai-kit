# Styling Guide

**Use this when:** styling a new app, or asked to apply brand-specific overrides. For the bundled React+Vite+shadcn+ECharts stack, see [styling-react-bundled.md](styling-react-bundled.md) instead.

## Contents
- Default to the Keboola palette
- Default "Powered by Keboola" footer
- Streamlit theming
- Single Node + static frontend (CDN Tailwind)
- Brand customization

## Default to the Keboola palette — every app, every stack

Unless the user explicitly asks for a different brand or design system, **use the Keboola palette across all three stacks** (Streamlit, single-Node + static, combined Python+Node). The point is consistency — apps coming out of this skill should look like they belong together.

The palette:

| Token | Value |
|---|---|
| Primary | `#1F8FFF` |
| Background | `#FFFFFF` |
| Secondary background | `#E6F2FF` |
| Text | `#222529` |
| Font | sans-serif (system default) |

No custom typeface, no design-system overlay, no shadcn theme. Plain Tailwind defaults (system font stack) with the palette above for color tokens. Same values across all three stacks.

## Default "Powered by Keboola" footer

Every app produced from this skill's templates ships with a small, low-contrast "Powered by Keboola" footer. The point is gentle attribution that doesn't fight the app's own UI — small text, muted slate color, fades to full opacity on hover.

The asset is the Keboola wordmark SVG (`keboola-logo.svg`), bundled into each template's static directory. Don't redraw or recolor it; it's the official mark.

**Single-Node + static (CDN Tailwind):**

```html
<footer class="max-w-5xl mx-auto px-8 py-6 flex items-center justify-center gap-2 text-xs text-slate-400 opacity-80 hover:opacity-100 transition-opacity">
  <span>Powered by</span>
  <img src="/keboola-logo.svg" alt="Keboola" class="h-4 w-auto" />
</footer>
```

Adjust the `max-w-*` to match the page's main content width.

**Streamlit:** read the SVG once at import time and embed it as a base64 data URI inside `st.markdown(..., unsafe_allow_html=True)` — that avoids needing Streamlit's static-serving config flag and works identically in local dev and production.

```python
import base64, os
_LOGO_PATH = os.path.join(os.path.dirname(__file__), "static", "keboola-logo.svg")
with open(_LOGO_PATH, "rb") as f:
    _LOGO_DATA_URI = "data:image/svg+xml;base64," + base64.b64encode(f.read()).decode()

st.markdown(
    f"""
    <div style="display:flex;align-items:center;justify-content:center;gap:0.5rem;
                padding:1.5rem 0 0.5rem;font-size:0.75rem;color:#94a3b8;opacity:0.85;">
      <span>Powered by</span>
      <img src="{_LOGO_DATA_URI}" alt="Keboola" style="height:1rem;width:auto;" />
    </div>
    """,
    unsafe_allow_html=True,
)
```

Keep the footer on every page of multi-page apps — render it from a shared helper rather than copying the markup. The user can remove or replace it (e.g. for a customer brand override), but the templates ship with it by default.

## Streamlit

Set the theme via either:

**(a) Theming UI** in the Keboola app configuration. Preferred for simple cases — pick the predefined **Keboola** theme (which matches the palette above) or set the values via the color pickers.

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
        "config.toml": "[theme]\nprimaryColor = \"#1F8FFF\"\nbackgroundColor = \"#FFFFFF\"\nsecondaryBackgroundColor = \"#E6F2FF\"\ntextColor = \"#222529\"\nfont = \"sans serif\""
      }
    }
  }
}
```

Streamlit-specific UI extras:

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

- **Footer:** the default "Powered by Keboola" footer (see above) ships in the template. For an additional copyright / version line, render a second `st.markdown` block above it using the same muted slate color.

## Single Node + static frontend (CDN Tailwind)

Tailwind via CDN, Chart.js via CDN. Set the Keboola palette in the inline Tailwind config so every component/utility can reach it:

```html
<head>
  <meta charset="utf-8" />
  <title>Keboola App</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            kbc: {
              primary: '#1F8FFF',
              bg: '#FFFFFF',
              bgAlt: '#E6F2FF',
              text: '#222529',
            },
          },
        },
      },
    };
  </script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
</head>
<body class="bg-kbc-bg text-kbc-text font-sans">
  <!-- ... -->
</body>
```

Use `bg-kbc-primary`, `text-kbc-primary`, `bg-kbc-bgAlt` for surfaces. Don't sprinkle raw hex literals across the page — drive everything from the four tokens above.

For Chart.js, set the brand color on each dataset:

```javascript
new Chart(ctx, {
  type: 'bar',
  data: { datasets: [{ data: [...], backgroundColor: '#1F8FFF' }] },
});
```

For a heavier React+Vite+shadcn stack with HSL CSS-variable tokens, dark mode, and ECharts integration, see [styling-react-bundled.md](styling-react-bundled.md). Reach for it only when the UI complexity actually justifies a bundler.

## Brand customization — only when explicitly requested

Apply customer-specific colors / fonts / logos **only** when the user asks for them. Even then, keep the override surface narrow — change the four tokens (`primary`, `bg`, `bgAlt`, `text`) and the font family if needed; don't redesign components.

Override paths:

- **CDN Tailwind (single-Node + static):** change the values in the inline `tailwind.config` `<script>` block in `<head>`.
- **Bundled Tailwind (Python+Node):** change the values in `tailwind.config.ts` — see [styling-react-bundled.md](styling-react-bundled.md).
- **Streamlit:** change `[theme]` values in `.streamlit/config.toml` (or the JSON config string for Code-deployed apps), or use the Keboola Theming UI's "Custom" option.

**Also remove or replace the default "Powered by Keboola" footer.** It is template scaffolding, not a styling token — changing palette values leaves it untouched. When applying a customer brand:

- **HTML templates:** delete the `<footer>...keboola-logo.svg...</footer>` block in `index.html`, or swap the `<img src>` for the customer's logo and update the surrounding text. The bundled `keboola-logo.svg` asset can be deleted too once nothing references it.
- **Streamlit:** delete (or replace) the `st.markdown` footer block and the `_LOGO_PATH` / `_LOGO_DATA_URI` lines at the top of `streamlit_app.py`. Remove `static/keboola-logo.svg` if unused.

Don't ship a customer app with both brands stacked — that's worse than no attribution at all.

If a separate company-styling or theme-factory skill exists in the user's setup, defer to it — that's where customer brand defaults belong. This skill ships only the Keboola default.
