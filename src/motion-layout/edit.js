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

// Marker class on every layout this block produces. The edit-mode
// reveal controls (added in Chunk C) recognize Groups carrying this
// class and inject inspector controls for them.
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

const createCellBlock = ( cell ) => {
	switch ( cell.type ) {
		case 'rive':
			return createBlock( 'create-block/rive-spline-block', {
				animationType: 'rive',
				aspectRatio: '1/1',
			} );
		case 'spline':
			return createBlock( 'create-block/rive-spline-block', {
				animationType: 'spline',
				aspectRatio: '1/1',
			} );
		case 'lottie':
			return createBlock( 'create-block/rive-spline-block', {
				animationType: 'lottie',
				aspectRatio: '1/1',
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

// Build the actual layout output that replaces this block.
// Mirrors the sidebar plugin's logic: for each row, emit a core/columns
// with one core/column per visible anchor. Cells covered by a merge
// anchored elsewhere are skipped. Anchors with colSpan > 1 get a width
// percentage to claim the merged horizontal space.
const buildLayoutBlocks = ( rows, columns, cells, reveal, templateId ) => {
	const plan = getMergePlan( templateId, rows, columns );
	const covered = getCoveredCells( plan, rows, columns );
	const rowBlocks = [];

	for ( let r = 0; r < rows; r++ ) {
		const columnBlocks = [];

		for ( let c = 0; c < columns; c++ ) {
			const cellIndex = r * columns + c;
			if ( covered.has( cellIndex ) ) continue;

			const cell = cells[ cellIndex ] || { type: 'empty' };
			const innerBlock = createCellBlock( cell );

			const merge = getMergeAtAnchor( plan, r, c );
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

	const groupAttributes = {
		className: buildClassName( reveal ),
		align: 'wide',
	};

	const group = createBlock( 'core/group', groupAttributes, rowBlocks );
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
								gridColumn: `span ${ v.colSpan }`,
								gridRow: `span ${ v.rowSpan }`,
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
		// Replace this block (the Motion Layout configurator) with the
		// generated layout. After this call, this component unmounts and
		// the user is editing the resulting Group as a normal block.
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
					max={ 6 }
				/>
				<RangeControl
					label={ __( 'Columns', 'rive-spline-block' ) }
					value={ columns }
					onChange={ ( value ) => setColumns( value ) }
					min={ 1 }
					max={ 6 }
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
						display: 'grid',
						gridTemplateColumns: `repeat(${ columns }, 1fr)`,
						gridTemplateRows: `repeat(${ rows }, 1fr)`,
						gap: '6px',
						aspectRatio: `${ columns } / ${ rows }`,
						width: '100%',
						maxWidth: '420px',
					} }
				>
					{ visibleCells.map( ( visible ) => {
						const cell = cells[ visible.index ] || { type: 'empty' };
						return (
							<Dropdown
								key={ visible.index }
								popoverProps={ { placement: 'bottom-start' } }
								renderToggle={ ( { isOpen, onToggle } ) => (
									<button
										type="button"
										onClick={ onToggle }
										aria-expanded={ isOpen }
										className="rsb-motion-layout-config__cell"
										data-cell-type={ cell.type }
										style={ {
											gridColumn: `span ${ visible.colSpan }`,
											gridRow: `span ${ visible.rowSpan }`,
										} }
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