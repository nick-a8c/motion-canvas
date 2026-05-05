=== Rive / Spline / Lottie Block ===
Contributors: automattic, creativelab
Tags: animation, motion, rive, spline, lottie, interactive, blocks, gutenberg
Requires at least: 6.8
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 0.2.0
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Add interactive motion graphics to your WordPress site. Supports Rive, Spline, and Lottie — no code required.

== Description ==

Drop interactive motion into a post or page the same way you'd drop in an image. The plugin adds a single block that handles three of the most popular animation formats on the web:

* **Rive** — interactive vector animations with state machines (.riv files)
* **Spline** — 3D scenes published from spline.design
* **Lottie** — lightweight JSON animations exported from After Effects

Upload a file, paste a URL, and the animation plays on your site. No iframe juggling, no shortcodes, no theme edits.

= Motion Layout Builder =

A second feature, the Motion Layout Builder, lives in the editor sidebar. Use it to scaffold multi-cell layouts where each cell can hold an animation, an image, a paragraph, or a heading — all aligned in a tidy grid. Layouts come with optional scroll-reveal animations (fade, fade up, zoom, blur, slide) that trigger as the layout enters the viewport.

= Why this plugin? =

**vs. raw iframe embeds:** Embeds work, but they break when URLs change, don't validate the URL upfront, and don't give you a graceful fallback when something fails. This plugin checks URLs as you paste them, shows clear error messages for common mistakes (wrong URL, embed code pasted instead of viewer URL, scene set to private), and falls back to a friendly message instead of broken content.

**vs. video blocks:** Video looks similar from a distance but isn't interactive. Rive state machines respond to hover and click. Spline scenes track the cursor in 3D. Lottie can play on hover, on scroll, or on click. None of that survives if you record your animation as an .mp4.

**vs. heavier animation plugins:** This block does one thing — embed a motion file or scene — and gets out of your way. No settings page, no admin notices, no telemetry, no upsells. The bundle is small and only loads what each page actually needs.

= Built-in safeguards =

* URL validation catches bad Spline links before they're saved (typos, embed code, Hana embed code, private scenes)
* Friendly fallback overlay if a scene genuinely fails to load
* Error states for broken or invalid Rive and Lottie files
* Respects `prefers-reduced-motion` for accessibility

== Installation ==

1. Upload the `rive-spline-block` folder to `/wp-content/plugins/`, or install the .zip via Plugins → Add New → Upload Plugin
2. Activate the plugin through the Plugins screen in WordPress
3. In any post or page, click the + button and search for "Rive" or "animation" to insert the block
4. To use the Motion Layout Builder, open any post in the editor and look for the sidebar icon (four squares)

The plugin works out of the box with no configuration. Standard WordPress media uploads must be enabled (they are by default).

== Frequently Asked Questions ==

= Where do I get a Rive file? =

Sign up at [rive.app](https://rive.app), create or import an animation, then export it as a .riv file. The plugin accepts that file directly via the standard WordPress media uploader.

= Where do I get a Spline URL? =

In Spline's editor, click "Export" → "Public Viewer" and copy the URL it gives you. It will start with `https://my.spline.design/`. Paste this URL into the block — not the iframe embed code, not the Hana embed code. The plugin will catch those mistakes if you paste them.

= Where do I get a Lottie file? =

Most commonly, Lottie animations come from After Effects via the Bodymovin extension, which exports a .json file. You can also find free Lottie files on lottiefiles.com. Upload the .json via the standard media uploader.

= My Spline URL says "didn't load" but it works in the browser. =

Make sure the scene is set to public in Spline. The plugin checks that the URL responds with a real scene; private scenes return an access-denied response that the plugin treats as a load failure.

= Can I use this with the Classic Editor? =

No. This plugin uses the Block Editor (Gutenberg) and requires it to be active.

= Does it work with page builders like Elementor or Divi? =

The plugin is built for the native WordPress Block Editor. It may work inside page-builder block wrappers, but it's not specifically tested against them.

= Does the animation play in the WordPress editor preview? =

Lottie animations preview live in the editor. Rive and Spline render only on the published page (the editor shows a placeholder noting this) — this keeps the editor responsive and avoids loading heavy 3D runtimes during composition.

= Will it slow down my site? =

The plugin only loads animation runtimes on pages where the block is actually used. Rive and Lottie runtimes are lightweight; Spline scenes load via iframe in their own context. Scroll-reveal animations are CSS-based and respect reduced-motion preferences.

== Changelog ==

= 0.2.0 =
* Add Motion Layout Builder for grid-based layouts
* Add scroll-reveal animations (fade, fade up, zoom, blur, slide) with cadence control
* Add per-style easing for natural motion
* Validate Spline URLs upfront with a reachability check
* Friendly fallback overlay for failed Spline / Rive / Lottie loads
* Catch iframe and Hana embed code pasted instead of viewer URLs
* Builder layouts default to wide alignment with uniform cell sizing
* Warmer empty placeholder with per-format helper text

= 0.1.0 =
* Initial release: Rive, Spline, and Lottie support in a single block
* Aspect ratio control, max-width control
* Lottie playback options: trigger (autoplay/hover/click/scroll), loop, speed

== Upgrade Notice ==

= 0.2.0 =
Adds the Motion Layout Builder, scroll-reveal animations, and significantly more reliable error handling for embedded animations.