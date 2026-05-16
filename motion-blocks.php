<?php
/**
 * Plugin Name:       Motion
 * Description:       Add interactive motion graphics to your WordPress site. Supports Rive, Spline, Lottie, and standalone HTML — no code required.
 * Version:           0.3.0
 * Requires at least: 6.8
 * Requires PHP:      7.4
 * Author:            Automattic | Creative Lab
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       motion-blocks
 *
 * @package CreateBlock
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}
/**
 * Registers the block(s) metadata from the `blocks-manifest.php` and registers the block type(s)
 * based on the registered block metadata. Behind the scenes, it registers also all assets so they can be enqueued
 * through the block editor in the corresponding context.
 *
 * @see https://make.wordpress.org/core/2025/03/13/more-efficient-block-type-registration-in-6-8/
 * @see https://make.wordpress.org/core/2024/10/17/new-block-type-registration-apis-to-improve-performance-in-wordpress-6-7/
 */
function create_block_motion_blocks_block_init() {
	wp_register_block_types_from_metadata_collection( __DIR__ . '/build', __DIR__ . '/build/blocks-manifest.php' );
}
add_action( 'init', 'create_block_motion_blocks_block_init' );
// Allow Rive, Spline, Lottie/JSON, and standalone HTML file uploads.
//
// HTML uploads are normally disabled by WordPress for security. We
// whitelist them only for users who can already upload arbitrary code
// via the Custom HTML block — the trust model is the same.
function motion_blocks_allowed_mime_types( $mimes ) {
    $mimes['json'] = 'application/json';
    $mimes['riv']  = 'application/octet-stream';
    $mimes['splinecode'] = 'application/octet-stream';
    $mimes['html'] = 'text/html';
    $mimes['htm']  = 'text/html';
    return $mimes;
}
add_filter( 'upload_mimes', 'motion_blocks_allowed_mime_types' );

// Fix MIME type check for these file types
function motion_blocks_fix_mime_check( $data, $file, $filename, $mimes ) {
    $ext = pathinfo( $filename, PATHINFO_EXTENSION );
    if ( in_array( $ext, [ 'json', 'riv', 'splinecode', 'html', 'htm' ] ) ) {
        $data['ext']  = $ext;
        if ( $ext === 'json' ) {
            $data['type'] = 'application/json';
        } else if ( $ext === 'html' || $ext === 'htm' ) {
            $data['type'] = 'text/html';
        } else {
            $data['type'] = 'application/octet-stream';
        }
    }
    return $data;
}
add_filter( 'wp_check_filetype_and_ext', 'motion_blocks_fix_mime_check', 10, 4 );
/**
 * Enqueue the Motion Layout Builder panel in the block editor.
 */
function motion_blocks_enqueue_layout_builder() {
	$asset_file = plugin_dir_path( __FILE__ ) . 'build/reveal-controls/index.asset.php';

	if ( ! file_exists( $asset_file ) ) {
		return;
	}

	$asset = include $asset_file;

	wp_enqueue_script(
		'reveal-controls',
		plugins_url( 'build/reveal-controls/index.js', __FILE__ ),
		$asset['dependencies'],
		$asset['version'],
		true
	);
}
add_action( 'enqueue_block_editor_assets', 'motion_blocks_enqueue_layout_builder' );
/**
 * Enqueue the scroll-reveal script and styles on the frontend.
 * Loaded on every front-end page; the script is small and exits
 * immediately if no .mb-reveal elements exist on the page.
 */
function motion_blocks_enqueue_reveal() {
	$asset_file = plugin_dir_path( __FILE__ ) . 'build/motion/reveal.asset.php';

	if ( ! file_exists( $asset_file ) ) {
		return;
	}

	$asset = include $asset_file;

	wp_enqueue_script(
		'mb-reveal',
		plugins_url( 'build/motion/reveal.js', __FILE__ ),
		$asset['dependencies'],
		$asset['version'],
		true
	);

	// The CSS is bundled into a sibling file by wp-scripts.
	$css_path = plugin_dir_path( __FILE__ ) . 'build/motion/reveal.css';
	if ( file_exists( $css_path ) ) {
		wp_enqueue_style(
			'mb-reveal',
			plugins_url( 'build/motion/reveal.css', __FILE__ ),
			array(),
			$asset['version']
		);
	}
}
add_action( 'wp_enqueue_scripts', 'motion_blocks_enqueue_reveal' );