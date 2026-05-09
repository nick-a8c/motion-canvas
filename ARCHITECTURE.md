# Architecture

A reference for how this plugin is built. Aimed at WordPress developers familiar with blocks, hooks, and the wp-scripts build system, but new to this codebase.

This document describes how the plugin works. For session-state and what's currently in flight, see [HANDOFF.md](./HANDOFF.md).

---

## Overview

The plugin provides three distinct user-facing surfaces, each with its own folder under `src/`:

1. **Rive / Spline / Lottie block** — embeds a single animation in four formats
2. **Motion Layout block** — a configuration-only block that builds multi-cell layouts
3. **Edit-mode reveal controls** — adds a Scroll reveal panel to layouts inserted by the Motion Layout block

These surfaces share one module: a layout-template definitions file used by both the configuration UI and the layout output generator.

---

## File map

```
rive-spline-block.php
  Plugin entry. Registers blocks via WordPress 6.8's
  wp_register_block_types_from_metadata_collection. MIME whitelist
  for .riv, .json, .splinecode, .html, .htm. Enqueues frontend
  reveal runtime and the editor BlockEdit filter script.

readme.txt
  WordPress.org-style readme.

src/rive-spline-block/
  block.json     Block metadata
  edit.js        Editor UI: format dropdown, file/URL input, lottie
                 live preview, sidebar inspector, format-switch modal
  view.js        Frontend rendering: rive canvas, spline iframe,
                 lottie animation, html iframe, fallback overlay
  save.js        Serializes attributes to data-* on the wrapper for
                 view.js to read at runtime
  reveal.js      Frontend scroll-reveal runtime (IntersectionObserver
                 + cadence stagger calculation)
  reveal.scss    Reveal animation CSS (per-style easing, durations)
  style.scss     .rsb-builder-layout cell uniformity rules
  editor.scss    Editor-only styles for the block

src/motion-layout/
  block.json     Block metadata for the Motion Layout configuration block
  index.js       Block registration
  edit.js        Inline configuration UI; on Insert, calls
                 buildLayoutBlocks() and replaceBlocks() to swap
                 itself out
  save.js        Returns null — block transforms on insert and
                 never persists
  editor.scss    Configuration UI styling

src/motion-layout-builder/
  index.js              editor.BlockEdit filter that injects a
                        "Scroll reveal" inspector panel into
                        builder-marked Group blocks
  layout-templates.js   Pure-function module: template definitions,
                        merge plans, visible-cell computation
```

The folder name `motion-layout-builder/` is historical. It originally held a `PluginSidebar`-based builder. After the Day-3 refactor it holds an `editor.BlockEdit` filter and the shared template logic. Renaming would touch webpack and PHP enqueue paths; not worth the churn for a cosmetic improvement.

---

## The Rive / Spline / Lottie block

A single content block that embeds one animation. The user picks one format at a time.

### Formats

| Format | Source | Runtime | Editor preview |
|---|---|---|---|
| Rive | `.riv` file upload | `@rive-app/canvas` (Canvas API) | Placeholder ("⚡ Renders on frontend") |
| Spline | URL paste | iframe pointed at `my.spline.design` | Placeholder |
| Lottie | `.json` file upload | `lottie-web` (SVG renderer) | Live animation |
| HTML | `.html` file upload | sandboxed iframe (`sandbox="allow-scripts"`) | Placeholder |

Lottie is the only format that previews live in the editor. The others are too heavy or carry XSS risk to mount during composition. The placeholder communicates this clearly.

### Format switching

When a block has content and the user picks a different format, a confirmation modal appears. Confirming wipes the file or URL and switches the format. Format switching without content (still on placeholder) skips the modal — there's nothing to lose.

### Lottie + React: the isolation pattern

This is the most non-obvious technical detail in the plugin. Read this before touching the Lottie code.

**Problem.** `lottie-web` mounts an SVG into a container element, then mutates that SVG over time. If the container is also a React-managed div (one Claude wrote with a ref and JSX), React's reconciliation tree thinks it knows what's inside. When the block re-renders or unmounts that container, React tries to remove children it tracks; lottie's mutations break those tracking assumptions, throwing `NotFoundError: Failed to execute 'removeChild' on 'Node'`. This crashes the block entirely.

