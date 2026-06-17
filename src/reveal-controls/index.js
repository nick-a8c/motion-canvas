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

const BUILDER_MARKER_CLASS = 'mb-builder-layout';

const REVEAL_STYLE_OPTIONS = [
	{ label: __( 'None', 'motion-canvas' ), value: 'none' },
	{ label: __( 'Fade', 'motion-canvas' ), value: 'fade' },
	{ label: __( 'Fade up', 'motion-canvas' ), value: 'fade-up' },
	{ label: __( 'Zoom', 'motion-canvas' ), value: 'zoom' },
	{ label: __( 'Blur', 'motion-canvas' ), value: 'blur' },
	{ label: __( 'Slide in', 'motion-canvas' ), value: 'slide' },
];

const REVEAL_CADENCE_OPTIONS = [
	{ label: __( 'Together', 'motion-canvas' ), value: 'together' },
	{ label: __( 'By row', 'motion-canvas' ), value: 'row' },
	{ label: __( 'By cell', 'motion-canvas' ), value: 'cell' },
	{ label: __( 'By column', 'motion-canvas' ), value: 'column' },
];

const REVEAL_SPEED_OPTIONS = [
	{ label: __( 'Snappy', 'motion-canvas' ), value: 'snappy' },
	{ label: __( 'Smooth', 'motion-canvas' ), value: 'smooth' },
	{ label: __( 'Slow & cinematic', 'motion-canvas' ), value: 'cinematic' },
];

// Pull current reveal config out of a className string.
// Returns { style, cadence, speed } with sensible fallbacks.
const parseRevealFromClassName = ( className ) => {
	const result = { style: 'none', cadence: 'cell', speed: 'smooth' };
	if ( ! className ) return result;

	const styleMatch = className.match( /mb-reveal--style-([\w-]+)/ );
	const cadenceMatch = className.match( /mb-reveal--cadence-([\w-]+)/ );
	const speedMatch = className.match( /mb-reveal--speed-([\w-]+)/ );

	if ( styleMatch ) result.style = styleMatch[ 1 ];
	if ( cadenceMatch ) result.cadence = cadenceMatch[ 1 ];
	if ( speedMatch ) result.speed = speedMatch[ 1 ];

	return result;
};

// Strip mb-reveal-* classes from a className while preserving
// everything else (including the marker class and any user-added
// classes). Used before re-applying a fresh set of reveal classes.
const stripRevealClasses = ( className ) => {
	if ( ! className ) return '';
	return className
		.split( /\s+/ )
		.filter(
			( cls ) =>
				cls && ! /^mb-reveal(?:--|$)/.test( cls )
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
		classes.push( 'mb-reveal' );
		classes.push( `mb-reveal--style-${ reveal.style }` );
		classes.push( `mb-reveal--cadence-${ reveal.cadence }` );
		classes.push( `mb-reveal--speed-${ reveal.speed }` );
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
						title={ __( 'Scroll reveal', 'motion-canvas' ) }
						initialOpen={ true }
					>
						<p style={ { marginTop: 0, marginBottom: '12px', color: '#757575', fontSize: '12px' } }>
							{ __(
								'Animate this layout into view as visitors scroll. Changes apply live.',
								'motion-canvas'
							) }
						</p>

						<SelectControl
							label={ __( 'Reveal style', 'motion-canvas' ) }
							value={ reveal.style }
							options={ REVEAL_STYLE_OPTIONS }
							onChange={ ( val ) => updateReveal( { style: val } ) }
						/>
						<SelectControl
							label={ __( 'Cadence', 'motion-canvas' ) }
							value={ reveal.cadence }
							options={ REVEAL_CADENCE_OPTIONS }
							onChange={ ( val ) => updateReveal( { cadence: val } ) }
							disabled={ ! revealEnabled }
							help={ __( 'How cells appear relative to each other.', 'motion-canvas' ) }
						/>
						<SelectControl
							label={ __( 'Speed', 'motion-canvas' ) }
							value={ reveal.speed }
							options={ REVEAL_SPEED_OPTIONS }
							onChange={ ( val ) => updateReveal( { speed: val } ) }
							disabled={ ! revealEnabled }
						/>

						{ revealEnabled && (
							<p style={ { marginTop: '12px', color: '#757575', fontSize: '11px', fontStyle: 'italic' } }>
								{ __(
									'Reveal runs once when the layout enters view. Visitors who prefer reduced motion will see content appear instantly.',
									'motion-canvas'
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
	'motion-canvas/motion-layout-controls',
	withMotionLayoutControls
);