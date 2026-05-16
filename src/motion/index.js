/**
 * Registers a new block provided a unique name and an object defining its behavior.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-registration/
 */
import { registerBlockType } from '@wordpress/blocks';

/**
 * Lets webpack process CSS, SASS or SCSS files referenced in JavaScript files.
 * All files containing `style` keyword are bundled together. The code used
 * gets applied both to the front of your site and to the editor.
 *
 * @see https://www.npmjs.com/package/@wordpress/scripts#using-css
 */
import './style.scss';

/**
 * Internal dependencies
 */
import Edit from './edit';
import save from './save';
import metadata from './block.json';

// Custom block icon — inherits currentColor so the icon adapts to
// WordPress's various display contexts (inserter hover, selected
// state, breadcrumb).
const blockIcon = (
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
		<rect x="3" y="3" width="2" height="18" rx="1" fill="#1D1D1D"/>
		<rect x="19" y="3" width="2" height="18" rx="1" fill="#1D1D1D"/>
		<circle cx="9" cy="17" r="2" fill="#1D1D1D"/>
		<circle cx="13" cy="14" r="2" fill="#8D8D8D"/>
		<circle cx="17" cy="11" r="2" fill="#B2B2B2"/>
		<circle cx="13" cy="8" r="2" fill="#E3E3E3"/>
	</svg>
);

/**
 * Every block starts by registering a new block type definition.
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-registration/
 */
registerBlockType( metadata.name, {
	icon: blockIcon,

	/**
	 * @see ./edit.js
	 */
	edit: Edit,

	/**
	 * @see ./save.js
	 */
	save,
} );
