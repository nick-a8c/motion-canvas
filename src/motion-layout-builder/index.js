import { registerPlugin } from '@wordpress/plugins';
import { PluginSidebar } from '@wordpress/editor';
import { PanelBody, RangeControl } from '@wordpress/components';
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

const MotionLayoutBuilderIcon = () => (
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
		<rect x="3" y="3" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
		<rect x="13" y="3" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
		<rect x="3" y="13" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
		<rect x="13" y="13" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
	</svg>
);

const MotionLayoutBuilder = () => {
	const [ rows, setRows ] = useState( 2 );
	const [ columns, setColumns ] = useState( 2 );

	return (
		<PluginSidebar
			name="motion-layout-builder"
			title={ __( 'Motion Layout Builder', 'rive-spline-block' ) }
			icon={ <MotionLayoutBuilderIcon /> }
		>
			<PanelBody
				title={ __( 'Grid size', 'rive-spline-block' ) }
				initialOpen={ true }
			>
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
				<p style={ { marginTop: '16px', color: '#757575', fontSize: '12px' } }>
					{ __( 'Current: ', 'rive-spline-block' ) }
					{ rows } × { columns }
					{ __( ' (', 'rive-spline-block' ) }
					{ rows * columns }
					{ __( ' cells)', 'rive-spline-block' ) }
				</p>
			</PanelBody>
		</PluginSidebar>
	);
};

registerPlugin( 'motion-layout-builder', {
	render: MotionLayoutBuilder,
} );