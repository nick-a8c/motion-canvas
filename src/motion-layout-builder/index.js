import { registerPlugin } from '@wordpress/plugins';
import { PluginSidebar } from '@wordpress/editor';
import {
	PanelBody,
	RangeControl,
	Dropdown,
	Button,
	MenuGroup,
	MenuItem,
	Notice,
} from '@wordpress/components';
import { useState, useEffect } from '@wordpress/element';
import { useDispatch } from '@wordpress/data';
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
	{ value: 'empty', label: __('Empty', 'rive-spline-block') },
	{ value: 'rive', label: __('Rive', 'rive-spline-block') },
	{ value: 'spline', label: __('Spline', 'rive-spline-block') },
	{ value: 'lottie', label: __('Lottie', 'rive-spline-block') },
	{ value: 'paragraph', label: __('Paragraph', 'rive-spline-block') },
	{ value: 'heading', label: __('Heading', 'rive-spline-block') },
	{ value: 'image', label: __('Image', 'rive-spline-block') },
];

const getCellLabel = (type) => {
	const match = CELL_TYPES.find((option) => option.value === type);
	return match ? match.label : type;
};

const buildCells = (rows, columns, previous = []) => {
	const total = rows * columns;
	const next = [];
	for (let i = 0; i < total; i++) {
		next.push(previous[i] || { type: 'empty' });
	}
	return next;
};

// Turn a cell descriptor into a real Gutenberg block.
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
// Build the full block tree: an outer Columns block per row, with a
// Column block per cell, each wrapping the chosen cell block.
const buildLayoutBlocks = (rows, columns, cells) => {
	const rowBlocks = [];

	for (let r = 0; r < rows; r++) {
		const columnBlocks = [];

		for (let c = 0; c < columns; c++) {
			const cellIndex = r * columns + c;
			const cell = cells[cellIndex];
			const innerBlock = createCellBlock(cell);

			columnBlocks.push(
				createBlock('core/column', {}, [innerBlock])
			);
		}

		rowBlocks.push(
			createBlock('core/columns', {}, columnBlocks)
		);
	}

	return rowBlocks;
};

const MotionLayoutBuilder = () => {
	const [rows, setRows] = useState(2);
	const [columns, setColumns] = useState(2);
	const [cells, setCells] = useState(() => buildCells(2, 2));
	const [notice, setNotice] = useState(null);

	const { insertBlocks } = useDispatch(blockEditorStore);

	useEffect(() => {
		setCells((previous) => buildCells(rows, columns, previous));
	}, [rows, columns]);

	const updateCellType = (index, newType) => {
		setCells((previous) =>
			previous.map((cell, i) =>
				i === index ? { ...cell, type: newType } : cell
			)
		);
	};

	const handleInsert = () => {
		const blocks = buildLayoutBlocks(rows, columns, cells);
		insertBlocks(blocks);
		setNotice({
			status: 'success',
			message: __('Layout inserted.', 'rive-spline-block'),
		});
	};

	return (
		<PluginSidebar
			name="motion-layout-builder"
			title={__('Motion Layout Builder', 'rive-spline-block')}
			icon={<MotionLayoutBuilderIcon />}
		>
			<PanelBody
				title={__('Grid size', 'rive-spline-block')}
				initialOpen={true}
			>
				<RangeControl
					label={__('Rows', 'rive-spline-block')}
					value={rows}
					onChange={(value) => setRows(value)}
					min={1}
					max={6}
				/>
				<RangeControl
					label={__('Columns', 'rive-spline-block')}
					value={columns}
					onChange={(value) => setColumns(value)}
					min={1}
					max={6}
				/>
				<p style={{ marginTop: '16px', color: '#757575', fontSize: '12px' }}>
					{__('Current: ', 'rive-spline-block')}
					{rows} × {columns}
					{__(' (', 'rive-spline-block')}
					{rows * columns}
					{__(' cells)', 'rive-spline-block')}
				</p>
			</PanelBody>

			<PanelBody
				title={__('Layout preview', 'rive-spline-block')}
				initialOpen={true}
			>
				<p style={{ marginTop: 0, marginBottom: '12px', color: '#757575', fontSize: '12px' }}>
					{__('Click a cell to choose its content type.', 'rive-spline-block')}
				</p>
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: `repeat(${columns}, 1fr)`,
						gridTemplateRows: `repeat(${rows}, 1fr)`,
						gap: '6px',
						aspectRatio: `${columns} / ${rows}`,
						width: '100%',
					}}
				>
					{cells.map((cell, index) => (
						<Dropdown
							key={index}
							popoverProps={{ placement: 'bottom-start' }}
							renderToggle={({ isOpen, onToggle }) => (
								<button
									type="button"
									onClick={onToggle}
									aria-expanded={isOpen}
									style={{
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
										cursor: 'pointer',
									}}
								>
									{getCellLabel(cell.type)}
								</button>
							)}
							renderContent={({ onClose }) => (
								<MenuGroup>
									{CELL_TYPES.map((option) => (
										<MenuItem
											key={option.value}
											onClick={() => {
												updateCellType(index, option.value);
												onClose();
											}}
											isSelected={cell.type === option.value}
										>
											{option.label}
										</MenuItem>
									))}
								</MenuGroup>
							)}
						/>
					))}
				</div>

				<div style={{ marginTop: '20px' }}>
					<Button
						variant="primary"
						onClick={handleInsert}
						style={{ width: '100%', justifyContent: 'center' }}
					>
						{__('Insert layout', 'rive-spline-block')}
					</Button>
				</div>

				{notice && (
					<div style={{ marginTop: '12px' }}>
						<Notice
							status={notice.status}
							isDismissible={true}
							onRemove={() => setNotice(null)}
						>
							{notice.message}
						</Notice>
					</div>
				)}
			</PanelBody>
		</PluginSidebar>
	);
};

registerPlugin('motion-layout-builder', {
	render: MotionLayoutBuilder,
});