**Solution.** Give lottie its own div that React doesn't manage. The `useEffect` hook:

1. Creates an outer wrapper div via JSX (React owns this)
2. On mount: imperatively creates an inner div via `document.createElement`, appends it to the wrapper, hands the inner div to lottie
3. On cleanup: destroys the lottie animation, then `wrapper.removeChild(innerDiv)`

React only sees the outer wrapper. The inner div with all of lottie's SVG mutations is invisible to its reconciler. See `src/rive-spline-block/edit.js`, the `useEffect` keyed on `[fileUrl, animationType]`.

This pattern is non-negotiable. Removing it brings back the `removeChild` crash on format switching.

### Spline URL validation

Spline's public URLs must start with `https://my.spline.design/`. Common mistakes:

- Pasting iframe embed code instead of the URL
- Pasting Hana embed code (script tag + custom element)
- A URL on the wrong host (e.g. `app.spline.design` rather than `my.spline.design`)
- A URL to a private or unpublished scene

`validateSplineUrl()` in `edit.js` catches the first three at paste/blur time with regex checks. For dead/private URLs, `verifySplineUrlReachable()` does a `fetch()` and looks for an `AccessDenied` XML body or a non-OK status. If the fetch fails for CORS reasons (which can happen for legitimate URLs on different S3 origins), the validator returns `unverified: true` and lets the URL through; the runtime fallback overlay catches genuine load failures at render time.

### Frontend fallback overlay

When an iframe-loaded animation (Spline, HTML) doesn't fire its `load` event within 8 seconds, `view.js` overlays a friendly "Whoops" message with a per-format hint:

- Spline: "Make sure your Spline scene is published…"
- HTML: "Make sure the uploaded .html file is self-contained…"
- Rive: "Make sure the file is a valid .riv export…"
- Lottie: "Make sure the file is a valid Lottie JSON export…"

Same UI, different remediation copy. Implemented as a single `buildFallbackOverlay(hintHTML)` builder.

### HTML format security

The HTML iframe uses `sandbox="allow-scripts"` only. This:

- Permits JavaScript inside the iframe (so embedded Three.js etc. works)
- Blocks DOM access to the parent page
- Blocks cookie and storage access
- Treats the iframe as a unique origin even when served from the same domain
- Blocks form submissions, popups, and top-frame navigation

This matches the security posture WordPress uses for its Custom HTML block. Only authenticated admins can upload HTML files (the plugin whitelists `.html` in `upload_mimes`); the trust model is the same as letting them paste arbitrary HTML in a Custom HTML block.

---

## The Motion Layout block

A configuration-only block. The user inserts it from the inserter (Design category, "Motion Layout"), configures the layout inside the block itself, then clicks "Insert layout" — the block calls `replaceBlocks(clientId, generatedBlocks)`, transforms into the actual layout structure, and unmounts.

The Motion Layout block never persists. `save.js` returns `null`. The user always lands on a real WordPress layout (Group + Columns or Group + nested Groups) after insertion.

### Configuration UI

Four sections, rendered inline inside the block:

1. **Grid size** — rows and columns (1-6 each)
2. **Layout selection** — four template thumbnails (Uniform, Wide-middle, Banded, Asymmetric)
3. **Layout preview** — clickable cells where the user assigns content type (Empty, Rive, Spline, Lottie, HTML, Paragraph, Heading, Image)
4. **Scroll reveal** — style, cadence, speed dropdowns (active when style ≠ "None")

Each section's UI is a regular React component with its own state. State doesn't persist; the block's lifetime ends at "Insert layout."

### The Dropdown wrapper bug

A subtle CSS Grid placement bug bit us during development: WordPress's `Dropdown` component renders an internal wrapper `<div class="components-dropdown">` between our grid container and the cell button. When inline `gridColumn`/`gridRow` styles were applied to the button, the wrapper div became the actual grid item, ignoring our spans, and CSS Grid auto-placement put cells in the wrong slots.

**Fix.** Wrap each `Dropdown` in a div we control (`rsb-motion-layout-config__cell-wrap`). Apply the grid spans to that wrapper. The dropdown's internal wrapper now lives inside ours and doesn't fight grid layout. SCSS makes the dropdown's wrapper `width: 100%; height: 100%` so the inner button still fills the cell. See `src/motion-layout/edit.js` and `editor.scss`.

