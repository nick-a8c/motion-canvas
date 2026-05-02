import { registerPlugin } from '@wordpress/plugins';
import { PluginSidebar } from '@wordpress/editor';
import {
	PanelBody,
	RangeControl,
	Dropdown,
	Button,
	MenuGroup,
	MenuItem,
} from '@wordpress/components';
import { useState, useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

const MotionLayoutBuilderIcon = () => (
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
		<rect x="3" y="3" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
		<rect x="13" y="3" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
		<rect x="3" y="13" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
		<rect x="13" y="13" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
	</svg>
);

// All the cell types a user can pick. The `label` is what shows in the menu
// and inside the cell. The `value` is what we store in state and will use
// later when generating blocks.
const CELL_TYPES = [
	{ value: 'empty', label: __('Empty', 'rive-spline-block') },
	{ value: 'rive', label: __('Rive', 'rive-spline-block') },
	{ value: 'spline', label: __('Spline', 'rive-spline-block') },
	{ value: 'lottie', label: __('Lottie', 'rive-spline-block') },
	{ value: 'paragraph', label: __('Paragraph', 'rive-spline-block') },
	{ value: 'heading', label: __('Heading', 'rive-spline-block') },
	{ value: 'image', label: __('Image', 'rive-spline-block') },
];

// Look up the human label for a stored cell type value.
const getCellLabel = (type) => {
	const match = CELL_TYPES.find((option) => option.value === type);
	return match ? match.label : type;
};

// Build an array of length rows*columns, preserving existing cell values
// when the grid size changes.
const buildCells = (rows, columns, previous = []) => {
	const total = rows * columns;
	const next = [];
	for (let i = 0; i < total; i++) {
		next.push(previous[i] || { type: 'empty' });
	}
	return next;
};

const MotionLayoutBuilder = () => {
	const [rows, setRows] = useState(2);
	const [columns, setColumns] = useState(2);
	const [cells, setCells] = useState(() => buildCells(2, 2));

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
			</PanelBody>
		</PluginSidebar>
	);
};

registerPlugin('motion-layout-builder', {
	render: MotionLayoutBuilder,
});