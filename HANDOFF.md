# Handoff

Living doc. Current state of the plugin and what's still in flight. Updated whenever someone leaves the project mid-session.

For how the plugin is built, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Status

**The plugin is in shippable shape.** Every code task is done. Remaining work is content (a demo page and a demo video) and is not coding.

## What's done

### The block (`src/rive-spline-block/`)
- Four formats: Rive (.riv), Spline (URL), Lottie (.json), HTML (.html)
- Format-switching modal with content preservation warning
- Spline URL validation (paste-time + blur-time, reachability check + AccessDenied detection)
- Lottie editor preview with React/lottie-web isolation pattern
- Frontend fallback overlay (8s timeout) for Spline / HTML / Rive / Lottie load failures
- HTML iframe with `sandbox="allow-scripts"` security posture

### The Motion Layout block (`src/motion-layout/`)
- Inline configuration UI (grid size, layout selection, layout preview, scroll reveal)
- Grid size capped at **4 rows × 3 columns**
- Four templates: Uniform, Wide-middle, Banded, Asymmetric
- Live preview that mirrors the actual output structure including merged cells
- "Insert layout" transforms the block into the real Group structure via `replaceBlocks`
- **Aspect ratios per cell shape:** wide cells (colSpan > 1) → 16/9, tall cells (rowSpan > 1) → 9/16, normal cells → 1/1
- **Three output paths for the Asymmetric template:**
  - 2×N (no tall cell): Path A — one Columns block per row, wide top via column width %, plain Group wrapper
  - rows≥3, cols=2 (tall left cell, single right column): **stacked path** — Stack > [Columns(wide top), Columns(tall left + Stack of right cells)]
  - rows≥3, cols≥3 (tall left cell, grid of right cells): grid path — Stack > [constrained top row, 2-column grid Group containing tall left + nested grid for right cells]
- Both Stack-wrapped paths use `justifyContent: stretch` and `flexWrap: nowrap`
- Outer Stack is applied only when there's an actual tall cell

### Edit-mode controls (`src/motion-layout-builder/`)
- `editor.BlockEdit` filter injects Scroll reveal panel into builder Group inspectors
- Old `PluginSidebar` (the four-square toolbar icon) removed

### Other
- Plugin readme.txt (WordPress.org format)
- Asset pipeline: wp-scripts auto-discovery, `wp_register_block_types_from_metadata_collection`

## Remaining work

### Demo page (yours)
A guide for building a one-page demo site exists at `demo-page-guide.md` (root, gitignored / your local). Topic: "Motion, on a page" — meta article where every animation demonstrates the principle the paragraph just described. ~30 min to build.

### Demo video (yours)
Recorded after the demo page exists.

## Polish tasks (low priority, none blocking)

- **Block inserter preview for Motion Layout.** The block currently shows a generic "No preview available" placeholder when hovered in the inserter. A custom rendering of the configuration UI in miniature would be polish.
- **Cadence "By row" / "By column" on Path-B Asymmetric output.** Currently falls through to whole-block animation since the grid output isn't row/column-shaped at the DOM level. Would require inspecting `grid-row` / `grid-column` styles at runtime to compute meaningful row/column groupings. (The new stacked path may have similar limitations — worth verifying.)
- **Folder rename.** `src/motion-layout-builder/` no longer contains a builder. Renaming would touch webpack and PHP enqueue paths; cosmetic.

## How to resume

Workspace path: `~/Desktop/RSM/Saiyan Project/rive-spline-block`

Two terminal tabs:
- Tab 1: `npm start` (watcher; rebuilds `src/` → `build/`)
- Tab 2: git, file ops

Hard-refresh WordPress after any change. Restart the watcher if you add or delete `block.json` files (block discovery happens at startup).

## Recent commit history

```
Asymmetric: stacked output for cols=2 + stretch wrappers
Cap Motion Layout grid at 4 rows by 3 columns
Default 16/9 for wide cells and 9/16 for tall cells
Add HTML format to Motion Layout cell type dropdown
Asymmetric at 3+ rows: emit nested grid Groups for true tall-cell rendering
Fix Motion Layout preview rendering: wrap dropdowns so grid spans apply to actual grid items
Replace Motion Layout sidebar plugin with BlockEdit filter for edit-mode reveal controls
Add Motion Layout block: inline configuration UI, transforms into Group on insert
Add HTML format support: upload self-contained .html animations, render in sandboxed iframe
Write proper readme.txt with description, FAQ, and changelog
Isolate lottie-web's DOM from React reconciliation to fix format-switch crash
[earlier commits — see git log]
```

## When in doubt

The plugin's stable. Don't refactor for elegance. Ship.