This bug is worth knowing about because **anywhere we want a WP component to be a grid/flex item, we may need a wrapper**. WP's `Button`, `Card`, etc. likely have similar internal markup.

### Layout templates

Four templates, defined in `src/motion-layout-builder/layout-templates.js` as merge-rule functions that take `(rows, cols)` and return a "merge plan" — a list of merged regions, or `null` if the size doesn't fit the template:

- **Uniform** — no merging; every cell is 1×1. Always valid.
- **Wide middle** — middle row spans full width. Requires odd row count (≥3) and ≥2 columns.
- **Banded** — alternating wide bands at rows 0, 2, 4… Requires ≥2 columns.
- **Asymmetric** — top row spans full width; leftmost column of the remaining rows spans those rows vertically. Requires ≥2 rows and ≥2 columns.

A merge plan is an array of regions: `{ row, col, rowSpan, colSpan }`. Cells listed are anchors; cells covered by a merge are computed via `getCoveredCells()` and excluded from rendering. The shared `getVisibleCells()` returns cells in row-major anchor order with their span data.

The same merge logic drives the layout-selection thumbnails AND the layout-preview clickable grid. They both reflect the actual template logic at the current grid size — not static images.

### Insertion: two output paths

`buildLayoutBlocks()` in `src/motion-layout/edit.js` decides which structure to emit based on (template, rows, columns):

```js
const useAsymmetricGrid =
  templateId === TEMPLATE_ASYMMETRIC && rows >= 3 && columns >= 3;
```

#### Path A — `core/columns` chain (default)

Used for Uniform, Wide-middle, Banded, and Asymmetric at 2×2.

For each grid row, emit one `core/columns` block. For each visible anchor in that row, emit one `core/column` child. Anchors with `colSpan > 1` get a `width` percentage to claim the merged horizontal space. Cells covered by a merge are skipped.

Output skeleton:

```
core/group  (.rsb-builder-layout, reveal classes, align: wide)
├── core/columns
│   ├── core/column → cell content
│   └── core/column → cell content
├── core/columns
│   └── core/column (width: 100%) → wide cell content
└── …
```

This path doesn't support vertical cell spanning — `core/columns` is row-based. That's why Asymmetric at 3+ rows needs a different structure.

#### Path B — Nested grid Groups

Used for Asymmetric at rows ≥ 3 AND columns ≥ 3.

The structural problem: `core/columns` can't make a column inside one row span vertically into the next row. We need a real "tall" cell for Asymmetric.

The solution leverages WordPress's grid-layout Group block (`core/group` with `layout.type: "grid"`):

```
core/group  (outer Stack — flex vertical, .rsb-builder-layout, reveal classes, align: wide)
├── core/group  (constrained — wraps the wide top row)
│   └── cell content
└── core/group  (Grid 1 — layout: { type: grid, columnCount: 2 }, align: wide)
    ├── cell content  (the "tall" left — directly here, no wrapper)
    └── core/group  (Grid 2 — layout: { type: grid, columnCount: cols-1 }, align: wide)
        └── (rows-1) × (cols-1) cell content blocks (in row-major order)
```

How it works: Grid 1 has exactly 2 children — the left cell content and Grid 2. CSS Grid stretches both children to equal heights. Grid 2's height grows to fit all `(rows-1) × (cols-1)` cells stacked inside it. The single left cell stretches vertically to match Grid 2's height. Real tall cell, no CSS hacks.

This pattern was reverse-engineered from a manual layout built in WordPress to verify it was achievable with core blocks alone. The outer Group needs `layout.type: "flex"` with `orientation: "vertical"` so its children stack vertically; otherwise WordPress's default constrained layout would lay them out unpredictably.

Both paths tag the outer Group with the `rsb-builder-layout` marker class plus reveal classes if applicable, so the same `style.scss` rules and the same edit-mode inspector apply regardless of which path produced the layout.

---

## Edit-mode reveal controls

`src/motion-layout-builder/index.js` registers an `editor.BlockEdit` filter that wraps every block's edit component. For blocks that are `core/group` AND carry the `rsb-builder-layout` marker class, the filter injects an `<InspectorControls>` panel with Scroll reveal style/cadence/speed dropdowns.

