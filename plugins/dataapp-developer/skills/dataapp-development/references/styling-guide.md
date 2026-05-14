# Styling Guide

**Use this when:** styling a new app, or asked to apply brand-specific overrides.

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

- **Footer pattern:** custom HTML/CSS injected via `st.markdown` with a flex container, copyright on the left, version on the right.

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

## Combined Python + Node (bundled toolchain)

For Vite / Next.js with Tailwind, define the palette once in `tailwind.config.ts` and reference it everywhere:

```ts
// tailwind.config.ts
export default {
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
      fontFamily: {
        sans: ['system-ui', 'sans-serif'],
      },
    },
  },
};
```

No custom typefaces. No shadcn theme overlay unless the user explicitly asks for one — defaulting to a component library introduces visual conventions that conflict with the goal of consistency across apps coming out of this skill.

## Brand customization — only when explicitly requested

Apply customer-specific colors / fonts / logos **only** when the user asks for them. Even then, keep the override surface narrow — change the four tokens (`primary`, `bg`, `bgAlt`, `text`) and the font family if needed; don't redesign components.

Override paths:

- **CDN Tailwind (single-Node + static):** change the values in the inline `tailwind.config` `<script>` block in `<head>`.
- **Bundled Tailwind (Python+Node):** change the values in `tailwind.config.ts`.
- **Streamlit:** change `[theme]` values in `.streamlit/config.toml` (or the JSON config string for Code-deployed apps), or use the Keboola Theming UI's "Custom" option.

If a separate company-styling or theme-factory skill exists in the user's setup, defer to it — that's where customer brand defaults belong. This skill ships only the Keboola default.
