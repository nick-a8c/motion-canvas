import { registerPlugin } from '@wordpress/plugins';
import { PluginSidebar } from '@wordpress/editor';
import { __ } from '@wordpress/i18n';

const MotionLayoutBuilderIcon = () => (
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
		<rect x="3" y="3" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
		<rect x="13" y="3" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
		<rect x="3" y="13" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
		<rect x="13" y="13" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
	</svg>
);

const MotionLayoutBuilder = () => (
	<PluginSidebar
		name="motion-layout-builder"
		title={ __( 'Motion Layout Builder', 'rive-spline-block' ) }
		icon={ <MotionLayoutBuilderIcon /> }
	>
		<div style={ { padding: '16px' } }>
			<p>{ __( 'Layout builder coming soon.', 'rive-spline-block' ) }</p>
		</div>
	</PluginSidebar>
);

registerPlugin( 'motion-layout-builder', {
	render: MotionLayoutBuilder,
} );