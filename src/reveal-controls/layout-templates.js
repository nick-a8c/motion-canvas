/**
 * Layout templates for the Motion Layout Builder.
 *
 * Each template takes (rows, cols) and returns a "merge plan" — a list
 * of merged regions for that grid size, or null if the combination is
 * not supported by the template.
 *
 * Merge plan shape:
 *   [
 *     { row: 0, col: 0, rowSpan: 1, colSpan: 2 },   // wide top
 *     { row: 1, col: 0, rowSpan: 2, colSpan: 1 },   // tall left
 *     ...
 *   ]
 *
 * Cells not listed in the merge plan are implicit 1×1 cells. The plan
 * lists ONLY merged regions and the cells they cover are computed
 * separately (see getCoveredCells below).
 *
 * Coordinates are 0-indexed: row 0 is the topmost row, col 0 is the
 * leftmost column.
 */

// Template IDs. Used as the value stored in attributes / className.
export const TEMPLATE_UNIFORM = 'uniform';
export const TEMPLATE_WIDE_MIDDLE = 'wide-middle';
export const TEMPLATE_BANDED = 'banded';
export const TEMPLATE_ASYMMETRIC = 'asymmetric';

// ---------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------

/**
 * Layout 1 — Uniform: every cell is 1×1.
 * Always supported.
 */
const uniformPlan = ( /* rows, cols */ ) => [];

/**
 * Layout 2 — Wide middle row: middle row spans full width.
 * Requires odd row count (so there's a single, unambiguous middle row).
 * Requires at least 3 rows and at least 2 columns (otherwise nothing
 * to "wrap").
 */
const wideMiddlePlan = ( rows, cols ) => {
	if ( rows < 3 ) return null;
	if ( cols < 2 ) return null;
	if ( rows % 2 === 0 ) return null; // need a clear middle

	const middleRow = Math.floor( rows / 2 );
	return [ { row: middleRow, col: 0, rowSpan: 1, colSpan: cols } ];
};

/**
 * Layout 3 — Banded: alternating wide bands, starting with row 0.
 * Rows 0, 2, 4… span full width. Other rows split normally.
 * Requires at least 2 columns (otherwise no merging possible).
 */
const bandedPlan = ( rows, cols ) => {
	if ( cols < 2 ) return null;
	const plan = [];
	for ( let r = 0; r < rows; r += 2 ) {
		plan.push( { row: r, col: 0, rowSpan: 1, colSpan: cols } );
	}
	return plan;
};

/**
 * Layout 4 — Asymmetric: top row spans full width, leftmost column
 * of the remaining rows spans those rows vertically, right side stays
 * as individual cells.
 * Requires at least 2 rows and at least 2 columns.
 * For 2 columns: top wide, left tall (rows 1 to rows-1), right is
 *   stacked individual cells.
 * For 3+ columns: top wide, leftmost column spans rows 1..rows-1,
 *   columns 1..cols-1 of those rows are individual cells.
 */
const asymmetricPlan = ( rows, cols ) => {
	if ( rows < 2 ) return null;
	if ( cols < 2 ) return null;

	const plan = [];
	// Top wide row.
	plan.push( { row: 0, col: 0, rowSpan: 1, colSpan: cols } );
	// Tall left column for the rest.
	plan.push( { row: 1, col: 0, rowSpan: rows - 1, colSpan: 1 } );
	return plan;
};

// ---------------------------------------------------------------------
// Public template list with metadata for UI
// ---------------------------------------------------------------------

export const LAYOUT_TEMPLATES = [
	{
		id: TEMPLATE_UNIFORM,
		label: 'Uniform',
		describe: 'Every cell is the same size.',
		plan: uniformPlan,
	},
	{
		id: TEMPLATE_WIDE_MIDDLE,
		label: 'Wide middle',
		describe: 'A wide row in the middle, framed above and below.',
		plan: wideMiddlePlan,
	},
	{
		id: TEMPLATE_BANDED,
		label: 'Banded',
		describe: 'Alternating wide bands and split rows.',
		plan: bandedPlan,
	},
	{
		id: TEMPLATE_ASYMMETRIC,
		label: 'Asymmetric',
		describe: 'A wide top, then a tall left cell with stacked cells on the right.',
		plan: asymmetricPlan,
	},
];

export const getTemplate = ( id ) =>
	LAYOUT_TEMPLATES.find( ( t ) => t.id === id ) || LAYOUT_TEMPLATES[ 0 ];

/**
 * Is this (rows, cols) supported by this template?
 * Returns true / false. Use this to disable thumbnails in the UI.
 */
export const isTemplateSupported = ( templateId, rows, cols ) => {
	const template = getTemplate( templateId );
	const plan = template.plan( rows, cols );
	return plan !== null;
};

/**
 * Get the merge plan for a (template, rows, cols) combination.
 * Returns an empty array for uniform layouts and unsupported combos
 * (callers should check isTemplateSupported first if they care).
 */
export const getMergePlan = ( templateId, rows, cols ) => {
	const template = getTemplate( templateId );
	const plan = template.plan( rows, cols );
	return plan || [];
};

// ---------------------------------------------------------------------
// Cell-coverage helpers
// ---------------------------------------------------------------------

/**
 * Given a merge plan, return a Set of "covered" cell indices — these
 * are cells the user shouldn't see / shouldn't be able to click,
 * because they're absorbed into a merged region.
 *
 * Cell index is computed as `row * cols + col`.
 *
 * Example: plan = [{ row: 0, col: 0, rowSpan: 1, colSpan: 2 }] in a
 * 2×2 grid. The merge anchor is cell 0. Cell 1 is covered.
 * Result: Set { 1 }
 */
export const getCoveredCells = ( plan, rows, cols ) => {
	const covered = new Set();
	plan.forEach( ( region ) => {
		for ( let r = region.row; r < region.row + region.rowSpan; r++ ) {
			for ( let c = region.col; c < region.col + region.colSpan; c++ ) {
				if ( r === region.row && c === region.col ) continue; // anchor stays visible
				covered.add( r * cols + c );
			}
		}
	} );
	return covered;
};

/**
 * Find the merge region that anchors at a given (row, col), or null
 * if no merge starts there.
 */
export const getMergeAtAnchor = ( plan, row, col ) => {
	return plan.find( ( r ) => r.row === row && r.col === col ) || null;
};

/**
 * Build a flat array of "visible cells" for rendering. Each entry is:
 *   {
 *     index: <flat index of the anchor>,
 *     row, col,
 *     rowSpan, colSpan,
 *   }
 * Length is (rows * cols) - covered.size, in row-major order of anchors.
 */
export const getVisibleCells = ( plan, rows, cols ) => {
	const covered = getCoveredCells( plan, rows, cols );
	const visible = [];
	for ( let r = 0; r < rows; r++ ) {
		for ( let c = 0; c < cols; c++ ) {
			const index = r * cols + c;
			if ( covered.has( index ) ) continue;
			const merge = getMergeAtAnchor( plan, r, c );
			visible.push( {
				index,
				row: r,
				col: c,
				rowSpan: merge ? merge.rowSpan : 1,
				colSpan: merge ? merge.colSpan : 1,
			} );
		}
	}
	return visible;
};