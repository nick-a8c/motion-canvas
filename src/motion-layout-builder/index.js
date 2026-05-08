/**
 * Edit-mode reveal controls for Motion Layout-inserted Groups.
 *
 * The Motion Layout block (in src/motion-layout/) inserts a Group of
 * Columns/Column blocks tagged with the BUILDER_MARKER_CLASS. After
 * insertion, that Group is just a normal Gutenberg block — but we want
 * the user to be able to adjust scroll-reveal settings on it without
 * deleting and re-inserting the layout.
 *
 * This file extends every block's edit component via the
 * `editor.BlockEdit` filter. For blocks that are core/group AND carry
 * our marker class, we inject a "Scroll reveal" panel into their
 * inspector (sidebar). Style/cadence/speed changes are written back
 * into the Group's className live, so the editor reflects the change
 * and the saved markup gets the right classes.
 *
 * This replaces the old PluginSidebar approach (which lived in this
 * file before Chunk C) — no toolbar icon needed, no extra sidebar to
 * find, controls live with the block they affect.
 */

import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { InspectorControls } from '@wordpress/block-editor';
import { PanelBody, SelectControl } from '@wordpress/components';
import { Fragment } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

const BUILDER_MARKER_CLASS = 'rsb-builder-layout';

const REVEAL_STYLE_OPTIONS = [
	{ label: __( 'None', 'rive-spline-block' ), value: 'none' },
	{ label: __( 'Fade', 'rive-spline-block' ), value: 'fade' },
	{ label: __( 'Fade up', 'rive-spline-block' ), value: 'fade-up' },
	{ label: __( 'Zoom', 'rive-spline-block' ), value: 'zoom' },
	{ label: __( 'Blur', 'rive-spline-block' ), value: 'blur' },
	{ label: __( 'Slide in', 'rive-spline-block' ), value: 'slide' },
];

const REVEAL_CADENCE_OPTIONS = [
	{ label: __( 'Together', 'rive-spline-block' ), value: 'together' },
	{ label: __( 'By row', 'rive-spline-block' ), value: 'row' },
	{ label: __( 'By cell', 'rive-spline-block' ), value: 'cell' },
	{ label: __( 'By column', 'rive-spline-block' ), value: 'column' },
];

const REVEAL_SPEED_OPTIONS = [
	{ label: __( 'Snappy', 'rive-spline-block' ), value: 'snappy' },
	{ label: __( 'Smooth', 'rive-spline-block' ), value: 'smooth' },
	{ label: __( 'Slow & cinematic', 'rive-spline-block' ), value: 'cinematic' },
];

// Pull current reveal config out of a className string.
// Returns { style, cadence, speed } with sensible fallbacks.
const parseRevealFromClassName = ( className ) => {
	const result = { style: 'none', cadence: 'cell', speed: 'smooth' };
	if ( ! className ) return result;

	const styleMatch = className.match( /rsb-reveal--style-([\w-]+)/ );
	const cadenceMatch = className.match( /rsb-reveal--cadence-([\w-]+)/ );
	const speedMatch = className.match( /rsb-reveal--speed-([\w-]+)/ );

	if ( styleMatch ) result.style = styleMatch[ 1 ];
	if ( cadenceMatch ) result.cadence = cadenceMatch[ 1 ];
	if ( speedMatch ) result.speed = speedMatch[ 1 ];

	return result;
};

// Strip rsb-reveal-* classes from a className while preserving
// everything else (including the marker class and any user-added
// classes). Used before re-applying a fresh set of reveal classes.
const stripRevealClasses = ( className ) => {
	if ( ! className ) return '';
	return className
		.split( /\s+/ )
		.filter(
			( cls ) =>
				cls && ! /^rsb-reveal(?:--|$)/.test( cls )
		)
		.join( ' ' );
};

// Compose the className string for a Group based on reveal config.
// Always preserves the marker class plus any non-reveal user classes,
// then appends the new reveal classes (if style !== 'none').
const composeClassName = ( existing, reveal ) => {
	const stripped = stripRevealClasses( existing || '' );
	const base = stripped.trim();
	const baseClasses = base.split( /\s+/ ).filter( Boolean );

	// Make sure the marker class is present (it should be — this filter
	// only runs for builder Groups — but defensive).
	if ( ! baseClasses.includes( BUILDER_MARKER_CLASS ) ) {
		baseClasses.push( BUILDER_MARKER_CLASS );
	}

	const classes = [ ...baseClasses ];
	if ( reveal && reveal.style && reveal.style !== 'none' ) {
		classes.push( 'rsb-reveal' );
		classes.push( `rsb-reveal--style-${ reveal.style }` );
		classes.push( `rsb-reveal--cadence-${ reveal.cadence }` );
		classes.push( `rsb-reveal--speed-${ reveal.speed }` );
	}
	return classes.join( ' ' );
};

const isBuilderGroup = ( props ) => {
	if ( props.name !== 'core/group' ) return false;
	const className = props.attributes?.className || '';
	return className.includes( BUILDER_MARKER_CLASS );
};

const withMotionLayoutControls = createHigherOrderComponent( ( BlockEdit ) => {
	return ( props ) => {
		// For non-builder blocks, render the original edit component
		// untouched. Zero-impact pass-through — important since this
		// filter runs against every block in the editor.
		if ( ! isBuilderGroup( props ) ) {
			return <BlockEdit { ...props } />;
		}

		const className = props.attributes?.className || '';
		const reveal = parseRevealFromClassName( className );
		const revealEnabled = reveal.style !== 'none';

		const updateReveal = ( next ) => {
			const merged = { ...reveal, ...next };
			props.setAttributes( {
				className: composeClassName( className, merged ),
			} );
		};

		return (
			<Fragment>
				<BlockEdit { ...props } />
				<InspectorControls>
					<PanelBody
						title={ __( 'Scroll reveal', 'rive-spline-block' ) }
						initialOpen={ true }
					>
						<p style={ { marginTop: 0, marginBottom: '12px', color: '#757575', fontSize: '12px' } }>
							{ __(
								'Animate this layout into view as visitors scroll. Changes apply live.',
								'rive-spline-block'
							) }
						</p>

						<SelectControl
							label={ __( 'Reveal style', 'rive-spline-block' ) }
							value={ reveal.style }
							options={ REVEAL_STYLE_OPTIONS }
							onChange={ ( val ) => updateReveal( { style: val } ) }
						/>
						<SelectControl
							label={ __( 'Cadence', 'rive-spline-block' ) }
							value={ reveal.cadence }
							options={ REVEAL_CADENCE_OPTIONS }
							onChange={ ( val ) => updateReveal( { cadence: val } ) }
							disabled={ ! revealEnabled }
							help={ __( 'How cells appear relative to each other.', 'rive-spline-block' ) }
						/>
						<SelectControl
							label={ __( 'Speed', 'rive-spline-block' ) }
							value={ reveal.speed }
							options={ REVEAL_SPEED_OPTIONS }
							onChange={ ( val ) => updateReveal( { speed: val } ) }
							disabled={ ! revealEnabled }
						/>

						{ revealEnabled && (
							<p style={ { marginTop: '12px', color: '#757575', fontSize: '11px', fontStyle: 'italic' } }>
								{ __(
									'Reveal runs once when the layout enters view. Visitors who prefer reduced motion will see content appear instantly.',
									'rive-spline-block'
								) }
							</p>
						) }
					</PanelBody>
				</InspectorControls>
			</Fragment>
		);
	};
}, 'withMotionLayoutControls' );

addFilter(
	'editor.BlockEdit',
	'create-block/motion-layout-controls',
	withMotionLayoutControls
);