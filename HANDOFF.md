# Handoff

Living doc. Current state of the plugin and what's still in flight. Updated whenever someone leaves the project mid-session.

For how the plugin is built, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Status

**The plugin is in shippable shape.** Every code task is done. Remaining work is polish + content (a demo page, a demo video, README screenshots) — none of it is coding the core blocks.

The plugin is published as **Motion** at [github.com/nick-a8c/motion-blocks](https://github.com/nick-a8c/motion-blocks). Latest release: v0.3.0.

## What's done

### The Animation block (`src/motion/`)
- Four formats: Rive (.riv), Spline (URL), Lottie (.json), HTML (.html)
- Format-switching modal with content preservation warning
- Spline URL validation (paste-time + blur-time, reachability check + AccessDenied detection)
- Lottie editor preview with React/lottie-web isolation pattern
- Frontend fallback overlay (8s timeout) for Spline / HTML / Rive / Lottie load failures
- HTML iframe with `sandbox="allow-scripts"` security posture
- Custom block icon (motion-stack design)
- Light-themed empty placeholder with a custom illustration icon

### The Motion Layout block (`src/motion-layout/`)
- Inline configuration UI (grid size, layout selection, layout preview, scroll reveal)
- Grid size capped at 4 rows × 3 columns
- Four templates: Uniform, Wide-middle, Banded, Asymmetric
- Live preview that mirrors the actual output structure including merged cells
- "Insert layout" transforms the block into the real Group structure via `replaceBlocks`
- Aspect ratios per cell shape: wide (colSpan > 1) → 16/9, tall (rowSpan > 1) → 9/16, normal → 1/1
- Three output paths for the Asymmetric template:
  - 2×N (no tall cell): Path A — one Columns block per row, wide top via column width %, plain Group wrapper
  - rows≥3, cols=2 (tall left cell, single right column): **stacked path** — Stack > [Columns(wide top), Columns(tall left + Stack of right cells)]
  - rows≥3, cols≥3 (tall left cell, grid of right cells): grid path — Stack > [constrained top row, 2-column grid Group containing tall left + nested grid for right cells]
- Both Stack-wrapped paths use `justifyContent: stretch` and `flexWrap: nowrap`
- Outer Stack is applied only when there's an actual tall cell

### Edit-mode controls (`src/reveal-controls/`)
- `editor.BlockEdit` filter injects Scroll reveal panel into builder Group inspectors
- Old `PluginSidebar` (the four-square toolbar icon) removed

### Other
- Plugin readme.txt (WordPress.org format)
- GitHub-facing README.md with download instructions
- Asset pipeline: wp-scripts auto-discovery, `wp_register_block_types_from_metadata_collection`
- Release packaging via `npm run plugin-zip` and `gh release create`

## Remaining work

### Content (yours)
- **Demo page.** Guide at `demo-page-guide.md` (root, gitignored / your local). Topic: "Motion, on a page" — meta article where every animation demonstrates the principle the paragraph just described. ~30 min to build.
- **Demo video.** Recorded after the demo page exists.
- **README.md screenshots / demo GIF.** Right now README is text only. A 2-second animated GIF of the Motion Layout block being inserted, or a screenshot of an animation rendering, would give visitors a visual hook.

## Polish tasks (low priority, none blocking)

- **Block inserter preview for Motion Layout.** The block currently shows a generic "No preview available" placeholder when hovered in the inserter. A custom rendering of the configuration UI in miniature would be polish.
- **Cadence "By row" / "By column" on Path-B Asymmetric output.** Path B (rows ≥ 3, cols ≥ 3) uses CSS Grid with `grid-row` / `grid-column` placement instead of nested Columns/Column blocks. The frontend `reveal.js` walks the Columns structure to compute row/column groupings, so when it encounters Path B with By row/By column cadence selected, it falls through to treating the whole block as one unit. Fix would require reading each cell's computed `grid-row` / `grid-column` at runtime, grouping cells by those values, and computing stagger delays accordingly.

## How to resume

Workspace path: `~/Desktop/RSM/Saiyan Project/rive-spline-block` (folder still named after the old project; only its contents reflect the new naming. Renaming the local folder requires re-pointing Studio and updating the shell alias `cdplugin`. Cosmetic.)

Two terminal tabs:
- Tab 1: `npm start` (watcher; rebuilds `src/` → `build/`)
- Tab 2: git, file ops

Shell alias `cdplugin` jumps to the project root in any new tab.

Hard-refresh WordPress after any change. Restart the watcher if you add or delete `block.json` files (block discovery happens at startup) or if you edit `webpack.config.js`.

## Release workflow

To cut a new version:

1. Bump `version` in `package.json`, `Version:` header in `motion-blocks.php`, and `Stable tag:` in `readme.txt` — all three must match.
2. Add a changelog entry near the bottom of `readme.txt` under `== Changelog ==`.
3. `npm run build && npm run plugin-zip`
4. `gh release create vX.Y.Z motion-blocks.zip --title "..." --notes "..."`
5. `git add -A && git commit -m "Bump version to X.Y.Z" && git push`

## Recent commit history

```
Bump version to 0.3.0
Rename plugin: Rive / Spline / Lottie → Motion
Add README.md with download and install instructions
Motion Layout: aspect ratios per cell shape, 4×3 cap, stacked Asymmetric
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
