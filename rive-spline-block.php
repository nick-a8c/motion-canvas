<?php
/**
 * Plugin Name:       Rive Spline Block
 * Description:       Example block scaffolded with Create Block tool.
 * Version:           0.1.0
 * Requires at least: 6.8
 * Requires PHP:      7.4
 * Author:            The WordPress Contributors
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       rive-spline-block
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
function create_block_rive_spline_block_block_init() {
	wp_register_block_types_from_metadata_collection( __DIR__ . '/build', __DIR__ . '/build/blocks-manifest.php' );
}
add_action( 'init', 'create_block_rive_spline_block_block_init' );
// Allow Rive, Spline, and Lottie/JSON file uploads
function rive_spline_block_allowed_mime_types( $mimes ) {
    $mimes['json'] = 'application/json';
    $mimes['riv']  = 'application/octet-stream';
    $mimes['splinecode'] = 'application/octet-stream';
    return $mimes;
}
add_filter( 'upload_mimes', 'rive_spline_block_allowed_mime_types' );

// Fix MIME type check for these file types
function rive_spline_block_fix_mime_check( $data, $file, $filename, $mimes ) {
    $ext = pathinfo( $filename, PATHINFO_EXTENSION );
    if ( in_array( $ext, [ 'json', 'riv', 'splinecode' ] ) ) {
        $data['ext']  = $ext;
        $data['type'] = $ext === 'json' ? 'application/json' : 'application/octet-stream';
    }
    return $data;
}
add_filter( 'wp_check_filetype_and_ext', 'rive_spline_block_fix_mime_check', 10, 4 );
/**
 * Enqueue the Motion Layout Builder panel in the block editor.
 */
function rive_spline_block_enqueue_layout_builder() {
	$asset_file = plugin_dir_path( __FILE__ ) . 'build/motion-layout-builder/index.asset.php';

	if ( ! file_exists( $asset_file ) ) {
		return;
	}

	$asset = include $asset_file;

	wp_enqueue_script(
		'motion-layout-builder',
		plugins_url( 'build/motion-layout-builder/index.js', __FILE__ ),
		$asset['dependencies'],
		$asset['version'],
		true
	);
}
add_action( 'enqueue_block_editor_assets', 'rive_spline_block_enqueue_layout_builder' );
/**
 * Enqueue the scroll-reveal script and styles on the frontend.
 * Loaded on every front-end page; the script is small and exits
 * immediately if no .rsb-reveal elements exist on the page.
 */
function rive_spline_block_enqueue_reveal() {
	$asset_file = plugin_dir_path( __FILE__ ) . 'build/rive-spline-block/reveal.asset.php';

	if ( ! file_exists( $asset_file ) ) {
		return;
	}

	$asset = include $asset_file;

	wp_enqueue_script(
		'rsb-reveal',
		plugins_url( 'build/rive-spline-block/reveal.js', __FILE__ ),
		$asset['dependencies'],
		$asset['version'],
		true
	);

	// The CSS is bundled into a sibling file by wp-scripts.
	$css_path = plugin_dir_path( __FILE__ ) . 'build/rive-spline-block/reveal.css';
	if ( file_exists( $css_path ) ) {
		wp_enqueue_style(
			'rsb-reveal',
			plugins_url( 'build/rive-spline-block/reveal.css', __FILE__ ),
			array(),
			$asset['version']
		);
	}
}
add_action( 'wp_enqueue_scripts', 'rive_spline_block_enqueue_reveal' );