import {
	useBlockProps,
} from '@wordpress/block-editor';
import {
	RangeControl,
	SelectControl,
	Dropdown,
	Button,
	MenuGroup,
	MenuItem,
} from '@wordpress/components';
import { useState, useEffect } from '@wordpress/element';
import { useDispatch } from '@wordpress/data';
import { createBlock } from '@wordpress/blocks';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';
import {
	LAYOUT_TEMPLATES,
	TEMPLATE_UNIFORM,
	TEMPLATE_ASYMMETRIC,
	getMergePlan,
	getVisibleCells,
	isTemplateSupported,
	getCoveredCells,
	getMergeAtAnchor,
} from '../motion-layout-builder/layout-templates';

const CELL_TYPES = [
	{ value: 'empty', label: __( 'Empty', 'rive-spline-block' ) },
	{ value: 'rive', label: __( 'Rive', 'rive-spline-block' ) },
	{ value: 'spline', label: __( 'Spline', 'rive-spline-block' ) },
	{ value: 'lottie', label: __( 'Lottie', 'rive-spline-block' ) },
    { value: 'html', label: __( 'HTML', 'rive-spline-block' ) },
	{ value: 'paragraph', label: __( 'Paragraph', 'rive-spline-block' ) },
	{ value: 'heading', label: __( 'Heading', 'rive-spline-block' ) },
	{ value: 'image', label: __( 'Image', 'rive-spline-block' ) },
];

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

const BUILDER_MARKER_CLASS = 'rsb-builder-layout';

const getCellLabel = ( type ) => {
	const match = CELL_TYPES.find( ( option ) => option.value === type );
	return match ? match.label : type;
};

const buildCells = ( rows, columns, previous = [] ) => {
	const total = rows * columns;
	const next = [];
	for ( let i = 0; i < total; i++ ) {
		next.push( previous[ i ] || { type: 'empty' } );
	}
	return next;
};

const createCellBlock = ( cell, colSpan = 1, rowSpan = 1 ) => {
	// Aspect ratio depends on the cell's shape in the grid:
	//   - Wide cells (colSpan > 1): 16/9.
	//   - Tall cells (rowSpan > 1): 9/16.
	//   - Otherwise: 1/1.
	// If a cell is both wide and tall (not currently produced by any
	// template), wide wins.
	let aspectRatio = '1/1';
	if ( colSpan > 1 ) {
		aspectRatio = '16/9';
	} else if ( rowSpan > 1 ) {
		aspectRatio = '9/16';
	}
	switch ( cell.type ) {
		case 'rive':
			return createBlock( 'create-block/rive-spline-block', {
				animationType: 'rive',
				aspectRatio,
			} );
		case 'spline':
			return createBlock( 'create-block/rive-spline-block', {
				animationType: 'spline',
				aspectRatio,
			} );
		case 'lottie':
			return createBlock( 'create-block/rive-spline-block', {
				animationType: 'lottie',
				aspectRatio,
			} );
            case 'html':
			return createBlock( 'create-block/rive-spline-block', {
				animationType: 'html',
				aspectRatio,
			} );
		case 'paragraph':
			return createBlock( 'core/paragraph', {
				placeholder: __(
					'Drop a thought here. Two short sentences, just enough to balance the motion next door.',
					'rive-spline-block'
				),
			} );
		case 'heading':
			return createBlock( 'core/heading', {
				level: 2,
				placeholder: __( 'Your headline here', 'rive-spline-block' ),
			} );
		case 'image':
			return createBlock( 'core/image', {} );
		case 'empty':
		default:
			return createBlock( 'core/paragraph', {} );
	}
};

const buildClassName = ( reveal ) => {
	const classes = [ BUILDER_MARKER_CLASS ];
	if ( reveal && reveal.style && reveal.style !== 'none' ) {
		classes.push( 'rsb-reveal' );
		classes.push( `rsb-reveal--style-${ reveal.style }` );
		classes.push( `rsb-reveal--cadence-${ reveal.cadence }` );
		classes.push( `rsb-reveal--speed-${ reveal.speed }` );
	}
	return classes.join( ' ' );
};

