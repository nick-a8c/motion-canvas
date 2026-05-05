import { registerPlugin } from '@wordpress/plugins';
import { PluginSidebar } from '@wordpress/editor';
import {
	PanelBody,
	RangeControl,
	SelectControl,
	Dropdown,
	Button,
	MenuGroup,
	MenuItem,
	Notice,
} from '@wordpress/components';
import { useState, useEffect } from '@wordpress/element';
import { useDispatch, useSelect } from '@wordpress/data';
import { createBlock } from '@wordpress/blocks';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';

const MotionLayoutBuilderIcon = () => (
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
		<rect x="3" y="3" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
		<rect x="13" y="3" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
		<rect x="3" y="13" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
		<rect x="13" y="13" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
	</svg>
);

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

// The marker class we put on every layout the builder inserts. Used to
// recognize "our" Groups vs unrelated Group blocks the user added themselves.
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

// Compose the className string for a Group based on reveal config.
// Always includes BUILDER_MARKER_CLASS so we can find it later.
// Reveal classes are only added when style !== 'none'.
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

// Parse reveal config out of an existing className string.
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

const buildLayoutBlocks = ( rows, columns, cells, reveal ) => {
	const rowBlocks = [];

	for ( let r = 0; r < rows; r++ ) {
		const columnBlocks = [];

		for ( let c = 0; c < columns; c++ ) {
			const cellIndex = r * columns + c;
			const cell = cells[ cellIndex ];
			const innerBlock = createCellBlock( cell );

			columnBlocks.push(
				createBlock(
					'core/column',
					{ verticalAlignment: 'center' },
					[ innerBlock ]
				)
			);
		}

		rowBlocks.push(
			createBlock(
				'core/columns',
				{ verticalAlignment: 'center' },
				columnBlocks
			)
		);
	}

	// Default the Group to wide alignment so the layout has room to
	// breathe in narrow themes. Users can change this in the toolbar
	// after insertion if they want.
	const groupAttributes = {
		className: buildClassName( reveal ),
		align: 'wide',
	};

	const group = createBlock( 'core/group', groupAttributes, rowBlocks );
	return [ group ];
};

