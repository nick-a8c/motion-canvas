import './reveal.scss';
/**
 * Scroll reveal frontend logic.
 *
 * For each .rsb-reveal wrapper on the page:
 *  1. Determine which descendants should animate ("targets") based on
 *     the cadence: rows of columns, individual cells, columns, or all together.
 *  2. Arm the targets — add .rsb-reveal--armed which puts them in the
 *     initial CSS state (opacity 0, etc.) defined in reveal.scss.
 *  3. When the wrapper enters the viewport (IntersectionObserver),
 *     stagger-add .rsb-reveal--in to each target, which transitions
 *     them to the resting state.
 *
 * Each wrapper reveals once and disconnects.
 */

const READY_CLASS = 'rsb-reveal--armed';
const ACTIVE_CLASS = 'rsb-reveal--in';

// Read a value out of a className like "rsb-reveal--cadence-cell"
function readClassValue( element, prefix ) {
	const match = element.className.match( new RegExp( `${ prefix }-([\\w-]+)` ) );
	return match ? match[ 1 ] : null;
}

// Given a wrapper and its cadence, return the array of target elements
// to animate (in order). Returns [] if no sensible targets exist.
function collectTargets( wrapper, cadence ) {
	const rows = Array.from( wrapper.querySelectorAll( ':scope > .wp-block-columns' ) );

	// "Together" — animate the whole wrapper as one unit.
	if ( cadence === 'together' || rows.length === 0 ) {
		return [ wrapper ];
	}

	// Collect all columns across all rows, with their (row, col) positions.
	// We assume each row has the same number of columns — true for builder
	// layouts. If not, we degrade gracefully (treat each column as cadence-cell).
	const grid = rows.map( ( row ) =>
		Array.from( row.querySelectorAll( ':scope > .wp-block-column' ) )
	);

	if ( cadence === 'row' ) {
		// One target per row.
		return rows;
	}

	if ( cadence === 'column' ) {
		// Group cells by column index, top to bottom.
		const numColumns = Math.max( ...grid.map( ( row ) => row.length ) );
		const targets = [];
		for ( let c = 0; c < numColumns; c++ ) {
			for ( let r = 0; r < grid.length; r++ ) {
				if ( grid[ r ][ c ] ) targets.push( grid[ r ][ c ] );
			}
		}
		return targets;
	}

	// Default: cadence === 'cell' — left-to-right, top-to-bottom.
	return grid.flat();
}

function setupReveal( wrapper ) {
	const cadence = readClassValue( wrapper, 'rsb-reveal--cadence' ) || 'cell';
	const targets = collectTargets( wrapper, cadence );

	if ( targets.length === 0 ) return;

	// Arm: switch each target into the initial CSS state. We do this
	// after a frame so the browser registers the initial state BEFORE
	// any "in" class gets added (otherwise the transition is skipped).
	targets.forEach( ( target ) => target.classList.add( READY_CLASS ) );

	const observer = new IntersectionObserver(
		( entries ) => {
			entries.forEach( ( entry ) => {
				if ( ! entry.isIntersecting ) return;

				// Read the stagger from the CSS variable we already set
				// via the speed-* class. Fallback to 150ms if missing.
				const computedStyle = window.getComputedStyle( wrapper );
				const staggerStr = computedStyle.getPropertyValue( '--rsb-stagger' ).trim();
				const staggerMs = parseFloat( staggerStr ) || 150;

				targets.forEach( ( target, i ) => {
					setTimeout( () => {
						target.classList.add( ACTIVE_CLASS );
					}, i * staggerMs );
				} );

				observer.unobserve( wrapper );
			} );
		},
		{ threshold: 0.2 }
	);

	observer.observe( wrapper );
}

function init() {
	const wrappers = document.querySelectorAll( '.rsb-reveal' );
	wrappers.forEach( setupReveal );
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', init );
} else {
	init();
}