// ---------------------------------------------------------------------
// Output builders
//
// Two structures depending on the template/size combo:
//
// 1) buildColumnsLayout — used for Uniform, Wide-middle, Banded, and
//    Asymmetric at 2×2. Each grid row becomes one core/columns block,
//    cells become core/column children. Wide-spanning anchors get a
//    width percentage. This is the original output shape.
//
// 2) buildAsymmetricGridLayout — used for Asymmetric at rows ≥ 3 AND
//    cols ≥ 3. Produces an outer flex Group → wide top row → 2-column
//    grid Group containing [tall left cell + nested grid of remaining
//    cells]. The nested grid stretches in height to fit its children;
//    the single left cell stretches vertically to match. This is how
//    we get a real "tall cell" without CSS hacks — pure WordPress
//    grid layout.
// ---------------------------------------------------------------------

const buildColumnsLayout = ( rows, columns, cells, plan, covered ) => {
	const rowBlocks = [];

	for ( let r = 0; r < rows; r++ ) {
		const columnBlocks = [];

		for ( let c = 0; c < columns; c++ ) {
			const cellIndex = r * columns + c;
			if ( covered.has( cellIndex ) ) continue;

			const cell = cells[ cellIndex ] || { type: 'empty' };

			const merge = getMergeAtAnchor( plan, r, c );
			const colSpan = merge ? merge.colSpan : 1;
			const rowSpan = merge ? merge.rowSpan : 1;
			const innerBlock = createCellBlock( cell, colSpan, rowSpan );

			const columnAttrs = { verticalAlignment: 'center' };

			if ( merge && merge.colSpan > 1 ) {
				const widthPct = ( merge.colSpan / columns ) * 100;
				columnAttrs.width = `${ widthPct.toFixed( 2 ) }%`;
			}

			columnBlocks.push(
				createBlock( 'core/column', columnAttrs, [ innerBlock ] )
			);
		}

		if ( columnBlocks.length === 0 ) continue;

		rowBlocks.push(
			createBlock(
				'core/columns',
				{ verticalAlignment: 'center' },
				columnBlocks
			)
		);
	}

	return rowBlocks;
};

const buildAsymmetricStackedLayout = ( rows, columns, cells ) => {
	// Row 0 — wide top.
	const topCell = cells[ 0 ] || { type: 'empty' };
	const topRow = createBlock(
		'core/columns',
		{ verticalAlignment: 'center' },
		[
			createBlock(
				'core/column',
				{ verticalAlignment: 'center' },
				[ createCellBlock( topCell, columns ) ]
			),
		]
	);

	// Tall left cell — anchor at (1, 0), spans rows 1..rows-1.
	const tallCellIndex = 1 * columns + 0;
	const tallCell = cells[ tallCellIndex ] || { type: 'empty' };
	const tallColumn = createBlock(
		'core/column',
		{ verticalAlignment: 'center' },
		[ createCellBlock( tallCell, 1, rows - 1 ) ]
	);

	// Right side — cells at (1, 1), (2, 1), ..., (rows-1, 1).
	const rightCells = [];
	for ( let r = 1; r < rows; r++ ) {
		const cellIndex = r * columns + 1;
		const cell = cells[ cellIndex ] || { type: 'empty' };
		rightCells.push( createCellBlock( cell ) );
	}
	const rightStack = createBlock(
		'core/group',
		{
			layout: {
				type: 'flex',
				orientation: 'vertical',
				justifyContent: 'center',
			},
		},
		rightCells
	);
	const rightColumn = createBlock(
		'core/column',
		{ verticalAlignment: 'center' },
		[ rightStack ]
	);

	const bottomRow = createBlock(
		'core/columns',
		{ verticalAlignment: 'center' },
		[ tallColumn, rightColumn ]
	);

	return [ topRow, bottomRow ];
};