const MotionLayoutBuilder = () => {
	const [ rows, setRows ] = useState( 2 );
	const [ columns, setColumns ] = useState( 2 );
	const [ cells, setCells ] = useState( () => buildCells( 2, 2 ) );
	const [ notice, setNotice ] = useState( null );

	const [ revealStyle, setRevealStyle ] = useState( 'none' );
	const [ revealCadence, setRevealCadence ] = useState( 'cell' );
	const [ revealSpeed, setRevealSpeed ] = useState( 'smooth' );

	const { insertBlocks, updateBlockAttributes } = useDispatch( blockEditorStore );

	// Watch the currently-selected block. If it's a builder Group, we're
	// in edit mode for that Group.
	const selectedGroup = useSelect( ( select ) => {
		const block = select( blockEditorStore ).getSelectedBlock();
		if ( ! block ) return null;
		if ( block.name !== 'core/group' ) return null;
		const className = block.attributes?.className || '';
		if ( ! className.includes( BUILDER_MARKER_CLASS ) ) return null;
		return block;
	}, [] );

	const isEditMode = !! selectedGroup;

	// When entering edit mode for a Group, sync the reveal dropdowns
	// to reflect that Group's current reveal config.
	useEffect( () => {
		if ( ! selectedGroup ) return;
		const parsed = parseRevealFromClassName( selectedGroup.attributes.className );
		setRevealStyle( parsed.style );
		setRevealCadence( parsed.cadence );
		setRevealSpeed( parsed.speed );
	}, [ selectedGroup?.clientId ] );

	useEffect( () => {
		setCells( ( previous ) => buildCells( rows, columns, previous ) );
	}, [ rows, columns ] );

	const updateCellType = ( index, newType ) => {
		setCells( ( previous ) =>
			previous.map( ( cell, i ) =>
				i === index ? { ...cell, type: newType } : cell
			)
		);
	};

	// Live-update the selected Group's className when reveal dropdowns
	// change in edit mode.
	const applyRevealToSelectedGroup = ( nextReveal ) => {
		if ( ! selectedGroup ) return;
		updateBlockAttributes( selectedGroup.clientId, {
			className: buildClassName( nextReveal ),
		} );
	};

	const handleRevealStyleChange = ( val ) => {
		setRevealStyle( val );
		if ( isEditMode ) {
			applyRevealToSelectedGroup( {
				style: val,
				cadence: revealCadence,
				speed: revealSpeed,
			} );
		}
	};

	const handleRevealCadenceChange = ( val ) => {
		setRevealCadence( val );
		if ( isEditMode ) {
			applyRevealToSelectedGroup( {
				style: revealStyle,
				cadence: val,
				speed: revealSpeed,
			} );
		}
	};

	const handleRevealSpeedChange = ( val ) => {
		setRevealSpeed( val );
		if ( isEditMode ) {
			applyRevealToSelectedGroup( {
				style: revealStyle,
				cadence: revealCadence,
				speed: val,
			} );
		}
	};

	const handleInsert = () => {
		const blocks = buildLayoutBlocks( rows, columns, cells, {
			style: revealStyle,
			cadence: revealCadence,
			speed: revealSpeed,
		} );
		insertBlocks( blocks );
		setNotice( {
			status: 'success',
			message: __( 'Layout inserted.', 'rive-spline-block' ),
		} );
	};

	const revealEnabled = revealStyle !== 'none';

	return (
		<PluginSidebar
			name="motion-layout-builder"
			title={ __( 'Motion Layout Builder', 'rive-spline-block' ) }
			icon={ <MotionLayoutBuilderIcon /> }
		>
			{ isEditMode && (
				<div style={ {
					padding: '12px 16px',
					background: '#f0f6fc',
					borderBottom: '1px solid #c5d9ed',
				} }>
					<p style={ { margin: 0, fontSize: '12px', color: '#1e40af', fontWeight: 600 } }>
						{ __( 'Editing inserted layout', 'rive-spline-block' ) }
					</p>
					<p style={ { margin: '4px 0 0 0', fontSize: '11px', color: '#3a5573' } }>
						{ __(
							'Structural changes are locked. To resize or change cells, delete the layout and insert a new one.',
							'rive-spline-block'
						) }
					</p>
				</div>
			) }

			<PanelBody
				title={ __( 'Grid size', 'rive-spline-block' ) }
				initialOpen={ ! isEditMode }
			>
				<RangeControl
					label={ __( 'Rows', 'rive-spline-block' ) }
					value={ rows }
					onChange={ ( value ) => setRows( value ) }
					min={ 1 }
					max={ 6 }
					disabled={ isEditMode }
				/>
				<RangeControl
					label={ __( 'Columns', 'rive-spline-block' ) }
					value={ columns }
					onChange={ ( value ) => setColumns( value ) }
					min={ 1 }
					max={ 6 }
					disabled={ isEditMode }
				/>
				<p style={ { marginTop: '16px', color: '#757575', fontSize: '12px' } }>
					{ __( 'Current: ', 'rive-spline-block' ) }
					{ rows } × { columns }
					{ __( ' (', 'rive-spline-block' ) }
					{ rows * columns }
					{ __( ' cells)', 'rive-spline-block' ) }
				</p>
			</PanelBody>

			<PanelBody
				title={ __( 'Layout preview', 'rive-spline-block' ) }
				initialOpen={ ! isEditMode }
			>
				<p style={ { marginTop: 0, marginBottom: '12px', color: '#757575', fontSize: '12px' } }>
					{ isEditMode
						? __( 'Cells are locked. Edit them directly in the canvas.', 'rive-spline-block' )
						: __( 'Click a cell to choose its content type.', 'rive-spline-block' ) }
				</p>
				<div
					style={ {
						display: 'grid',
						gridTemplateColumns: `repeat(${ columns }, 1fr)`,
						gridTemplateRows: `repeat(${ rows }, 1fr)`,
						gap: '6px',
						aspectRatio: `${ columns } / ${ rows }`,
						width: '100%',
						opacity: isEditMode ? 0.55 : 1,
						pointerEvents: isEditMode ? 'none' : 'auto',
					} }
				>
					{ cells.map( ( cell, index ) => (
						<Dropdown
							key={ index }
							popoverProps={ { placement: 'bottom-start' } }
							renderToggle={ ( { isOpen, onToggle } ) => (
								<button
									type="button"
									onClick={ onToggle }
									aria-expanded={ isOpen }
									disabled={ isEditMode }
									style={ {
										background:
											cell.type === 'empty'
												? '#f0f0f0'
												: '#e7f0fa',
										border:
											cell.type === 'empty'
												? '1px dashed #c3c4c7'
												: '1px solid #2271b1',
										borderRadius: '2px',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center',
										fontSize: '11px',
										color:
											cell.type === 'empty'
												? '#757575'
												: '#1e40af',
										textAlign: 'center',
										padding: '4px',
										width: '100%',
										height: '100%',
										minHeight: '40px',
										cursor: isEditMode ? 'not-allowed' : 'pointer',
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
												updateCellType( index, option.value );
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
					) ) }
				</div>

				{ ! isEditMode && (
					<div style={ { marginTop: '20px' } }>
						<Button
							variant="primary"
							onClick={ handleInsert }
							style={ { width: '100%', justifyContent: 'center' } }
						>
							{ __( 'Insert layout', 'rive-spline-block' ) }
						</Button>
					</div>
				) }

				{ notice && ! isEditMode && (
					<div style={ { marginTop: '12px' } }>
						<Notice
							status={ notice.status }
							isDismissible={ true }
							onRemove={ () => setNotice( null ) }
						>
							{ notice.message }
						</Notice>
					</div>
				) }
			</PanelBody>

			<PanelBody
				title={ __( 'Scroll reveal', 'rive-spline-block' ) }
				initialOpen={ isEditMode }
			>
				<p style={ { marginTop: 0, marginBottom: '12px', color: '#757575', fontSize: '12px' } }>
					{ isEditMode
						? __( 'Adjust reveal effect for the selected layout. Changes apply live.', 'rive-spline-block' )
						: __( 'Animate the layout into view as visitors scroll. Disabled by default.', 'rive-spline-block' ) }
				</p>

				<SelectControl
					label={ __( 'Reveal style', 'rive-spline-block' ) }
					value={ revealStyle }
					options={ REVEAL_STYLE_OPTIONS }
					onChange={ handleRevealStyleChange }
				/>

				<SelectControl
					label={ __( 'Cadence', 'rive-spline-block' ) }
					value={ revealCadence }
					options={ REVEAL_CADENCE_OPTIONS }
					onChange={ handleRevealCadenceChange }
					disabled={ ! revealEnabled }
					help={ __( 'How cells appear relative to each other.', 'rive-spline-block' ) }
				/>

				<SelectControl
					label={ __( 'Speed', 'rive-spline-block' ) }
					value={ revealSpeed }
					options={ REVEAL_SPEED_OPTIONS }
					onChange={ handleRevealSpeedChange }
					disabled={ ! revealEnabled }
				/>

				{ revealEnabled && ! isEditMode && (
					<p style={ { marginTop: '12px', color: '#757575', fontSize: '11px', fontStyle: 'italic' } }>
						{ __(
							'Reveal will run once when the layout enters view. Visitors who prefer reduced motion will see content appear instantly.',
							'rive-spline-block'
						) }
					</p>
				) }
			</PanelBody>
		</PluginSidebar>
	);
};

registerPlugin( 'motion-layout-builder', {
	render: MotionLayoutBuilder,
} );