# Motion Canvas

A WordPress plugin that adds interactive motion graphics to posts and pages. Supports four animation formats — Rive, Spline, Lottie, and standalone HTML — in a single block. Also includes a Motion Layout composer for arranging animations in scroll-revealed multi-cell layouts.

## Download

**[→ Download the latest release (motion-canvas.zip)](https://github.com/nick-a8c/motion-canvas/releases/latest)**

The release page above always points to the newest version. Click the `motion-canvas.zip` asset under "Assets" to download.

## Install

1. Download `motion-canvas.zip` from the [releases page](https://github.com/nick-a8c/motion-canvas/releases/latest).
2. In your WordPress admin, go to **Plugins → Add New → Upload Plugin**.
3. Click **Choose File**, select the downloaded zip, then click **Install Now**.
4. Click **Activate Plugin** when the install finishes.

That's it. The block is now available in the editor under the "Media" category as **Animation**, and the **Motion Layout** block under the "Design" category.

## Requirements

- WordPress 6.8 or newer
- PHP 7.4 or newer
- The block editor (Gutenberg) — this plugin does not work with the Classic Editor

## Usage

In any post or page, click the `+` button in the block editor and search for `Rive`, `animation`, or `motion`. Pick a format (Rive, Spline, Lottie, or HTML) and either upload a file or paste a URL. The plugin handles the rest, including validation, error states, and a graceful fallback if a scene fails to load.

For multi-cell layouts with optional scroll-reveal animations, insert the **Motion Layout** block instead — pick a grid size and template, fill the cells, and click "Insert layout."

See [`readme.txt`](./readme.txt) for the full feature list, FAQ, and changelog.

## For developers

If you want to build from source rather than use the release zip:

```bash
git clone https://github.com/nick-a8c/motion-canvas.git
cd motion-canvas
npm install
npm start          # watcher: rebuilds on save
# or
npm run build      # one-shot production build
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for how the plugin is structured and [`HANDOFF.md`](./HANDOFF.md) for current state and remaining work.

## License

GPL-2.0-or-later. See [`readme.txt`](./readme.txt) for the full license header.