const buildAsymmetricGridLayout = ( rows, columns, cells ) => {
	// Top wide row: one cell, full width.
	// In the user's reference structure this was a "constrained" Group
	// containing a wide-aligned child. We do the same — a constrained
	// Group wrapper lets the cell's content respect alignment options.
	const topCell = cells[ 0 ] || { type: 'empty' };
	const topRowBlock = createBlock(
		'core/group',
		{ layout: { type: 'constrained' } },
		[ createCellBlock( topCell, columns ) ]
	);

	// Tall left cell: anchor at (1, 0). Its content goes directly
	// inside the outer 2-column Grid 1 — when paired with the nested
	// right-side grid, CSS Grid stretches both children to equal height.
	const tallCellIndex = 1 * columns + 0;
	const tallCell = cells[ tallCellIndex ] || { type: 'empty' };
	const tallCellBlock = createCellBlock( tallCell, 1, rows - 1 );

	// Right side: rows 1..rows-1, cols 1..cols-1. (rows-1) × (cols-1)
	// cells, in row-major order. These go into a nested Grid 2 with
	// (cols-1) columns. Grid 2's height grows to fit them all stacked.
	const rightCellBlocks = [];
	for ( let r = 1; r < rows; r++ ) {
		for ( let c = 1; c < columns; c++ ) {
			const cellIndex = r * columns + c;
			const cell = cells[ cellIndex ] || { type: 'empty' };
			rightCellBlocks.push( createCellBlock( cell ) );
		}
	}

	const grid2Block = createBlock(
		'core/group',
		{
			align: 'wide',
			layout: {
				type: 'grid',
				columnCount: columns - 1,
				minimumColumnWidth: null,
			},
		},
		rightCellBlocks
	);

	// Grid 1: 2 columns. Left = tall cell, right = Grid 2.
	const grid1Block = createBlock(
		'core/group',
		{
			align: 'wide',
			layout: {
				type: 'grid',
				columnCount: 2,
				minimumColumnWidth: null,
			},
		},
		[ tallCellBlock, grid2Block ]
	);

	return [ topRowBlock, grid1Block ];
};

const buildLayoutBlocks = ( rows, columns, cells, reveal, templateId ) => {
	const plan = getMergePlan( templateId, rows, columns );
	const covered = getCoveredCells( plan, rows, columns );

	// Decide which output structure to use.
	const useAsymmetricStacked =
		templateId === TEMPLATE_ASYMMETRIC && rows >= 3 && columns === 2;
	const useAsymmetricGrid =
		templateId === TEMPLATE_ASYMMETRIC && rows >= 3 && columns >= 3;

	let innerBlocks;
	let outerLayoutAttr;

	if ( useAsymmetricStacked ) {
		innerBlocks = buildAsymmetricStackedLayout( rows, columns, cells );
		// Outer wrapper is a Stack (vertical flex) so List View labels
		// the wrapper as "Stack" matching the reference structure.
		// Stretch items + nowrap so children fill the wrapper width
		// and never collapse onto a second visual line.
		outerLayoutAttr = {
			type: 'flex',
			orientation: 'vertical',
			justifyContent: 'stretch',
			flexWrap: 'nowrap',
		};
	} else if ( useAsymmetricGrid ) {
		innerBlocks = buildAsymmetricGridLayout( rows, columns, cells );
		// Outer wrapper is a vertical flex Group (Stack) so the top
		// row sits above Grid 1. Stretch + nowrap matches the stacked
		// path so both Asymmetric outputs feel the same.
		outerLayoutAttr = {
			type: 'flex',
			orientation: 'vertical',
			justifyContent: 'stretch',
			flexWrap: 'nowrap',
		};
	} else {
		innerBlocks = buildColumnsLayout( rows, columns, cells, plan, covered );
		// Default Group layout — children just stack normally.
		outerLayoutAttr = undefined;
	}

	const groupAttributes = {
		className: buildClassName( reveal ),
		align: 'wide',
	};

	if ( outerLayoutAttr ) {
		groupAttributes.layout = outerLayoutAttr;
	}

	const group = createBlock( 'core/group', groupAttributes, innerBlocks );
	return [ group ];
};

