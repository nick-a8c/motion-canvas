const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const path = require( 'path' );

// defaultConfig is an array (multi-config) in newer wp-scripts versions.
// Find the main JS config and add our extra entry to it.
const configs = Array.isArray( defaultConfig ) ? defaultConfig : [ defaultConfig ];

module.exports = configs.map( ( config ) => {
	// Only modify the config that has entries (skip block.json copying configs etc.)
	if ( ! config.entry || typeof config.entry !== 'function' ) {
		return config;
	}

	return {
		...config,
		entry: ( ...args ) => {
			const original = config.entry( ...args );
			return {
				...original,
				'motion-layout-builder/index': path.resolve(
					process.cwd(),
					'src/motion-layout-builder',
					'index.js'
				),
			};
		},
	};
} );