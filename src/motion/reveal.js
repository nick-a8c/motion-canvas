import './reveal.scss';

/**
 * Scroll reveal frontend logic.
 *
 * For each .mb-reveal wrapper on the page:
 *  1. Determine which descendants (or the wrapper itself) should
 *     animate ("targets") based on the cadence.
 *  2. Arm the targets — add .mb-reveal--armed which puts them in the
 *     initial CSS state (opacity 0, etc.) defined in reveal.scss.
 *  3. When the wrapper enters the viewport (IntersectionObserver),
 *     wait one frame so the browser commits the initial state, then
 *     stagger-add .mb-reveal--in to each target.
 *
 * Each wrapper reveals once and disconnects.
 */

const READY_CLASS = 'mb-reveal--armed';
const ACTIVE_CLASS = 'mb-reveal--in';

// Stagger easing exponent. 1.0 = linear (each cell waits the same as
// the last). Below 1.0 compresses later cells so the tail doesn't drag.
// 0.7 feels deliberate without metronomic. Don't go below ~0.5 unless
// you want cells nearly piling up at the end.
const STAGGER_EASE = 0.7;

function easedDelay( index, staggerMs ) {
	// First cell always fires immediately.
	if ( index === 0 ) return 0;
	return staggerMs * Math.pow( index, STAGGER_EASE );
}

function readClassValue( element, prefix ) {
	const match = element.className.match( new RegExp( `${ prefix }-([\\w-]+)` ) );
	return match ? match[ 1 ] : null;
}

function collectTargets( wrapper, cadence ) {
	const rows = Array.from( wrapper.querySelectorAll( ':scope > .wp-block-columns' ) );

	// "Together" — animate the whole wrapper as one unit. Also the fall-through
	// for standalone blocks (no inner row structure).
	if ( cadence === 'together' || rows.length === 0 ) {
		return [ wrapper ];
	}

	const grid = rows.map( ( row ) =>
		Array.from( row.querySelectorAll( ':scope > .wp-block-column' ) )
	);

	if ( cadence === 'row' ) {
		return rows;
	}

	if ( cadence === 'column' ) {
		const numColumns = Math.max( ...grid.map( ( row ) => row.length ) );
		const targets = [];
		for ( let c = 0; c < numColumns; c++ ) {
			for ( let r = 0; r < grid.length; r++ ) {
				if ( grid[ r ][ c ] ) targets.push( grid[ r ][ c ] );
			}
		}
		return targets;
	}

	return grid.flat();
}

function setupReveal( wrapper ) {
	const cadence = readClassValue( wrapper, 'mb-reveal--cadence' ) || 'cell';
	const targets = collectTargets( wrapper, cadence );

	if ( targets.length === 0 ) return;

	// Arm: switch each target into the initial CSS state.
	targets.forEach( ( target ) => target.classList.add( READY_CLASS ) );

	const observer = new IntersectionObserver(
		( entries ) => {
			entries.forEach( ( entry ) => {
				if ( ! entry.isIntersecting ) return;

				const computedStyle = window.getComputedStyle( wrapper );
				const staggerStr = computedStyle.getPropertyValue( '--mb-stagger' ).trim();
				const staggerMs = parseFloat( staggerStr ) || 150;

				// Wait for two frames before triggering --in. This guarantees
				// the browser has committed the --armed initial state before
				// we change anything, so the transition actually runs instead
				// of snapping to the end. (One rAF is usually enough; two is
				// belt-and-suspenders for slower devices.)
				requestAnimationFrame( () => {
					requestAnimationFrame( () => {
						targets.forEach( ( target, i ) => {
							setTimeout( () => {
								target.classList.add( ACTIVE_CLASS );
							}, easedDelay( i, staggerMs ) );
						} );
					} );
				} );

				observer.unobserve( wrapper );
			} );
		},
		{ threshold: 0.2 }
	);

	observer.observe( wrapper );
}

function init() {
	const wrappers = document.querySelectorAll( '.mb-reveal' );
	wrappers.forEach( setupReveal );
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', init );
} else {
	init();
}