const LayoutThumbnail = ( { template, rows, columns, isSelected, isSupported, onClick } ) => {
	const plan = isSupported ? getMergePlan( template.id, rows, columns ) : [];
	const visible = isSupported ? getVisibleCells( plan, rows, columns ) : [];

	let borderColor = '#dcdcde';
	if ( isSelected ) borderColor = '#2271b1';

	const containerStyle = {
		display: 'block',
		padding: '8px',
		border: `2px solid ${ borderColor }`,
		borderRadius: '4px',
		background: isSupported ? '#fff' : '#f6f7f7',
		cursor: isSupported ? 'pointer' : 'not-allowed',
		opacity: isSupported ? 1 : 0.45,
		width: '100%',
		minHeight: '64px',
	};

	const gridStyle = {
		display: 'grid',
		gridTemplateColumns: `repeat(${ columns }, 1fr)`,
		gridTemplateRows: `repeat(${ rows }, 1fr)`,
		gap: '2px',
		width: '100%',
		aspectRatio: `${ columns } / ${ rows }`,
	};

	return (
		<button
			type="button"
			onClick={ isSupported ? onClick : undefined }
			disabled={ ! isSupported }
			title={
				isSupported
					? template.describe
					: `${ template.label } isn't available at ${ rows } × ${ columns }.`
			}
			style={ containerStyle }
		>
			{ isSupported ? (
				<div style={ gridStyle }>
					{ visible.map( ( v ) => (
						<div
							key={ v.index }
							style={ {
								gridColumnEnd: `span ${ v.colSpan }`,
								gridRowEnd: `span ${ v.rowSpan }`,
								background: isSelected ? '#dbeafe' : '#e7e8ea',
								border: `1px ${ isSelected ? 'solid #2271b1' : 'dashed #c3c4c7' }`,
								borderRadius: '2px',
							} }
						/>
					) ) }
				</div>
			) : (
				<div
					style={ {
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						minHeight: '40px',
						fontSize: '10px',
						color: '#8c8f94',
						textAlign: 'center',
						fontStyle: 'italic',
					} }
				>
					{ __( 'N/A at this size', 'rive-spline-block' ) }
				</div>
			) }
			<div
				style={ {
					marginTop: '6px',
					fontSize: '11px',
					textAlign: 'center',
					color: isSelected ? '#2271b1' : '#1e1e1e',
					fontWeight: isSelected ? 600 : 400,
				} }
			>
				{ template.label }
			</div>
		</button>
	);
};