Reveal config is read from and written to the Group's `className` directly. The filter:

1. Parses style/cadence/speed from regex matches against the className
2. On change, strips the existing reveal classes and re-appends new ones, preserving the marker class and any other user-added classes

This replaces the original `PluginSidebar` approach. No toolbar icon, no separate sidebar — controls live in the block inspector where they belong.

For blocks that are not builder Groups, the filter is a pure pass-through. No DOM cost, no UI change.

---

## Reveal animations

CSS-driven scroll reveals via IntersectionObserver. `reveal.js`:

1. Queries the document for `.rsb-reveal` elements
2. Observes them with IntersectionObserver
3. Adds `.rsb-reveal--in` when an element enters the viewport
4. Computes per-cell stagger delays based on cadence and applies them as `animation-delay` inline styles before the element enters view

Cadence options:

- **Together** — all cells animate at once
- **By cell** — staggered through cells in document order
- **By row** — cells in the same `.wp-block-columns` row share a delay
- **By column** — cells in the same column position share a delay

Stagger uses an eased curve (`Math.pow(i, 0.7) * staggerMs`) so the reveal tail doesn't drag at large cell counts.

### Per-style easing

Different reveal styles use different cubic-bezier curves and durations, defined in `reveal.scss`:

- Fade, Fade up, Slide — house curve `cubic-bezier(0.4, 0.14, 0.3, 1)` over the full duration
- Zoom — softer `cubic-bezier(0.2, 0.7, 0.3, 1)` for natural scale
- Blur — splits timing: filter resolves at 70% of duration, opacity at full duration

Slide direction is cadence-aware: when cadence is "By column," slide direction switches from horizontal to vertical so cells appear to push each other downward instead of sideways.

`prefers-reduced-motion: reduce` is respected — content appears instantly with no animation.

### Cadence on Path-B Asymmetric output

The cadence target collection in `reveal.js` queries `:scope > .wp-block-columns` to find rows and `:scope > .wp-block-column` to find cells. This works for Path A (`core/columns`-based output).

Path B (Asymmetric grid) doesn't have those elements. The reveal still fires on the outer Group (it has `.rsb-reveal` and the runtime treats it as a single element), but cadence "By row" / "By column" falls through to a whole-block animation since the structure isn't row/column-shaped.

This is an intentional simplification, not a bug. Making cadence semantically meaningful for the grid output would require introspecting `grid-row` / `grid-column` styles at runtime — possible, but not urgent. "By cell" cadence would naturally work if we updated the selector; it's left as a polish task for a future session.

---

## Build pipeline

Standard wp-scripts setup. `npm start` runs the dev watcher; `npm run build` produces a deployable `build/` directory.

Block discovery: wp-scripts scans `src/` for `block.json` files and produces `build/blocks-manifest.php`. The PHP entry calls `wp_register_block_types_from_metadata_collection( __DIR__ . '/build', __DIR__ . '/build/blocks-manifest.php' )` — adding a new block under `src/` requires no PHP changes; just a watcher restart.

`block.json` `editorStyle` paths must point at the file wp-scripts actually emits. For blocks that import their styles via `import './editor.scss'` in `index.js`, wp-scripts bundles styles into the editor script's companion CSS file (named after the entry — typically `index.css`), not a separate `editor.css`. If `editorStyle` references a file wp-scripts didn't emit, the styles silently fail to load.

Watcher restarts: required when adding/deleting `block.json` files or changing `package.json`. Hot-reload handles `.js` and `.scss` changes within an existing block.

---

## Known constraints (intentional, not bugs)

1. **Wide middle requires odd row count.** No clear middle row at even row counts. The thumbnail shows "N/A at this size."
2. **Cadence "By row" / "By column" on Path-B Asymmetric output** falls through to whole-block animation. Documented above.
3. **No editor preview for Rive, Spline, or HTML.** Out of scope by design — too heavy or too risky to mount during composition.
4. **Spline cross-origin opacity.** The plugin can't read Spline's iframe content from its own origin. Load-error detection is timing-based (8s timeout) rather than DOM-based.
5. **The `motion-layout-builder/` folder name is historical.** Renaming would touch the webpack and PHP enqueue paths.