export default function Edit( { clientId } ) {
	const blockProps = useBlockProps( {
		className: 'rsb-motion-layout-config',
	} );

	const [ rows, setRows ] = useState( 2 );
	const [ columns, setColumns ] = useState( 2 );
	const [ cells, setCells ] = useState( () => buildCells( 2, 2 ) );

	const [ selectedTemplate, setSelectedTemplate ] = useState( TEMPLATE_UNIFORM );

	const [ revealStyle, setRevealStyle ] = useState( 'none' );
	const [ revealCadence, setRevealCadence ] = useState( 'cell' );
	const [ revealSpeed, setRevealSpeed ] = useState( 'smooth' );

	const { replaceBlocks } = useDispatch( blockEditorStore );

	useEffect( () => {
		setCells( ( previous ) => buildCells( rows, columns, previous ) );
	}, [ rows, columns ] );

	useEffect( () => {
		if ( ! isTemplateSupported( selectedTemplate, rows, columns ) ) {
			setSelectedTemplate( TEMPLATE_UNIFORM );
		}
	}, [ rows, columns, selectedTemplate ] );

	const mergePlan = getMergePlan( selectedTemplate, rows, columns );
	const visibleCells = getVisibleCells( mergePlan, rows, columns );

	const updateCellType = ( index, newType ) => {
		setCells( ( previous ) =>
			previous.map( ( cell, i ) =>
				i === index ? { ...cell, type: newType } : cell
			)
		);
	};

	const handleInsert = () => {
		const blocks = buildLayoutBlocks(
			rows,
			columns,
			cells,
			{ style: revealStyle, cadence: revealCadence, speed: revealSpeed },
			selectedTemplate
		);
		replaceBlocks( clientId, blocks );
	};

	const revealEnabled = revealStyle !== 'none';

	return (
		<div { ...blockProps }>
			<div className="rsb-motion-layout-config__header">
				<h3 className="rsb-motion-layout-config__title">
					{ __( 'Motion Layout', 'rive-spline-block' ) }
				</h3>
				<p className="rsb-motion-layout-config__hint">
					{ __( 'Configure the layout below, then click "Insert layout."', 'rive-spline-block' ) }
				</p>
			</div>

			<div className="rsb-motion-layout-config__section">
				<h4 className="rsb-motion-layout-config__section-title">
					{ __( 'Grid size', 'rive-spline-block' ) }
				</h4>
				<RangeControl
					label={ __( 'Rows', 'rive-spline-block' ) }
					value={ rows }
					onChange={ ( value ) => setRows( value ) }
					min={ 1 }
					max={ 4 }
				/>
				<RangeControl
					label={ __( 'Columns', 'rive-spline-block' ) }
					value={ columns }
					onChange={ ( value ) => setColumns( value ) }
					min={ 1 }
					max={ 3 }
				/>
			</div>

			<div className="rsb-motion-layout-config__section">
				<h4 className="rsb-motion-layout-config__section-title">
					{ __( 'Layout selection', 'rive-spline-block' ) }
				</h4>
				<div className="rsb-motion-layout-config__templates">
					{ LAYOUT_TEMPLATES.map( ( template ) => {
						const supported = isTemplateSupported( template.id, rows, columns );
						const selected = selectedTemplate === template.id;
						return (
							<LayoutThumbnail
								key={ template.id }
								template={ template }
								rows={ rows }
								columns={ columns }
								isSelected={ selected }
								isSupported={ supported }
								onClick={ () => setSelectedTemplate( template.id ) }
							/>
						);
					} ) }
				</div>
			</div>

			<div className="rsb-motion-layout-config__section">
				<h4 className="rsb-motion-layout-config__section-title">
					{ __( 'Layout preview', 'rive-spline-block' ) }
				</h4>
				<p className="rsb-motion-layout-config__hint">
					{ __( 'Click a cell to choose its content type.', 'rive-spline-block' ) }
				</p>
				<div
					className="rsb-motion-layout-config__preview"
					style={ {
						gridTemplateColumns: `repeat(${ columns }, 1fr)`,
						gridTemplateRows: `repeat(${ rows }, 1fr)`,
						aspectRatio: `${ columns } / ${ rows }`,
					} }
				>
					{ visibleCells.map( ( visible ) => {
						const cell = cells[ visible.index ] || { type: 'empty' };
						return (
							<div
								key={ visible.index }
								className="rsb-motion-layout-config__cell-wrap"
								style={ {
									gridColumnEnd: `span ${ visible.colSpan }`,
									gridRowEnd: `span ${ visible.rowSpan }`,
								} }
							>
								<Dropdown
									popoverProps={ { placement: 'bottom-start' } }
									renderToggle={ ( { isOpen, onToggle } ) => (
										<button
											type="button"
											onClick={ onToggle }
											aria-expanded={ isOpen }
											className="rsb-motion-layout-config__cell"
											data-cell-type={ cell.type }
										>
											{ getCellLabel( cell.type ) }
										</button>
									) }
									renderContent={ ( { onClose } ) => (
										<MenuGroup>
											{ CELL_TYPES.map( ( option ) => (
												<MenuItem
													key={ option.value }
													onClick={ () => {
														updateCellType( visible.index, option.value );
														onClose();
													} }
													isSelected={ cell.type === option.value }
												>
													{ option.label }
												</MenuItem>
											) ) }
										</MenuGroup>
									) }
								/>
							</div>
						);
					} ) }
				</div>
			</div>

			<div className="rsb-motion-layout-config__section">
				<h4 className="rsb-motion-layout-config__section-title">
					{ __( 'Scroll reveal', 'rive-spline-block' ) }
				</h4>
				<SelectControl
					label={ __( 'Reveal style', 'rive-spline-block' ) }
					value={ revealStyle }
					options={ REVEAL_STYLE_OPTIONS }
					onChange={ ( val ) => setRevealStyle( val ) }
				/>
				<SelectControl
					label={ __( 'Cadence', 'rive-spline-block' ) }
					value={ revealCadence }
					options={ REVEAL_CADENCE_OPTIONS }
					onChange={ ( val ) => setRevealCadence( val ) }
					disabled={ ! revealEnabled }
					help={ __( 'How cells appear relative to each other.', 'rive-spline-block' ) }
				/>
				<SelectControl
					label={ __( 'Speed', 'rive-spline-block' ) }
					value={ revealSpeed }
					options={ REVEAL_SPEED_OPTIONS }
					onChange={ ( val ) => setRevealSpeed( val ) }
					disabled={ ! revealEnabled }
				/>
			</div>

			<div className="rsb-motion-layout-config__actions">
				<Button
					variant="primary"
					onClick={ handleInsert }
					className="rsb-motion-layout-config__insert"
				>
					{ __( 'Insert layout', 'rive-spline-block' ) }
				</Button>
			</div>
		</div>
	);
}